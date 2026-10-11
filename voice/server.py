import argparse
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf
from kokoro import KPipeline


STATE = {"state": "loading", "ready": False, "error": None}
PIPELINE = None
PIPELINE_LOCK = threading.Lock()
ALLOWED_VOICES = {"pm_alex", "pm_santa"}


def initialize_pipeline():
    global PIPELINE
    try:
        pipeline = KPipeline(lang_code="p")
        # A primeira geracao baixa e aquece o modelo para evitar espera na conversa.
        next(iter(pipeline("Olá.", voice="pm_alex", speed=0.94)))
        PIPELINE = pipeline
        STATE.update(state="ready", ready=True, error=None)
        print("Voz neural Kokoro pronta: pm_alex", flush=True)
    except Exception as error:
        STATE.update(state="error", ready=False, error=str(error))
        print(f"Falha ao iniciar Kokoro: {error}", flush=True)


def synthesize(text, voice, speed):
    if not STATE["ready"] or PIPELINE is None:
        raise RuntimeError("O modelo de voz ainda esta carregando.")

    chunks = []
    with PIPELINE_LOCK:
        for _, _, audio in PIPELINE(text, voice=voice, speed=speed, split_pattern=r"\n+"):
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            samples = np.asarray(audio, dtype=np.float32).reshape(-1)
            if samples.size:
                chunks.append(samples)

    if not chunks:
        raise RuntimeError("O modelo nao gerou audio.")

    pause = np.zeros(int(24000 * 0.07), dtype=np.float32)
    joined = chunks[0]
    for chunk in chunks[1:]:
        joined = np.concatenate((joined, pause, chunk))

    output = io.BytesIO()
    sf.write(output, joined, 24000, format="WAV", subtype="PCM_16")
    return output.getvalue()


class VoiceHandler(BaseHTTPRequestHandler):
    server_version = "AlexKokoro/0.1"

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, {"error": "Nao encontrado."})
            return
        self.send_json(200, STATE)

    def do_POST(self):
        if self.path != "/v1/audio/speech":
            self.send_json(404, {"error": "Nao encontrado."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 64 * 1024:
                self.send_json(400, {"error": "Corpo vazio ou muito grande."})
                return

            payload = json.loads(self.rfile.read(length))
            text = str(payload.get("input", "")).strip()
            voice = str(payload.get("voice", "pm_alex"))
            speed = float(payload.get("speed", 0.94))
            if not text or len(text) > 1200:
                self.send_json(400, {"error": "Texto vazio ou muito longo."})
                return
            if voice not in ALLOWED_VOICES:
                self.send_json(400, {"error": "Voz masculina nao permitida."})
                return

            audio = synthesize(text, voice, min(1.25, max(0.75, speed)))
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as error:
            self.send_json(503, {"error": str(error)})

    def log_message(self, message, *args):
        print(f"Kokoro: {message % args}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Voz neural local do Alex")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()

    threading.Thread(target=initialize_pipeline, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), VoiceHandler)
    print(f"Servico Kokoro em http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

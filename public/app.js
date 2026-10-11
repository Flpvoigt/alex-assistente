const connectButton = document.querySelector("#connect");
const disconnectButton = document.querySelector("#disconnect");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#connection-badge");
const messagesElement = document.querySelector("#messages");
const orbElement = document.querySelector(".orb");

const AUDIO_SAMPLE_RATE = 24000;
const MAX_SESSION_MS = 5 * 60 * 1000;

let socket;
let microphoneStream;
let audioContext;
let microphoneSource;
let captureNode;
let silentGain;
let sessionTimer;
let nextPlaybackTime = 0;
let partialAssistantMessage;
const activeAudioSources = new Set();

function setStatus(message, state = "idle") {
  statusElement.textContent = message;
  badgeElement.textContent = state === "connected" ? "conectado" : state;
  badgeElement.dataset.state = state;
  orbElement.dataset.state = state;
}

function appendMessage(role, text, partial = false) {
  if (!text) return;
  document.querySelector(".placeholder")?.remove();

  if (partial && partialAssistantMessage) {
    partialAssistantMessage.querySelector("p").textContent += text;
    return;
  }

  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<strong>${role === "assistant" ? "Alex" : "Voce"}</strong><p></p>`;
  article.querySelector("p").textContent = text;
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;

  if (partial) partialAssistantMessage = article;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Int16Array(bytes.buffer);
}

function playPcmChunk(base64Audio) {
  if (!audioContext || !base64Audio) return;

  const pcm = base64ToInt16(base64Audio);
  const audioBuffer = audioContext.createBuffer(1, pcm.length, AUDIO_SAMPLE_RATE);
  const channel = audioBuffer.getChannelData(0);
  for (let index = 0; index < pcm.length; index += 1) {
    channel[index] = pcm[index] / 32768;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => activeAudioSources.delete(source);

  const startAt = Math.max(audioContext.currentTime, nextPlaybackTime);
  source.start(startAt);
  nextPlaybackTime = startAt + audioBuffer.duration;
  activeAudioSources.add(source);
}

function stopPlayback() {
  for (const source of activeAudioSources) {
    try {
      source.stop();
    } catch {
      // A fonte pode ter terminado entre a verificacao e a parada.
    }
  }
  activeAudioSources.clear();
  nextPlaybackTime = audioContext?.currentTime || 0;
}

function handleRealtimeEvent(event) {
  if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
    playPcmChunk(event.delta || event.audio);
  }

  if (
    event.type === "response.output_audio_transcript.delta" ||
    event.type === "response.audio_transcript.delta"
  ) {
    appendMessage("assistant", event.delta || "", true);
  }

  if (
    event.type === "response.output_audio_transcript.done" ||
    event.type === "response.audio_transcript.done"
  ) {
    partialAssistantMessage = undefined;
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    appendMessage("user", event.transcript || "");
  }

  if (event.type === "input_audio_buffer.speech_started") {
    stopPlayback();
    setStatus("Estou ouvindo...", "listening");
  }

  if (event.type === "response.created") setStatus("Pensando...", "thinking");
  if (event.type === "response.done") setStatus("Pode falar", "connected");

  if (event.type === "error") {
    console.error("Erro xAI Voice:", event);
    setStatus(event.error?.message || "Ocorreu um erro na conversa", "error");
  }
}

async function prepareAudioCapture() {
  audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  await audioContext.audioWorklet.addModule("/pcm-processor.js");
  await audioContext.resume();

  microphoneStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    }
  });

  microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
  captureNode = new AudioWorkletNode(audioContext, "pcm-capture-processor");
  silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  captureNode.port.onmessage = ({ data }) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: arrayBufferToBase64(data)
      })
    );
  };

  microphoneSource.connect(captureNode);
  captureNode.connect(silentGain);
  silentGain.connect(audioContext.destination);
}

function getEphemeralToken(payload) {
  return payload.value || payload.client_secret?.value || payload.client_secret;
}

async function connect() {
  connectButton.disabled = true;
  setStatus("Solicitando acesso ao microfone...", "connecting");

  try {
    await prepareAudioCapture();

    const credentialsResponse = await fetch("/session", { method: "POST" });
    const credentials = await credentialsResponse.json();
    if (!credentialsResponse.ok) {
      throw new Error(credentials.error || "Nao foi possivel obter um token temporario.");
    }

    const token = getEphemeralToken(credentials);
    if (!token) throw new Error("A xAI nao retornou um token temporario valido.");

    const endpoint = `wss://api.x.ai/v1/realtime?model=${encodeURIComponent(credentials.model)}`;
    socket = new WebSocket(endpoint, [`xai-client-secret.${token}`]);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "session.update", session: credentials.session }));
      setStatus("Pode falar", "connected");
      disconnectButton.disabled = false;
      sessionTimer = window.setTimeout(() => {
        disconnect("Sessao encerrada apos 5 minutos para controlar custos.");
      }, MAX_SESSION_MS);
    });

    socket.addEventListener("message", ({ data }) => {
      if (typeof data === "string") handleRealtimeEvent(JSON.parse(data));
    });

    socket.addEventListener("error", (error) => {
      console.error("Falha no WebSocket da xAI:", error);
      setStatus("Falha na conexao com a xAI", "error");
    });

    socket.addEventListener("close", () => disconnect());
  } catch (error) {
    console.error(error);
    disconnect();
    setStatus("Falha ao iniciar. Verifique a chave e o microfone.", "error");
  }
}

function disconnect(finalMessage) {
  window.clearTimeout(sessionTimer);
  stopPlayback();

  if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  microphoneStream?.getTracks().forEach((track) => track.stop());
  captureNode?.disconnect();
  microphoneSource?.disconnect();
  silentGain?.disconnect();
  audioContext?.close();

  socket = undefined;
  microphoneStream = undefined;
  captureNode = undefined;
  microphoneSource = undefined;
  silentGain = undefined;
  audioContext = undefined;
  partialAssistantMessage = undefined;

  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus(finalMessage || "Pronto para iniciar", "idle");
}

connectButton.addEventListener("click", connect);
disconnectButton.addEventListener("click", () => disconnect());


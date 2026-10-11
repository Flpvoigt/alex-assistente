import { listPortugueseMaleVoices } from "./voice.mjs";

const connectButton = document.querySelector("#connect");
const disconnectButton = document.querySelector("#disconnect");
const voiceSelect = document.querySelector("#voice");
const previewVoiceButton = document.querySelector("#preview-voice");
const voiceNote = document.querySelector("#voice-note");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#connection-badge");
const messagesElement = document.querySelector("#messages");
const orbElement = document.querySelector(".orb");

const SILENCE_THRESHOLD = 0.025;
const SILENCE_DURATION_MS = 850;
const NO_SPEECH_TIMEOUT_MS = 12000;
const MAX_RECORDING_MS = 30000;
const KOKORO_VOICE_VALUE = "kokoro:pm_alex";

let conversationActive = false;
let phase = "idle";
let turnId = 0;
let microphoneStream;
let mediaRecorder;
let audioContext;
let analyser;
let animationFrame;
let resumeTimer;
let requestAbort;
let audioChunks = [];
let shouldProcessRecording = true;
let conversationHistory = [];
let responseStreaming = false;
let speechBuffer = "";
let pendingSpeechParts = 0;
let partialAssistantText = "";
const activeUtterances = new Set();
const speechRequestControllers = new Set();
let availableVoices = [];
let selectedVoice;
let selectedVoiceMode = "system";
let neuralVoiceReady = false;
let neuralVoiceState = "loading";
let activeAudioCancel;
let speechPlaybackQueue = Promise.resolve();
let speechGeneration = 0;

function setPhase(nextPhase, message) {
  phase = nextPhase;
  statusElement.textContent = message;
  badgeElement.textContent = conversationActive ? "conversa ativa" : "desconectado";
  badgeElement.dataset.state = nextPhase === "error" ? "error" : conversationActive ? "connected" : "idle";
  orbElement.dataset.state = nextPhase;

  if (!conversationActive) {
    connectButton.textContent = "Iniciar conversa";
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    return;
  }

  disconnectButton.disabled = false;
  if (nextPhase === "listening") {
    connectButton.textContent = "Ouvindo...";
    connectButton.disabled = true;
  } else {
    connectButton.textContent = "Interromper e falar";
    connectButton.disabled = false;
  }
}

function beginMessage(role, text = "") {
  document.querySelector(".placeholder")?.remove();
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<strong>${role === "assistant" ? "Alex" : "Voce"}</strong><p></p>`;
  article.querySelector("p").textContent = text;
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return article.querySelector("p");
}

function chooseMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function cleanupMicrophone() {
  cancelAnimationFrame(animationFrame);
  microphoneStream?.getTracks().forEach((track) => track.stop());
  audioContext?.close();
  microphoneStream = undefined;
  audioContext = undefined;
  analyser = undefined;
  mediaRecorder = undefined;
}

function scheduleListening(delay = 250) {
  clearTimeout(resumeTimer);
  if (!conversationActive) return;
  resumeTimer = window.setTimeout(() => beginRecording(), delay);
}

function watchForSilence(startedAt) {
  const samples = new Uint8Array(analyser.fftSize);
  let speechDetected = false;
  let silenceStartedAt;

  const inspect = () => {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }
    const volume = Math.sqrt(sum / samples.length);
    const now = performance.now();

    if (volume > SILENCE_THRESHOLD) {
      speechDetected = true;
      silenceStartedAt = undefined;
    } else if (speechDetected) {
      silenceStartedAt ??= now;
      if (now - silenceStartedAt >= SILENCE_DURATION_MS) {
        stopRecording(true);
        return;
      }
    }

    if (now - startedAt >= MAX_RECORDING_MS) {
      stopRecording(speechDetected);
      return;
    }

    if (!speechDetected && now - startedAt >= NO_SPEECH_TIMEOUT_MS) {
      stopRecording(false);
      return;
    }

    animationFrame = requestAnimationFrame(inspect);
  };

  inspect();
}

async function beginRecording() {
  if (!conversationActive || phase === "listening") return;
  const thisTurn = ++turnId;
  cleanupMicrophone();
  setPhase("connecting", "Preparando o microfone...");

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });

    if (!conversationActive || thisTurn !== turnId) {
      cleanupMicrophone();
      return;
    }

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    audioChunks = [];
    shouldProcessRecording = true;
    const mimeType = chooseMimeType();
    const recorder = mimeType
      ? new MediaRecorder(microphoneStream, { mimeType })
      : new MediaRecorder(microphoneStream);
    mediaRecorder = recorder;

    recorder.addEventListener("dataavailable", ({ data }) => {
      if (data.size) audioChunks.push(data);
    });

    recorder.addEventListener("stop", async () => {
      const recordingType = recorder.mimeType || mimeType || "audio/webm";
      const recording = new Blob(audioChunks, { type: recordingType });
      const processRecording = shouldProcessRecording;
      cleanupMicrophone();

      if (!conversationActive || thisTurn !== turnId) return;
      if (processRecording && recording.size > 500) await processAudio(recording, thisTurn);
      else {
        setPhase("connecting", "Aguardando sua voz...");
        scheduleListening(150);
      }
    });

    recorder.start();
    setPhase("listening", "Pode falar com o Alex.");
    watchForSilence(performance.now());
  } catch (error) {
    console.error(error);
    cleanupMicrophone();
    conversationActive = false;
    setPhase("error", "Nao foi possivel acessar o microfone.");
  }
}

function stopRecording(processRecording) {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  shouldProcessRecording = processRecording;
  cancelAnimationFrame(animationFrame);
  mediaRecorder.stop();
  if (processRecording) setPhase("thinking", "Entendendo sua fala...");
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Falha na comunicacao com o servidor.");
  return data;
}

function savedVoiceUri() {
  try {
    return localStorage.getItem("alex.voiceUri") || "";
  } catch {
    return "";
  }
}

function refreshVoices() {
  const saved = savedVoiceUri();
  const systemVoices = "speechSynthesis" in window ? window.speechSynthesis.getVoices() : [];
  availableVoices = listPortugueseMaleVoices(systemVoices, saved);
  voiceSelect.replaceChildren();

  if (neuralVoiceReady) {
    voiceSelect.add(new Option("Alex Neural — Kokoro local (recomendado)", KOKORO_VOICE_VALUE));
  }

  for (const voice of availableVoices) {
    const quality = /natural|neural|premium|enhanced|eddy/i.test(voice.name) ? " — suave" : "";
    voiceSelect.add(new Option(`${voice.name}${quality}`, voice.voiceURI));
  }

  if (!voiceSelect.options.length) {
    const loading = neuralVoiceState === "loading";
    const option = new Option(
      loading ? "Preparando Alex Neural..." : "Nenhuma voz masculina disponivel",
      ""
    );
    voiceSelect.add(option);
    voiceSelect.disabled = true;
    previewVoiceButton.disabled = true;
    selectedVoice = undefined;
    selectedVoiceMode = "system";
    voiceNote.textContent = loading
      ? "O primeiro carregamento da voz gratuita pode levar alguns minutos."
      : "Execute npm run voice:setup para instalar a voz neural gratuita.";
    return;
  }

  voiceSelect.disabled = conversationActive;
  previewVoiceButton.disabled = conversationActive;
  const values = [...voiceSelect.options].map((option) => option.value);
  voiceSelect.value = values.includes(saved)
    ? saved
    : neuralVoiceReady
      ? KOKORO_VOICE_VALUE
      : availableVoices[0].voiceURI;
  applyVoiceSelection(false);
}

function applyVoiceSelection(persist = true) {
  selectedVoiceMode = voiceSelect.value === KOKORO_VOICE_VALUE ? "kokoro" : "system";
  if (selectedVoiceMode === "system") {
    selectedVoice = availableVoices.find((voice) => voice.voiceURI === voiceSelect.value);
  } else {
    selectedVoice = availableVoices[0];
  }

  if (persist) {
    try {
      localStorage.setItem("alex.voiceUri", voiceSelect.value);
    } catch {
      // A escolha continua valida nesta pagina quando o armazenamento estiver bloqueado.
    }
  }

  voiceNote.textContent =
    selectedVoiceMode === "kokoro"
      ? "Alex Neural usa Kokoro local: masculino, brasileiro e sem custo por fala."
      : `Reserva do sistema: ${selectedVoice?.name || "indisponivel"}.`;
}

async function refreshNeuralVoiceStatus() {
  try {
    const response = await fetch("/api/voice/status", { cache: "no-store" });
    const data = await response.json();
    neuralVoiceReady = response.ok && data.ready === true;
    neuralVoiceState = data.state || (neuralVoiceReady ? "ready" : "unavailable");
  } catch {
    neuralVoiceReady = false;
    neuralVoiceState = "unavailable";
  }

  refreshVoices();
  if (!neuralVoiceReady) {
    window.setTimeout(refreshNeuralVoiceStatus, 2500);
  }
}

async function requestNeuralSpeech(text, signal) {
  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Voz neural indisponivel.");
  }
  return response.blob();
}

function playAudioBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      activeAudioCancel = undefined;
      if (error) reject(error);
      else resolve();
    };
    activeAudioCancel = () => {
      audio.pause();
      finish();
    };
    audio.addEventListener("ended", () => finish(), { once: true });
    audio.addEventListener("error", () => finish(new Error("Falha ao reproduzir a voz neural.")), {
      once: true
    });
    audio.play().catch(finish);
  });
}

function speakWithSystem(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !selectedVoice) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.96;
    utterance.pitch = 0.96;
    utterance.voice = selectedVoice;
    activeUtterances.add(utterance);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      activeUtterances.delete(utterance);
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  });
}

function stopSpeechPlayback() {
  speechGeneration += 1;
  for (const controller of speechRequestControllers) controller.abort();
  speechRequestControllers.clear();
  activeAudioCancel?.();
  activeAudioCancel = undefined;
  window.speechSynthesis?.cancel();
  activeUtterances.clear();
  pendingSpeechParts = 0;
  speechPlaybackQueue = Promise.resolve();
}

async function speakPreview() {
  if (conversationActive || !voiceSelect.value) return;
  stopSpeechPlayback();
  const text = "Olá, eu sou o Alex. Estou pronto para conversar com você.";
  if (selectedVoiceMode === "kokoro") {
    const controller = new AbortController();
    speechRequestControllers.add(controller);
    try {
      const audio = await requestNeuralSpeech(text, controller.signal);
      speechRequestControllers.delete(controller);
      await playAudioBlob(audio);
    } catch (error) {
      speechRequestControllers.delete(controller);
      if (error.name !== "AbortError") {
        voiceNote.textContent = `${error.message} Usando a voz masculina do sistema como reserva.`;
        await speakWithSystem(text);
      }
    }
    return;
  }
  await speakWithSystem(text);
}

function maybeResumeListening() {
  if (!conversationActive || responseStreaming || pendingSpeechParts > 0) return;
  partialAssistantText = "";
  setPhase("connecting", "Preparando para ouvir novamente...");
  scheduleListening(250);
}

function queueSpeech(text) {
  const spokenText = text.trim();
  if (!spokenText) return;

  const generation = speechGeneration;
  const useNeuralVoice = selectedVoiceMode === "kokoro" && neuralVoiceReady;
  let neuralRequest;
  if (useNeuralVoice) {
    const controller = new AbortController();
    speechRequestControllers.add(controller);
    neuralRequest = requestNeuralSpeech(spokenText, controller.signal)
      .then((audio) => ({ audio }))
      .catch((error) => ({ error }))
      .finally(() => speechRequestControllers.delete(controller));
  }

  pendingSpeechParts += 1;
  const playPart = speechPlaybackQueue
    .catch(() => {})
    .then(async () => {
      if (generation !== speechGeneration || !conversationActive) return;
      setPhase("speaking", "Alex esta respondendo...");
      if (!neuralRequest) {
        await speakWithSystem(spokenText);
        return;
      }

      const result = await neuralRequest;
      if (generation !== speechGeneration || !conversationActive) return;
      if (result.error) {
        if (result.error.name !== "AbortError") {
          console.warn("Voz neural indisponivel, usando reserva:", result.error);
          await speakWithSystem(spokenText);
        }
        return;
      }
      await playAudioBlob(result.audio);
    })
    .catch((error) => console.error("Falha ao reproduzir voz:", error))
    .finally(() => {
      if (generation !== speechGeneration) return;
      pendingSpeechParts = Math.max(0, pendingSpeechParts - 1);
      maybeResumeListening();
    });
  speechPlaybackQueue = playPart;
}

function feedSpeech(delta, flush = false) {
  speechBuffer += delta;

  while (speechBuffer) {
    const boundary = speechBuffer.search(/[.!?…](?:\s|$)/);
    if (boundary < 0 && !flush) break;
    const end = boundary < 0 ? speechBuffer.length : boundary + 1;
    const sentence = speechBuffer.slice(0, end).trim();
    speechBuffer = speechBuffer.slice(end).trimStart();
    queueSpeech(sentence);
  }
}

async function streamAnswer(message, history, onDelta, signal) {
  const response = await fetch("/api/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Falha ao gerar resposta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const event = JSON.parse(payload);
        const delta = event.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      }
    }

    if (done) break;
  }
}

async function processAudio(recording, thisTurn) {
  requestAbort = new AbortController();

  try {
    const transcription = await requestJson("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": recording.type || "audio/webm" },
      body: recording,
      signal: requestAbort.signal
    });

    if (!conversationActive || thisTurn !== turnId) return;
    if (!transcription.text) {
      scheduleListening();
      return;
    }

    const previousHistory = [...conversationHistory];
    beginMessage("user", transcription.text);
    conversationHistory.push({ role: "user", content: transcription.text });
    setPhase("thinking", "Alex esta pensando...");

    let assistantParagraph;
    partialAssistantText = "";
    speechBuffer = "";
    responseStreaming = true;
    pendingSpeechParts = 0;

    await streamAnswer(
      transcription.text,
      previousHistory,
      (delta) => {
        if (!conversationActive || thisTurn !== turnId) return;
        if (!assistantParagraph) assistantParagraph = beginMessage("assistant");
        partialAssistantText += delta;
        assistantParagraph.textContent = partialAssistantText;
        messagesElement.scrollTop = messagesElement.scrollHeight;
        feedSpeech(delta);
      },
      requestAbort.signal
    );

    if (!conversationActive || thisTurn !== turnId) return;
    responseStreaming = false;
    feedSpeech("", true);

    if (!partialAssistantText.trim()) throw new Error("A Groq retornou uma resposta vazia.");
    conversationHistory.push({ role: "assistant", content: partialAssistantText.trim() });
    conversationHistory = conversationHistory.slice(-12);
    maybeResumeListening();
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    responseStreaming = false;
    if (conversationActive && thisTurn === turnId) {
      setPhase("error", error.message || "Nao foi possivel obter uma resposta.");
      scheduleListening(1200);
    }
  }
}

function cancelCurrentResponse() {
  requestAbort?.abort();
  requestAbort = undefined;
  responseStreaming = false;
  speechBuffer = "";
  stopSpeechPlayback();

  if (partialAssistantText.trim()) {
    conversationHistory.push({ role: "assistant", content: partialAssistantText.trim() });
    conversationHistory = conversationHistory.slice(-12);
  }
  partialAssistantText = "";
}

function interruptAndListen() {
  if (!conversationActive || phase === "listening") return;
  clearTimeout(resumeTimer);
  cancelCurrentResponse();
  beginRecording();
}

function startConversation() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setPhase("error", "Este navegador nao oferece gravacao de voz compativel.");
    return;
  }
  if (!neuralVoiceReady && !selectedVoice) {
    setPhase("error", "Execute npm run voice:setup para instalar a voz do Alex.");
    return;
  }

  conversationActive = true;
  stopSpeechPlayback();
  voiceSelect.disabled = true;
  previewVoiceButton.disabled = true;
  setPhase("connecting", "Iniciando conversa...");
  beginRecording();
}

function endConversation() {
  conversationActive = false;
  turnId += 1;
  clearTimeout(resumeTimer);
  cancelCurrentResponse();
  if (mediaRecorder?.state === "recording") stopRecording(false);
  cleanupMicrophone();
  voiceSelect.disabled = !voiceSelect.value;
  previewVoiceButton.disabled = !voiceSelect.value;
  setPhase("idle", "Conversa encerrada.");
}

connectButton.addEventListener("click", () => {
  if (!conversationActive) startConversation();
  else interruptAndListen();
});
disconnectButton.addEventListener("click", endConversation);

voiceSelect.addEventListener("change", () => {
  applyVoiceSelection();
});

previewVoiceButton.addEventListener("click", speakPreview);
window.speechSynthesis?.addEventListener?.("voiceschanged", refreshVoices);
refreshVoices();
refreshNeuralVoiceStatus();


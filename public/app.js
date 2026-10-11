const connectButton = document.querySelector("#connect");
const disconnectButton = document.querySelector("#disconnect");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#connection-badge");
const messagesElement = document.querySelector("#messages");
const orbElement = document.querySelector(".orb");

const SILENCE_THRESHOLD = 0.025;
const SILENCE_DURATION_MS = 900;
const NO_SPEECH_TIMEOUT_MS = 5000;
const MAX_RECORDING_MS = 15000;

let microphoneStream;
let mediaRecorder;
let audioContext;
let analyser;
let animationFrame;
let audioChunks = [];
let shouldProcessRecording = true;
let conversationHistory = [];

function setStatus(message, state = "idle") {
  statusElement.textContent = message;
  badgeElement.textContent = state === "connected" ? "pronto" : state;
  badgeElement.dataset.state = state;
  orbElement.dataset.state = state;
}

function appendMessage(role, text) {
  if (!text) return;
  document.querySelector(".placeholder")?.remove();

  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<strong>${role === "assistant" ? "Alex" : "Voce"}</strong><p></p>`;
  article.querySelector("p").textContent = text;
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
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

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("Este navegador nao oferece gravacao de voz compativel.", "error");
    return;
  }

  connectButton.disabled = true;
  disconnectButton.disabled = false;
  window.speechSynthesis?.cancel();
  setStatus("Solicitando acesso ao microfone...", "connecting");

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    });

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    audioChunks = [];
    shouldProcessRecording = true;
    const mimeType = chooseMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(microphoneStream, { mimeType })
      : new MediaRecorder(microphoneStream);

    mediaRecorder.addEventListener("dataavailable", ({ data }) => {
      if (data.size) audioChunks.push(data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      const recordingType = mediaRecorder?.mimeType || mimeType || "audio/webm";
      const recording = new Blob(audioChunks, { type: recordingType });
      const processRecording = shouldProcessRecording;
      cleanupMicrophone();

      if (processRecording && recording.size > 500) await processAudio(recording);
      else resetControls("Nao ouvi nenhuma fala. Tente novamente.");
    });

    mediaRecorder.start();
    setStatus("Estou ouvindo...", "listening");
    watchForSilence(performance.now());
  } catch (error) {
    console.error(error);
    cleanupMicrophone();
    resetControls("Nao foi possivel acessar o microfone.", "error");
  }
}

function stopRecording(processRecording) {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  shouldProcessRecording = processRecording;
  cancelAnimationFrame(animationFrame);
  mediaRecorder.stop();
  if (processRecording) setStatus("Entendendo sua fala...", "thinking");
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Falha na comunicacao com o servidor.");
  return data;
}

async function processAudio(recording) {
  try {
    const transcription = await requestJson("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": recording.type || "audio/webm" },
      body: recording
    });

    if (!transcription.text) {
      resetControls("Nao consegui entender. Tente novamente.");
      return;
    }

    const previousHistory = [...conversationHistory];
    appendMessage("user", transcription.text);
    conversationHistory.push({ role: "user", content: transcription.text });
    setStatus("Pensando...", "thinking");

    const answer = await requestJson("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: transcription.text,
        history: previousHistory
      })
    });

    appendMessage("assistant", answer.text);
    conversationHistory.push({ role: "assistant", content: answer.text });
    conversationHistory = conversationHistory.slice(-12);
    speak(answer.text);
  } catch (error) {
    console.error(error);
    resetControls(error.message || "Nao foi possivel obter uma resposta.", "error");
  }
}

function choosePortugueseVoice() {
  const voices = speechSynthesis.getVoices();
  const portuguese = voices.filter((voice) => voice.lang.toLowerCase().startsWith("pt"));
  return (
    portuguese.find((voice) => /premium|enhanced|natural|maria|luciana|francisca/i.test(voice.name)) ||
    portuguese.find((voice) => voice.lang.toLowerCase() === "pt-br") ||
    portuguese[0]
  );
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    resetControls("Resposta recebida. Voz local indisponivel neste navegador.");
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1.02;
  utterance.pitch = 1;
  utterance.voice = choosePortugueseVoice() || null;
  utterance.onstart = () => setStatus("Respondendo...", "connected");
  utterance.onend = () => resetControls("Pronto para ouvir novamente.");
  utterance.onerror = () => resetControls("Resposta exibida; houve uma falha na voz local.");
  speechSynthesis.speak(utterance);
}

function resetControls(message = "Pronto para iniciar", state = "idle") {
  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus(message, state);
}

function stopEverything() {
  window.speechSynthesis?.cancel();
  if (mediaRecorder?.state === "recording") stopRecording(false);
  else {
    cleanupMicrophone();
    resetControls();
  }
}

connectButton.addEventListener("click", startRecording);
disconnectButton.addEventListener("click", stopEverything);


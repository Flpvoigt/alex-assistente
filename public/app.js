const connectButton = document.querySelector("#connect");
const disconnectButton = document.querySelector("#disconnect");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#connection-badge");
const messagesElement = document.querySelector("#messages");
const orbElement = document.querySelector(".orb");

let peerConnection;
let dataChannel;
let microphoneStream;
let audioElement;
let partialAssistantMessage;

function setStatus(message, state = "idle") {
  statusElement.textContent = message;
  badgeElement.textContent = state === "connected" ? "conectado" : state;
  badgeElement.dataset.state = state;
  orbElement.dataset.state = state;
}

function appendMessage(role, text, partial = false) {
  document.querySelector(".placeholder")?.remove();

  if (partial && partialAssistantMessage) {
    partialAssistantMessage.querySelector("p").textContent += text;
    return partialAssistantMessage;
  }

  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<strong>${role === "assistant" ? "Alex" : "Voce"}</strong><p></p>`;
  article.querySelector("p").textContent = text;
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;

  if (partial) partialAssistantMessage = article;
  return article;
}

function handleRealtimeEvent(event) {
  if (event.type === "response.output_audio_transcript.delta") {
    appendMessage("assistant", event.delta || "", true);
  }

  if (event.type === "response.output_audio_transcript.done") {
    partialAssistantMessage = undefined;
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    appendMessage("user", event.transcript || "");
  }

  if (event.type === "input_audio_buffer.speech_started") {
    setStatus("Estou ouvindo...", "listening");
  }

  if (event.type === "response.created") {
    setStatus("Pensando...", "thinking");
  }

  if (event.type === "response.done") {
    setStatus("Pode falar", "connected");
  }

  if (event.type === "error") {
    console.error("Erro Realtime:", event);
    setStatus(event.error?.message || "Ocorreu um erro na conversa", "error");
  }
}

async function connect() {
  connectButton.disabled = true;
  setStatus("Solicitando acesso ao microfone...", "connecting");

  try {
    peerConnection = new RTCPeerConnection();
    audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    peerConnection.ontrack = (event) => {
      audioElement.srcObject = event.streams[0];
    };

    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    microphoneStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, microphoneStream);
    });

    dataChannel = peerConnection.createDataChannel("oai-events");
    dataChannel.addEventListener("open", () => {
      setStatus("Pode falar", "connected");
      disconnectButton.disabled = false;
    });
    dataChannel.addEventListener("message", (message) => {
      handleRealtimeEvent(JSON.parse(message.data));
    });
    dataChannel.addEventListener("close", disconnect);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const sessionResponse = await fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!sessionResponse.ok) {
      const details = await sessionResponse.text();
      throw new Error(details || "Nao foi possivel iniciar a sessao.");
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await sessionResponse.text()
    });
  } catch (error) {
    console.error(error);
    disconnect();
    setStatus("Falha ao iniciar. Verifique a chave e o microfone.", "error");
  }
}

function disconnect() {
  dataChannel?.close();
  microphoneStream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
  audioElement?.remove();

  dataChannel = undefined;
  microphoneStream = undefined;
  peerConnection = undefined;
  audioElement = undefined;
  partialAssistantMessage = undefined;

  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus("Pronto para iniciar", "idle");
}

connectButton.addEventListener("click", connect);
disconnectButton.addEventListener("click", disconnect);


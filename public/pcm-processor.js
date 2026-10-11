class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(2048);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    let sourceOffset = 0;
    while (sourceOffset < channel.length) {
      const available = this.samples.length - this.offset;
      const length = Math.min(available, channel.length - sourceOffset);
      this.samples.set(channel.subarray(sourceOffset, sourceOffset + length), this.offset);
      this.offset += length;
      sourceOffset += length;

      if (this.offset === this.samples.length) {
        const pcm = new Int16Array(this.samples.length);
        for (let index = 0; index < this.samples.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, this.samples[index]));
          pcm[index] = sample < 0 ? sample * 32768 : sample * 32767;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);


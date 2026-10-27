class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;

    this.port.onmessage = (event) => {
      if (event.data === "start") {
        this.recording = true;
      } else if (event.data === "stop") {
        this.recording = false;

        // Confirm that capture has been disabled.
        // Previously posted audio chunks precede this acknowledgement.
        this.port.postMessage({ type: "stopped" });
      }
    };
  }

  process(inputs, outputs) {
    // Keep the connected output silent; the microphone is for recording only.
    const output = outputs[0];

    if (output) {
      for (const outputChannel of output) {
        outputChannel.fill(0);
      }
    }

    const input = inputs[0];

    if (this.recording && input && input.length > 0) {
      const channelCount = input.length;
      const frameCount = input[0].length;
      const mono = new Float32Array(frameCount);

      // Downmix to mono by averaging the available input channels.
      for (let channel = 0; channel < channelCount; channel++) {
        const channelSamples = input[channel];

        for (let frame = 0; frame < frameCount; frame++) {
          mono[frame] += channelSamples[frame] / channelCount;
        }
      }

      // Transfer the buffer to the page instead of copying it.
      this.port.postMessage(mono, [mono.buffer]);
    }

    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);

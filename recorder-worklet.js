
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;

    this.port.onmessage = (event) => {
      if (event.data === "start") {
        this.recording = true;
      } else if (event.data === "stop") {
        this.recording = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];

    if (this.recording && input && input.length > 0) {
      const channels = input.length;
      const frames = input[0].length;
      const mono = new Float32Array(frames);

      for (let channel = 0; channel < channels; channel++) {
        const samples = input[channel];
        for (let i = 0; i < frames; i++) {
          mono[i] += samples[i] / channels;
        }
      }

      this.port.postMessage(mono);
    }

    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);

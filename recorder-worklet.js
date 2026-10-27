class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.resetStats();

    this.port.onmessage = (event) => {
      if (event.data === "start") {
        this.resetStats();
        this.recording = true;
      } else if (event.data === "stop") {
        this.recording = false;
        // All audio chunks posted before this message are delivered first.
        this.port.postMessage({ type: "stopped", stats: this.getStats() });
      }
    };
  }

  resetStats() {
    this.inputFrames = 0;
    this.channelStats = [];
    this.mixedFrames = 0;
    this.mixedSumSquares = 0;
    this.mixedPeak = 0;
    this.channelCount = 0;
  }

  getStats() {
    return {
      channelCount: this.channelCount,
      channels: this.channelStats.map((stats, index) => ({
        channel: index + 1,
        frames: stats.frames,
        peak: stats.peak,
        rms: stats.frames ? Math.sqrt(stats.sumSquares / stats.frames) : 0
      })),
      mixed: {
        frames: this.mixedFrames,
        peak: this.mixedPeak,
        rms: this.mixedFrames ? Math.sqrt(this.mixedSumSquares / this.mixedFrames) : 0
      }
    };
  }

  process(inputs, outputs) {
    // Keep the connected output silent; the microphone is for recording only.
    const output = outputs[0];
    if (output) {
      for (const outputChannel of output) outputChannel.fill(0);
    }

    const input = inputs[0];
    if (this.recording && input && input.length > 0) {
      const channelCount = input.length;
      const frameCount = input[0].length;
      this.channelCount = Math.max(this.channelCount, channelCount);

      while (this.channelStats.length < channelCount) {
        this.channelStats.push({ frames: 0, sumSquares: 0, peak: 0 });
      }

      const mono = new Float32Array(frameCount);
      for (let channel = 0; channel < channelCount; channel++) {
        const channelSamples = input[channel];
        const stats = this.channelStats[channel];
        stats.frames += frameCount;

        for (let frame = 0; frame < frameCount; frame++) {
          const sample = Number.isFinite(channelSamples[frame]) ? channelSamples[frame] : 0;
          const absolute = Math.abs(sample);
          if (absolute > stats.peak) stats.peak = absolute;
          stats.sumSquares += sample * sample;
          mono[frame] += sample / channelCount;
        }
      }

      this.mixedFrames += frameCount;
      for (let frame = 0; frame < frameCount; frame++) {
        const absolute = Math.abs(mono[frame]);
        if (absolute > this.mixedPeak) this.mixedPeak = absolute;
        this.mixedSumSquares += mono[frame] * mono[frame];
      }

      // Transfer the buffer to the page instead of copying it.
      this.port.postMessage(mono, [mono.buffer]);
    }

    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);

/**
 * StudAI — Synthesizer Sound System (Web Audio API)
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.ambientNode = null;
    this.ambientGain = null;
    this.isAmbientPlaying = false;
    this.currentAmbientType = null;
    this.stopTimeout = null;
  }

  getAudioContext() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playPop() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio playback silently catches
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio playback silently catches
    }
  }

  playLevelUp() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      osc.frequency.setValueAtTime(554, now + 0.2);
      osc.frequency.setValueAtTime(659, now + 0.3);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio playback silently catches
    }
  }

  // --- Ambient Focus Sound Generator ---
  startAmbient(type = "rain", volume = 0.2) {
    // Interrompe imediatamente qualquer transição de stop pendente
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    if (this.ambientNode) {
      try { this.ambientNode.stop(); } catch {}
      this.ambientNode = null;
    }

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (!this.ambientGain) {
        this.ambientGain = ctx.createGain();
        this.ambientGain.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      const targetVol = Math.min(1, Math.max(0, volume));
      
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value || 0.01, now);
      this.ambientGain.gain.linearRampToValueAtTime(targetVol, now + 0.8);

      if (type === "rain") {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, now);

        noise.connect(filter);
        filter.connect(this.ambientGain);
        noise.start();
        this.ambientNode = noise;

      } else if (type === "white") {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.15;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3200, now);

        noise.connect(filter);
        filter.connect(this.ambientGain);
        noise.start();
        this.ambientNode = noise;

      } else if (type === "binaural") {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = "sine";
        oscR.type = "sine";
        oscL.frequency.setValueAtTime(216, now);
        oscR.frequency.setValueAtTime(256, now); // 40 Hz difference

        const merger = ctx.createChannelMerger(2);
        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(this.ambientGain);

        oscL.start();
        oscR.start();
        this.ambientNode = {
          stop: () => {
            try { oscL.stop(); oscR.stop(); } catch {}
          }
        };
      }

      this.currentAmbientType = type;
      this.isAmbientPlaying = true;
    } catch (err) {
      console.warn("Could not start ambient sound:", err);
    }
  }

  setAmbientVolume(volume) {
    if (this.ambientGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const safe = Math.min(1, Math.max(0, volume));
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setValueAtTime(safe, now);
      } catch {}
    }
  }

  stopAmbient() {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
    }

    if (this.ambientGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      } catch {}
    }

    this.stopTimeout = setTimeout(() => {
      if (this.ambientNode) {
        try { this.ambientNode.stop(); } catch {}
        this.ambientNode = null;
      }
      this.isAmbientPlaying = false;
      this.currentAmbientType = null;
      this.stopTimeout = null;
    }, 450);
  }

  toggleAmbient(type = "rain") {
    if (this.isAmbientPlaying && this.currentAmbientType === type) {
      this.stopAmbient();
      return false;
    } else {
      this.startAmbient(type, 0.25);
      return true;
    }
  }
}

export const sounds = new SoundManager();
// ============================================================
// sounds.js — Звуки через Web Audio API
// ============================================================

const Sounds = {
    _ctx: null,

    _getCtx() {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        return this._ctx;
    },

    _tone(freq, duration, type, vol) {
        const ctx = this._getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },

    bark() {
        const ctx = this._getCtx();
        const now = ctx.currentTime;
        this._naturalBark(now, 280, 0.18, 0.15);
        this._naturalBark(now + 0.22, 220, 0.22, 0.18);
    },

    _naturalBark(startTime, baseFreq, duration, peakVol) {
        const ctx = this._getCtx();
        const end = startTime + duration;

        const vocal = ctx.createOscillator();
        vocal.type = 'triangle';
        vocal.frequency.setValueAtTime(baseFreq * 1.2, startTime);
        vocal.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, end);

        const sub = ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(baseFreq * 0.5, startTime);
        sub.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, end);

        const bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.5;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass'; f1.frequency.setValueAtTime(500, startTime); f1.Q.setValueAtTime(4, startTime);
        const f2 = ctx.createBiquadFilter();
        f2.type = 'bandpass'; f2.frequency.setValueAtTime(1200, startTime); f2.Q.setValueAtTime(3, startTime);
        const f3 = ctx.createBiquadFilter();
        f3.type = 'bandpass'; f3.frequency.setValueAtTime(2500, startTime); f3.Q.setValueAtTime(2, startTime);

        const vocalGain = ctx.createGain(); vocalGain.gain.setValueAtTime(0.7, startTime);
        const subGain = ctx.createGain(); subGain.gain.setValueAtTime(0.3, startTime);
        const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.4, startTime);
        const f1Gain = ctx.createGain(); f1Gain.gain.setValueAtTime(1.0, startTime);
        const f2Gain = ctx.createGain(); f2Gain.gain.setValueAtTime(0.5, startTime);
        const f3Gain = ctx.createGain(); f3Gain.gain.setValueAtTime(0.2, startTime);

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.001, startTime);
        master.gain.linearRampToValueAtTime(peakVol, startTime + 0.015);
        master.gain.setValueAtTime(peakVol * 0.9, startTime + duration * 0.3);
        master.gain.exponentialRampToValueAtTime(0.001, end);

        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(3000, startTime);
        lpf.frequency.linearRampToValueAtTime(1500, end);

        vocal.connect(vocalGain); sub.connect(subGain); noise.connect(noiseGain);

        const mixer = ctx.createGain(); mixer.gain.setValueAtTime(1, startTime);
        vocalGain.connect(f1); vocalGain.connect(f2); vocalGain.connect(f3);
        subGain.connect(f1);
        noiseGain.connect(f1); noiseGain.connect(f2); noiseGain.connect(f3);

        f1.connect(f1Gain); f1Gain.connect(mixer);
        f2.connect(f2Gain); f2Gain.connect(mixer);
        f3.connect(f3Gain); f3Gain.connect(mixer);

        mixer.connect(lpf); lpf.connect(master); master.connect(ctx.destination);

        vocal.start(startTime); vocal.stop(end + 0.01);
        sub.start(startTime); sub.stop(end + 0.01);
        noise.start(startTime); noise.stop(end + 0.01);
    },

    pickup() {
        this._tone(800, 0.08, 'sine', 0.12);
        setTimeout(() => this._tone(1200, 0.12, 'sine', 0.1), 80);
    },

    step() { this._tone(100 + Math.random() * 50, 0.05, 'triangle', 0.05); },
    wing() { this._tone(200 + Math.random() * 100, 0.08, 'sine', 0.04); },
    place() { this._tone(300, 0.06, 'square', 0.08); },
    break() { this._tone(150, 0.1, 'sawtooth', 0.08); },

    tame() {
        [600, 800, 1000, 1200].forEach((f, i) =>
            setTimeout(() => this._tone(f, 0.15, 'sine', 0.1), i * 120)
        );
    },

    // New sounds for Part 2
    splash() {
        // Short noise burst for water
        const ctx = this._getCtx();
        const bufSize = Math.floor(ctx.sampleRate * 0.15);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        src.stop(ctx.currentTime + 0.15);
    },

    roar() {
        // Dragon roar — low rumble
        const ctx = this._getCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
        // Second harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(160, now);
        osc2.frequency.exponentialRampToValueAtTime(60, now + 0.4);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.08, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.4);
    },

    meow() {
        // High pitched meow
        this._tone(600, 0.1, 'sine', 0.08);
        setTimeout(() => this._tone(800, 0.15, 'sine', 0.06), 100);
    },

    squeak() {
        // Hamster squeak — very high
        this._tone(1500, 0.06, 'sine', 0.08);
        setTimeout(() => this._tone(1800, 0.08, 'sine', 0.06), 70);
    }
};

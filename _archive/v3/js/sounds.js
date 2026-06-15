// ============================================================
// sounds.js — Звуки через Web Audio API (v2)
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

    // Реалистичный лай "Гав!"
    bark() {
        const ctx = this._getCtx();
        const now = ctx.currentTime;
        // Первый слог "Г" (резкий)
        this._barkSyllable(now, 350, 0.12, 0.08);
        // Второй слог "АВ" (ниже, длиннее)
        this._barkSyllable(now + 0.1, 250, 0.18, 0.15);
    },

    _barkSyllable(startTime, baseFreq, duration, vol) {
        const ctx = this._getCtx();

        // Основной тон
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(baseFreq, startTime);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, startTime + duration);

        // Гармоник
        const osc2 = ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(baseFreq * 1.5, startTime);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq, startTime + duration);

        // Шум (придыхание)
        const bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;

        // Формантный фильтр
        const formant = ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(800, startTime);
        formant.Q.setValueAtTime(2, startTime);

        // Громкость
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
        gain.gain.setValueAtTime(vol, startTime + duration * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc1.connect(formant);
        osc2.connect(formant);
        noise.connect(formant);
        formant.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(startTime);
        osc1.stop(startTime + duration);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
        noise.start(startTime);
        noise.stop(startTime + duration);
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
    }
};

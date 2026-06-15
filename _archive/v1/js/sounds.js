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
        this._tone(300, 0.08, 'sawtooth', 0.12);
        setTimeout(() => this._tone(400, 0.1, 'sawtooth', 0.1), 100);
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

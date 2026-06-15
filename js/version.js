// ============================================================
// version.js — единственное место для версии
// ============================================================

const BUILD = {
    version: 'v0.6',
    date:    '15.06.2026',
    time:    '21:42',
    get full() { return `${this.version} · ${this.date} · ${this.time}`; },
    get short(){ return `${this.version} · ${this.date}`; }
};

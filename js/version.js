// ============================================================
// version.js — единственное место для версии
// ============================================================

const BUILD = {
    version: 'v0.9-dogi4',
    date:    '16.06.2026',
    time:    '07:38',
    get full() { return `${this.version} · ${this.date} · ${this.time}`; },
    get short(){ return `${this.version} · ${this.date}`; }
};

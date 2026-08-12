import { levelFromXp } from '../game/rpg.js';

// ============================================================
// FLIGHT RECORDER — session telemetry + pasteable report
// ============================================================
// Claude is blind. This gives it eyes: FR tracks the session (screens, fps,
// clears, fails, notes) and prints a compact report to paste back to Claude.
// Press ` anywhere to drop a note; report lives in settings → fab controls.
const BUILD_TAG = '2026-07-07 · ship-rc1';
const FR = {
  t0: Date.now(), cur: 'menu', curT: Date.now(), path: [], evs: [], notes: [], fps: {}, _f: 0,
  enter(name) {
    if (name === this.cur) return;
    const dt = (Date.now() - this.curT) / 1000;
    if (dt > 2) this.path.push(this.cur + '(' + FR.dur(dt) + ')');
    if (this.path.length > 30) this.path.shift();
    this.cur = name; this.curT = Date.now(); this._f = 0;
  },
  tick(postOn) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._f) {
      const dt = now - this._f;
      if (dt > 0 && dt < 500) {
        const s = this.fps[this.cur] || (this.fps[this.cur] = { n: 0, sum: 0, worst: 0, post: 0 });
        s.n++; s.sum += dt; if (dt > s.worst) s.worst = dt; s.post = postOn ? 1 : 0;
      }
    }
    this._f = now;
  },
  ev(type, data) {
    this.evs.push({ t: (Date.now() - this.t0) / 1000, type, ...(data || {}) });
    if (this.evs.length > 500) this.evs.shift();
  },
  note(text) { this.notes.push({ where: this.cur, t: (Date.now() - this.t0) / 1000, text }); },
  dur(s) { return s >= 60 ? Math.floor(s / 60) + 'm' + String(Math.round(s % 60)).padStart(2, '0') + 's' : Math.round(s) + 's'; },
  report(save, gfx) {
    const L = [];
    const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
    L.push('═══ TAPEOUT FLIGHT REPORT ═══');
    L.push('build ' + BUILD_TAG + ' · ' + (touch ? 'touch' : 'desktop') +
      (typeof window !== 'undefined' ? ' · ' + window.innerWidth + 'x' + window.innerHeight + ' @dpr' + (window.devicePixelRatio || 1) : ''));
    if (gfx) L.push('gfx  ' + Object.entries(gfx).map(([k, v]) => k + ':' + v).join(' '));
    L.push('time ' + this.dur((Date.now() - this.t0) / 1000) + ' · path: ' + this.path.slice(-9).join(' → ') + (this.path.length ? ' → ' : '') + this.cur);
    const fk = Object.keys(this.fps);
    if (fk.length) L.push('fps  ' + fk.map(k => {
      const s = this.fps[k];
      const avg = s.n ? Math.round(1000 / (s.sum / s.n)) : 0;
      const mn = s.worst ? Math.round(1000 / s.worst) : 0;
      return k + ' ' + avg + 'avg/' + mn + 'min' + (s.post ? '·fx' : '·nofx');
    }).join('  ·  '));
    const by = {};
    this.evs.forEach(e => { (by[e.type] = by[e.type] || []).push(e); });
    if (by.clear) L.push('CLEARED  ' + by.clear.map(e => e.id + (e.stars ? '★' + e.stars : '')).join(' '));
    const noteEvents = (by.read || []).concat(by['recall-pass'] || []);
    if (noteEvents.length) L.push('NOTES READ  ' + [...new Set(noteEvents.map(e => e.id))].join(' '));
    const fails = {};
    ['cfail', 'bfail', 'rfail', 'sfail', 'gfail', 'tfail'].forEach(t => (by[t] || []).forEach(e => { fails[e.id] = (fails[e.id] || 0) + 1; }));
    if (Object.keys(fails).length) L.push('FAILS  ' + Object.entries(fails).map(([k, v]) => k + '×' + v).join(' '));
    if (by.flatline) L.push('FLATLINES  ' + by.flatline.length);
    if (save) L.push('save lvl ' + levelFromXp(save.xp || 0) + ' · xp ' + (save.xp || 0) + ' · scrap ' + (save.scrap || 0));
    if (this.notes.length) {
      L.push('PLAYER NOTES');
      this.notes.forEach(n => L.push('  - [' + n.where + ' @' + this.dur(n.t) + '] ' + n.text));
    }
    L.push('═══ end — paste this to Claude ═══');
    return L.join('\n');
  },
};

export { BUILD_TAG, FR };

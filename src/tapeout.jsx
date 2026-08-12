import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Pickaxe, Binary, Flame, Mountain, Clock, Castle, Cpu, Zap, Trophy, Lock, Star,
  Volume2, VolumeX, ChevronLeft, Check, X, BookOpen, Bug, Timer, Award,
  RotateCcw, Play, Eye, Lightbulb, Terminal, ChevronRight, ChevronDown,
  Sparkles, Medal, SkipForward,
  Coins, Swords, Heart, Skull, FlaskConical,
  Gamepad2, Settings
} from "lucide-react";
import * as THREE from "three";
import {
  V_KEYWORDS, vCompile, runChallengeTest,
} from './engine/verilog.js';
import { formatValue as fmtVal } from './engine/format.js';
import { levelizeNetlist, netlistOf } from './engine/debug/netlist.js';
import { bossPhase, firstDivergence } from './engine/debug/diagnostics.js';
import { exportRTL } from './engine/debug/rtl-export.js';
import {
  conceptMastery, dueTopics, masteryLevel, reviewUpdate, todayNum,
} from './game/recall.js';
import {
  mulberry32, combVecs, hashStr, hardenTest, WORLDS, LESSONS, LESSON_DEPTH,
  GAUNTLETS, TRUTH_CHALLENGES, CODE_CHALLENGES, REMIX, BUG_HUNTS,
  ACHIEVEMENTS, RANKS, MODES, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF,
  TRAINING_GENS, dailyFor, blitzGen,
} from './game/content.js';
import {
  LEVEL_BASE, levelFromXp, ITEMS, ITEM_BY_ID, derivedStats, ENEMY_FAMILIES,
  enemyFor, rpgFix,
} from './game/rpg.js';
import {
  AudioFX, trackForWorld, musicEnsure, musicSetState,
  musicSetTrack, musicCycleTrack,
} from './audio/index.js';

// ============================================================
// TAPEOUT — the Verilog dojo · single-file React artifact
//
// HARD CONSTRAINTS
//   · three r128 core only (no examples/jsm imports)
//   · no localStorage — in-memory save + TPO1 export codes
//   · all audio synthesized via Web Audio (no asset files)
//   · one default export; renders in Claude.ai artifacts
//   · dev gate: run_gate.sh (build · validate · content · visual · smoke)
//
// TABLE OF CONTENTS — grep a title to jump
//   01 · FLIGHT RECORDER — session telemetry + pasteable report
//   02 · VERILOG ENGINE — src/engine/verilog.js parser + simulator
//   03 · DEBUG BAY CORE — netlist extraction, mux transform, error help (pure)
//   04 · CONTENT — worlds, lessons, challenges, arcade, achievements
//   05 · NG+ REMIX — architect-mode challenge variants (altered specs)
//   06 · TRAINING GENERATORS — drills, spaced review, forge support
//   07 · RPG SPINE — levels, gear, enemies (pure, testable)
//   08 · UI FOUNDATIONS — styles, shared components
//   09 · SFX — synthesized click/hit/win effects
//   10 · SOUNDTRACK — procedural music synthesis (Web Audio, original)
//   11 · TRACK LIBRARY
//   12 · MUSIC ENGINE — Web Audio synth tracks + state machine
//   13 · WORLD INDEX + 2D SCREENS — challengesOf, WorldScreen
//   14 · DEBUG BAY UI — hardware schematic view
//   15 · APP SHELL — save system, routing, screens wiring
//   16 · META UI — training grounds, forge, profiles, stats
//   17 · COMBAT SYSTEM — combat hook, HUD, flatline, shop, level-up
//   18 · FAB CAMPUS CORE — model, pure logic, 3D builders
//   19 · ULTRA FAB LAYER — monument, sigils, conveyor, towers, traces, wisps
//   20 · FAB CAMPUS SCREEN — walkable fab, overlay bridge, HUD
//   21 · CINEMATIC HELPERS — glow, sky, light rigs (core three r128 only)
//   22 · ULTRA POST PIPELINE — bloom, CA, vignette, grain (core three only)
//   23 · PROCEDURAL ROCK — sandstone color/normal/roughness textures
//   24 · IMMERSION FX — cinematic overlays, transitions, juice
//   25 · ENEMY SPEC — procedural creature specs (pure, no THREE)
//   26 · ENEMY MESH — procedural creature build + animation (THREE r128)
//   27 · OPEN-WORLD MODELS — valley + canyon layouts (pure, testable)
//   28 · PROGRESSION OVERHAUL — stations, learning order, next-beacon
//   29 · OPEN-WORLD RENDERERS — valley + canyon biomes (THREE r128)
//   30 · REALISM TOOLKIT — materials, weathering, micro-detail (THREE r128)
//   31 · BIT MINES MODEL (pure, testable)
//   32 · BIT MINES SCREEN — renderer + walkable world
//   33 · ARCADE HUB MODEL (pure, testable) — reuses mineWalls()
//   34 · MAIN MENU + ARCADE SCREEN
//   35 · TRAIL DUNGEON MODELS — serpentine worlds 3/5/6/7 + DUNGEON_CFG
//   36 · DUNGEON SCREEN — renderer + walkable worlds 2-7
// ============================================================

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
    if (by.read) L.push('NOTES READ  ' + by.read.map(e => e.id).join(' '));
    const fails = {};
    ['cfail', 'bfail', 'rfail', 'sfail', 'gfail', 'tfail'].forEach(t => (by[t] || []).forEach(e => { fails[e.id] = (fails[e.id] || 0) + 1; }));
    if (Object.keys(fails).length) L.push('FAILS  ' + Object.entries(fails).map(([k, v]) => k + '×' + v).join(' '));
    if (by.flatline) L.push('FLATLINES  ' + by.flatline.length);
    if (save) L.push('save lvl ' + (save.level || 1) + ' · xp ' + (save.xp || 0) + ' · scrap ' + (save.scrap || 0));
    if (this.notes.length) {
      L.push('PLAYER NOTES');
      this.notes.forEach(n => L.push('  - [' + n.where + ' @' + this.dur(n.t) + '] ' + n.text));
    }
    L.push('═══ end — paste this to Claude ═══');
    return L.join('\n');
  },
};

// DEBUG BAY netlist extraction/layout lives in src/engine/debug/netlist.js.

// Pattern-matched help for compiler errors, pointing back at the field note.
const ERR_HELP = [
  { re: /declared more than once/i, tip: 'ports declared in the header are already declared — no second declaration in the body.', q: /declar|module|port/ },
  { re: /is a keyword/i, tip: 'that word belongs to Verilog — pick another name.', q: null },
  { re: /isn't a constant/i, tip: 'widths and part-selects need literal numbers (or parameters).', q: /vector|bit|bus/ },
  { re: /backwards/i, tip: 'vectors go [msb:lsb] — bigger index first.', q: /vector|bus/ },
  { re: /doesn't exist/i, tip: 'you indexed past the declared width — check the [msb:lsb] range.', q: /vector|bus/ },
  { re: /Concatenation wider/i, tip: 'keep concatenations 32 bits or narrower in the Dojo.', q: /concat/ },
  { re: /by zero/i, tip: 'guard the divisor — real dividers have no exceptions, only wrong answers.', q: null },
  { re: /isn't supported in the Dojo/i, tip: 'the Dojo speaks the synthesizable subset — express it with assign, always, if, case.', q: /always|assign/ },
  { re: /isn't declared|not declared|undeclared|unknown signal/i, tip: 'declare it (wire/reg) or add it to the port list before use.', q: /declar|wire|reg/ },
  { re: /^Expected/i, tip: 'syntax slip — a missing ; often gets reported one line late, so check the line above too.', q: /assign|first/ },
];
function errHelpFor(msg, world) {
  const h = ERR_HELP.find(e => e.re.test(msg || ''));
  if (!h) return null;
  let note = null;
  try {
    if (h.q) {
      const lessons = LESSONS[world] || [];
      const L = lessons.find(l => h.q.test((l.title || '').toLowerCase()));
      if (L) {
        const seq = stationSequence(challengesOf(world).filter(c => !c.boss), lessons.map(x => x.id));
        let ord = null; seq.forEach((s, i) => { if (s.kind === 'book' && s.lid === L.id) ord = i + 1; });
        note = { ord, title: L.title };
      }
    }
  } catch (e) { note = null; }
  return { tip: h.tip, note };
}

// Pure diagnostics, recall scheduling, and RTL export live in focused modules.

// CONTENT, NG+ REMIX, and TRAINING GENERATORS live in ./game/content.js.

// RPG SPINE lives in ./game/rpg.js.

// ============================================================
// UI FOUNDATIONS — styles, shared components
// ============================================================

const CSS = `
.tk-root{min-height:100vh;background:#07090D;color:#D7E0EA;font-family:ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
.tk-root *{box-sizing:border-box}
.tk-root ::selection{background:rgba(34,211,238,.28)}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:70;background:repeating-linear-gradient(0deg,rgba(255,255,255,.016) 0 1px,transparent 1px 3px)}
.wrap{max-width:1060px;margin:0 auto;padding:0 16px 80px}
.eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#76849A}
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid #273245;background:#10151E;color:#D7E0EA;padding:8px 14px;border-radius:6px;font:inherit;font-size:13px;cursor:pointer;transition:border-color .15s,background .15s,transform .05s;white-space:nowrap}
.btn:hover{border-color:#3A4A63;background:#141B26}
.btn:active{transform:translateY(1px)}
.btn:focus-visible,.lnk:focus-visible,.opt:focus-visible,.ycell:focus-visible,.bugline:focus-visible{outline:2px solid #22D3EE;outline-offset:2px}
.btn.primary{background:#0C2C33;border-color:#155E6B;color:#7DEFFF}
.btn.primary:hover{border-color:#22D3EE;background:#0E343D}
.btn.gold{background:#2B2208;border-color:#7A6310;color:#FFE27A}
.btn.gold:hover{border-color:#FACC15}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.sm{padding:5px 10px;font-size:12px}
.card{background:#0D1118;border:1px solid #1D2632;border-radius:10px}
.lnk{background:none;border:none;color:#76849A;cursor:pointer;font:inherit;font-size:12px;padding:4px 6px;display:inline-flex;align-items:center;gap:5px}
.lnk:hover{color:#D7E0EA}
.codespan{background:#141B26;border:1px solid #232E40;border-radius:4px;padding:1px 5px;font-size:.92em;color:#9BE8F7;white-space:nowrap}
.hbar{height:8px;background:#11161F;border:1px solid #1D2632;border-radius:99px;overflow:hidden}
.hbar>div{height:100%;border-radius:99px;transition:width .6s cubic-bezier(.22,1,.36,1)}
@keyframes blinkc{0%,55%{opacity:1}56%,100%{opacity:0}}
.cursorblink{animation:blinkc 1.1s steps(1) infinite}
@keyframes toastin{from{transform:translateX(26px);opacity:0}to{transform:none;opacity:1}}
.toast{animation:toastin .25s cubic-bezier(.22,1,.36,1)}
@keyframes popin{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
.popin{animation:popin .3s cubic-bezier(.22,1,.36,1)}
@keyframes shakex{0%,100%{transform:none}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.shake{animation:shakex .3s}
@keyframes cfall{to{transform:translateY(108vh) rotate(720deg);opacity:.9}}
.die{position:relative;border:1px solid #273245;background:linear-gradient(160deg,#0B0F16,#0A0D13);border-radius:4px;padding:34px;margin:18px 0 10px}
.die:before,.die:after{content:'';position:absolute;left:30px;right:30px;height:8px;background-image:repeating-linear-gradient(90deg,#222C3D 0 14px,transparent 14px 26px);opacity:.85}
.die:before{top:9px}.die:after{bottom:9px}
.die .padL,.die .padR{position:absolute;top:30px;bottom:30px;width:8px;background-image:repeating-linear-gradient(180deg,#222C3D 0 14px,transparent 14px 26px);opacity:.85}
.die .padL{left:9px}.die .padR{right:9px}
.die-grid{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:96px;gap:10px}
.blk{position:relative;border:1px solid #1D2632;border-radius:6px;background:#0D1118;padding:12px 13px;cursor:pointer;text-align:left;font:inherit;color:inherit;overflow:hidden;transition:border-color .15s,transform .12s;display:flex;flex-direction:column;justify-content:space-between}
.blk:hover:not(.locked){transform:translateY(-2px)}
.blk.locked{cursor:default;background:repeating-linear-gradient(135deg,#0B0F15 0 8px,#0D1118 8px 16px)}
.blk .fill{position:absolute;left:0;bottom:0;height:3px;transition:width .7s cubic-bezier(.22,1,.36,1)}
.blk-1{grid-column:1/4;grid-row:1/3}.blk-2{grid-column:4/7;grid-row:1/3}
.blk-3{grid-column:1/3;grid-row:3/5}.blk-4{grid-column:3/5;grid-row:3/5}.blk-5{grid-column:5/7;grid-row:3/5}
.blk-6{grid-column:1/4;grid-row:5/7}.blk-7{grid-column:4/7;grid-row:5/7}
@media(max-width:680px){
  .die{padding:22px}
  .die-grid{display:flex;flex-direction:column}
  .blk{min-height:88px}
  .die:before,.die:after{left:18px;right:18px}.die .padL{left:5px}.die .padR{right:5px}
  .twocol{grid-template-columns:1fr !important}
  .hidesm{display:none !important}
}
.tbl{border-collapse:collapse;font-size:13px}
.tbl th{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#76849A;font-weight:500;padding:5px 12px;border-bottom:1px solid #1D2632;text-align:left}
.tbl td{padding:5px 12px;border-bottom:1px solid #161D29}
.editor-wrap{position:relative;border:1px solid #273245;border-radius:8px;background:#0A0E14;overflow:hidden}
.editor-wrap.errored{border-color:#5b2330}
.code-common{margin:0;font-family:inherit;font-size:13.5px;line-height:1.6;tab-size:2;white-space:pre;word-wrap:normal}
.code-hl{position:absolute;inset:0;overflow:hidden;padding:12px 14px 12px 0;pointer-events:none;color:#C9D6E4}
.code-ta{position:relative;width:100%;display:block;background:transparent;color:transparent;caret-color:#7DEFFF;border:none;resize:none;outline:none;padding:12px 14px 12px 0;overflow:auto}
.lngut{display:inline-block;width:44px;padding-right:12px;text-align:right;color:#3A4759;user-select:none}
.eline{background:rgba(248,81,73,.13)}
.tok-kw{color:#7DEFFF}.tok-num{color:#FFC76B}.tok-cm{color:#5A6A80;font-style:italic}.tok-op{color:#A7B5C8}.tok-id{color:#C9D6E4}
.console{background:#080B10;border:1px solid #1D2632;border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.7;max-height:300px;overflow:auto;white-space:pre-wrap}
.c-err{color:#FF8B82}.c-hint{color:#76849A}.c-ok{color:#7CE7A2}.c-warn{color:#FFC76B}.c-dim{color:#5A6A80}
.opt{display:block;width:100%;text-align:left;background:#10151E;border:1px solid #273245;border-radius:7px;padding:10px 13px;color:#D7E0EA;font:inherit;font-size:13.5px;cursor:pointer;transition:border-color .12s,background .12s}
.opt:hover:not(:disabled){border-color:#3A4A63}
.opt.right{border-color:#2EA56A;background:#0E2418}
.opt.wrong{border-color:#B14A52;background:#2A1216}
.opt:disabled{cursor:default}
.ycell{width:44px;height:34px;border:1px solid #273245;background:#10151E;border-radius:6px;color:#D7E0EA;font:inherit;font-size:14px;cursor:pointer}
.ycell:hover{border-color:#3A4A63}
.ycell.bad{border-color:#B14A52;color:#FF8B82}
.bugline{display:block;width:100%;text-align:left;background:none;border:none;border-left:3px solid transparent;color:#C9D6E4;font:inherit;font-size:13px;line-height:1.7;padding:1px 10px;cursor:pointer;white-space:pre}
.bugline:hover{background:#11161F}
.bugline.hit{border-left-color:#2EA56A;background:#0E2418}
.bugline.miss{border-left-color:#B14A52;background:#2A1216}
.bugline.reveal{border-left-color:#FFC76B;background:#221B0B}
.bugline:disabled{cursor:default}
.field{width:100%;background:#0A0E14;border:1px solid #273245;border-radius:7px;color:#E8F1FA;font:inherit;font-size:16px;padding:10px 13px;outline:none}
.field:focus{border-color:#22D3EE}
.modalbg{position:fixed;inset:0;background:rgba(4,6,10,.78);z-index:90;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.lessonbody p{margin:0 0 10px}
@media(prefers-reduced-motion:reduce){.cursorblink,.toast,.popin,.shake{animation:none !important}.confetti{display:none !important}}
.wavescroll{overflow-x:auto;border:1px solid #1D2632;border-radius:8px;background:#080B10;padding:10px 6px}
`;

// ---------- SFX — see ./audio/index.js ----------

// ---------- tiny renderers ----------
function Inline({ text }) {
  const parts = String(text).split('`');
  return parts.map((p, i) => i % 2 === 1
    ? <code key={i} className="codespan">{p}</code>
    : <span key={i}>{p}</span>);
}
function Paragraphs({ text }) {
  return String(text).split('\n\n').map((p, i) => <p key={i}><Inline text={p} /></p>);
}
function DataTable({ table, accent }) {
  return (
    <table className="tbl" style={{ margin: '10px 0' }}>
      <thead><tr>{table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        {table.rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { color: accent || '#7DEFFF' } : null}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
function PortTable({ iface, accent }) {
  return (
    <table className="tbl" style={{ width: '100%' }}>
      <thead><tr><th>port</th><th>dir</th><th>width</th></tr></thead>
      <tbody>
        {iface.ports.map(p => (
          <tr key={p.n}>
            <td style={{ color: accent }}>{p.n}</td>
            <td>{p.d === 'in' ? 'input' : 'output'}</td>
            <td style={{ color: '#76849A' }}>{p.w > 1 ? `[${p.w - 1}:0]` : '1 bit'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function StarRow({ n, size }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[0, 1, 2].map(i => (
        <Star key={i} size={size || 13} fill={i < n ? '#FACC15' : 'none'} color={i < n ? '#FACC15' : '#3A4759'} strokeWidth={1.6} />
      ))}
    </span>
  );
}
// ---------- syntax highlight ----------
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function highlightVerilog(src, errLines) {
  const lines = src.split('\n');
  let inBlock = false;
  const out = lines.map((line, idx) => {
    let html = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) { html += `<span class="tok-cm">${escHtml(line.slice(i))}</span>`; i = line.length; }
        else { html += `<span class="tok-cm">${escHtml(line.slice(i, end + 2))}</span>`; i = end + 2; inBlock = false; }
        continue;
      }
      const rest = line.slice(i);
      let m;
      if ((m = rest.match(/^\/\/.*/))) { html += `<span class="tok-cm">${escHtml(m[0])}</span>`; i += m[0].length; continue; }
      if (rest.startsWith('/*')) { inBlock = true; continue; }
      if ((m = rest.match(/^\d[\d_]*'s?[bdho][0-9a-fA-FxXzZ_?]*/)) || (m = rest.match(/^\d[\d_]*/))) {
        html += `<span class="tok-num">${escHtml(m[0])}</span>`; i += m[0].length; continue;
      }
      if ((m = rest.match(/^[a-zA-Z_][a-zA-Z0-9_$]*/))) {
        const cls = V_KEYWORDS.has(m[0]) ? 'tok-kw' : 'tok-id';
        html += `<span class="${cls}">${escHtml(m[0])}</span>`; i += m[0].length; continue;
      }
      if ((m = rest.match(/^\s+/))) { html += m[0]; i += m[0].length; continue; }
      html += `<span class="tok-op">${escHtml(rest[0])}</span>`; i += 1;
    }
    const ecls = errLines && errLines.has(idx + 1) ? ' eline' : '';
    return `<span class="${ecls}" style="display:block"><span class="lngut">${idx + 1}</span>${html || ' '}</span>`;
  });
  return out.join('');
}

// ---------- editor ----------
function CodeEditor({ value, onChange, onRun, errLines }) {
  const taRef = useRef(null);
  const hlRef = useRef(null);
  const sync = () => {
    if (taRef.current && hlRef.current) {
      hlRef.current.scrollTop = taRef.current.scrollTop;
      hlRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };
  const onKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const nv = value.slice(0, s) + '  ' + value.slice(en);
      onChange(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); }
  };
  const html = useMemo(() => highlightVerilog(value, errLines), [value, errLines]);
  const lineCount = value.split('\n').length;
  const h = Math.min(440, Math.max(190, lineCount * 21.6 + 28));
  return (
    <div className={'editor-wrap' + (errLines && errLines.size ? ' errored' : '')} style={{ height: h }}>
      <pre ref={hlRef} className="code-common code-hl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html + '\n' }} />
      <textarea
        ref={taRef}
        className="code-common code-ta"
        style={{ height: '100%', paddingLeft: 44 }}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        onKeyDown={onKey}
        aria-label="Verilog editor"
      />
    </div>
  );
}

// ---------- SOUNDTRACK / TRACK LIBRARY / MUSIC ENGINE — see ./audio/index.js ----------

// ---------- waveform ----------
function Waveform({ trace, watch, inputNames, widths, accent }) {
  const CW = 38, LBL = 100, RH = 26, GAP = 12, TOP = 22;
  const n = trace.length;
  const rows = [{ name: 'clk', kind: 'clk' }];
  inputNames.forEach(nm => rows.push({ name: nm, kind: 'in', get: f => f.in[nm] }));
  watch.forEach(nm => {
    rows.push({ name: nm + ' ·you', kind: 'got', sig: nm, get: f => f.got[nm] });
    rows.push({ name: nm + ' ·ref', kind: 'exp', sig: nm, get: f => f.expect[nm] });
  });
  const W = LBL + n * CW + 10;
  const H = TOP + rows.length * (RH + GAP) + 6;
  const colorOf = (r) => r.kind === 'clk' ? '#5A6A80' : r.kind === 'in' ? '#8FA3BC' : r.kind === 'exp' ? '#7CE7A2' : (accent || '#7DEFFF');

  const els = [];
  // cycle pass/fail header + mismatch shading
  trace.forEach((f, i) => {
    const x = LBL + i * CW;
    els.push(<text key={'cyc' + i} x={x + CW / 2} y={13} fontSize="10" textAnchor="middle" fill={f.ok ? '#3F8A5C' : '#FF8B82'}>{f.ok ? '✓' : '✗'}</text>);
    if (!f.ok) els.push(<rect key={'bad' + i} x={x} y={TOP - 4} width={CW} height={H - TOP} fill="rgba(248,81,73,.07)" />);
    if (i > 0) els.push(<line key={'gr' + i} x1={x} y1={TOP - 4} x2={x} y2={H - 4} stroke="#11161F" strokeWidth="1" />);
  });

  rows.forEach((row, ri) => {
    const yTop = TOP + ri * (RH + GAP);
    const yBot = yTop + RH;
    const c = colorOf(row);
    els.push(<text key={'lb' + ri} x={LBL - 10} y={yTop + RH / 2 + 4} fontSize="11" textAnchor="end" fill={row.kind === 'got' || row.kind === 'exp' ? c : '#76849A'}>{row.name}</text>);
    if (row.kind === 'clk') {
      let d = '';
      for (let i = 0; i < n; i++) {
        const x = LBL + i * CW;
        d += `M ${x} ${yBot} L ${x} ${yTop} L ${x + CW / 2} ${yTop} L ${x + CW / 2} ${yBot} L ${x + CW} ${yBot} `;
      }
      els.push(<path key={'clk'} d={d} stroke={c} strokeWidth="1.4" fill="none" />);
      return;
    }
    const w = widths[row.sig || row.name] || 1;
    if (w === 1) {
      let d = '';
      let prev = null;
      for (let i = 0; i < n; i++) {
        const v = row.get(trace[i]);
        const x = LBL + i * CW;
        const y = v ? yTop : yBot;
        if (i === 0) d += `M ${x} ${y} `;
        else if (prev !== v) d += `L ${x} ${prev ? yTop : yBot} L ${x} ${y} `;
        d += `L ${x + CW} ${y} `;
        prev = v;
      }
      const bad = row.kind === 'got';
      els.push(<path key={'w' + ri} d={d} stroke={c} strokeWidth="1.6" fill="none" />);
      if (bad) trace.forEach((f, i) => {
        if (f.got[row.sig] !== f.expect[row.sig]) {
          els.push(<circle key={'x' + ri + '-' + i} cx={LBL + i * CW + CW / 2} cy={(yTop + yBot) / 2} r="3" fill="#FF8B82" />);
        }
      });
    } else {
      // bus: boxed segments per run of equal values
      let i = 0;
      while (i < n) {
        let j = i;
        const v = row.get(trace[i]);
        while (j + 1 < n && row.get(trace[j + 1]) === v) j++;
        const x = LBL + i * CW + 1.5;
        const wd = (j - i + 1) * CW - 3;
        const mism = row.kind === 'got' && (() => { for (let k = i; k <= j; k++) if (trace[k].got[row.sig] !== trace[k].expect[row.sig]) return true; return false; })();
        els.push(<rect key={'b' + ri + '-' + i} x={x} y={yTop + 2} width={wd} height={RH - 4} rx="3" fill="none" stroke={mism ? '#FF8B82' : c} strokeWidth="1.3" />);
        els.push(<text key={'bt' + ri + '-' + i} x={x + wd / 2} y={yTop + RH / 2 + 4} fontSize="10.5" textAnchor="middle" fill={mism ? '#FF8B82' : c}>{fmtVal(v, w)}</text>);
        i = j + 1;
      }
    }
  });

  return (
    <div className="wavescroll">
      <svg width={W} height={H} style={{ display: 'block' }} role="img" aria-label="waveform">{els}</svg>
    </div>
  );
}

// ---------- comb results ----------
function CombResults({ result, iface }) {
  const inPorts = iface.ports.filter(p => p.d === 'in');
  const outPorts = iface.ports.filter(p => p.d === 'out');
  const widthOf = (nm) => (iface.ports.find(p => p.n === nm) || { w: 1 }).w;
  const fails = result.rows.filter(r => !r.ok);
  const shown = fails.length ? [...fails.slice(0, 6), ...result.rows.filter(r => r.ok).slice(0, 6)] : result.rows.slice(0, 10);
  return (
    <div>
      <table className="tbl" style={{ width: '100%' }}>
        <thead>
          <tr>
            {inPorts.map(p => <th key={p.n}>{p.n}</th>)}
            {outPorts.map(p => <th key={p.n}>{p.n} (you)</th>)}
            {outPorts.map(p => <th key={p.n + 'e'}>{p.n} (ref)</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {inPorts.map(p => <td key={p.n} style={{ color: '#8FA3BC' }}>{fmtVal(r.in[p.n], widthOf(p.n))}</td>)}
              {outPorts.map(p => <td key={p.n} style={{ color: r.got[p.n] === r.expect[p.n] ? '#D7E0EA' : '#FF8B82' }}>{fmtVal(r.got[p.n], widthOf(p.n))}</td>)}
              {outPorts.map(p => <td key={p.n + 'e'} style={{ color: '#7CE7A2' }}>{fmtVal(r.expect[p.n], widthOf(p.n))}</td>)}
              <td>{r.ok ? <Check size={14} color="#3F8A5C" /> : <X size={14} color="#FF8B82" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > shown.length && (
        <div style={{ fontSize: 11.5, color: '#5A6A80', padding: '6px 2px' }}>
          … {result.rows.length - shown.length} more vectors {fails.length ? 'omitted' : '— all passing'}
        </div>
      )}
    </div>
  );
}

// ---------- console ----------
function ConsoleOut({ state }) {
  if (!state) return (
    <div className="console"><span className="c-dim">// console — hit COMPILE & RUN (Ctrl+Enter) to test your module against the bench</span></div>
  );
  return (
    <div className="console">
      {state.lines.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
    </div>
  );
}

// ---------- toasts ----------
function Toasts({ items }) {
  return (
    <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 95, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      {items.map(t => (
        <div key={t.id} className="toast card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', borderColor: t.kind === 'ach' ? '#7A6310' : '#155E6B' }}>
          {t.kind === 'ach' ? <Trophy size={16} color="#FACC15" /> : <Zap size={16} color="#7DEFFF" />}
          <div>
            <div style={{ fontSize: 12.5, color: t.kind === 'ach' ? '#FFE27A' : '#7DEFFF' }}>{t.title}</div>
            {t.sub && <div style={{ fontSize: 11, color: '#76849A' }}>{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- confetti ----------
function Confetti({ colors }) {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 2.4 + Math.random() * 2,
    size: 5 + Math.random() * 7,
    color: colors[i % colors.length],
    rot: Math.random() * 360,
  })), [colors]);
  return (
    <div className="confetti" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 96, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -16, left: p.left + '%', width: p.size, height: p.size * 0.45,
          background: p.color, transform: `rotate(${p.rot}deg)`, opacity: 0.95,
          animation: `cfall ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.6,1) forwards`,
        }} />
      ))}
    </div>
  );
}

// ---------- modal ----------
function Modal({ children, onClose, width }) {
  return (
    <div className="modalbg" onClick={onClose}>
      <div className="card popin" style={{ width: width || 560, maxWidth: '100%', maxHeight: '88vh', overflow: 'auto', padding: 22 }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------- header ----------
function rankIndex(xp) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r[1]) idx = i; });
  return idx;
}
function Header({ save, onHome, onToggleSound, onSettings }) {
  const ri = rankIndex(save.xp);
  const cur = RANKS[ri], next = RANKS[ri + 1];
  const pct = next ? Math.min(100, Math.round(((save.xp - cur[1]) / (next[1] - cur[1])) * 100)) : 100;
  return (
    <div style={{ borderBottom: '1px solid #1D2632', background: 'rgba(7,9,13,.92)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="wrap" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="lnk" onClick={onHome} style={{ padding: 0 }} aria-label="Home">
          <span style={{ fontSize: 17, letterSpacing: '.18em', color: '#E8F1FA', fontWeight: 600 }}>
            TAPEOUT<span className="cursorblink" style={{ color: '#7DEFFF' }}>_</span>
          </span>
        </button>
        <span className="eyebrow hidesm">the verilog dojo</span>
        <div style={{ flex: 1 }} />
        <button className="lnk hidesm" onClick={onSettings} title="difficulty" style={{ fontSize: 10.5, letterSpacing: '.12em', color: save.ngplus ? '#FFE27A' : '#76849A' }}>
          {(save.ngplus ? 'NG+ · ' : '') + modeOf(save.ngplus ? 'architect' : save.mode).label.toUpperCase()}
        </button>
        <div title="daily streak" style={{ display: 'flex', alignItems: 'center', gap: 5, color: save.streak.count > 1 ? '#FFC76B' : '#5A6A80', fontSize: 13 }}>
          <Flame size={15} fill={save.streak.count > 1 ? '#FFC76B' : 'none'} /> {save.streak.count}
        </div>
        <div style={{ minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
            <span style={{ color: '#7DEFFF', letterSpacing: '.1em' }}>{cur[0].toUpperCase()}</span>
          <span className="chip" title="level">Lv {levelFromXp(save.xp || 0)}</span>
          <span className="chip" title="scrap" style={{ color: '#FFC76B' }}>⛁ {save.scrap || 0}</span>
            <span style={{ color: '#76849A' }}>{save.xp} XP{next ? ' / ' + next[1] : ''}</span>
          </div>
          <div className="hbar"><div style={{ width: pct + '%', background: 'linear-gradient(90deg,#155E6B,#22D3EE)' }} /></div>
        </div>
        <button className="lnk" onClick={onToggleSound} aria-label="toggle sound">
          {save.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button className="lnk" onClick={onSettings} aria-label="settings"><RotateCcw size={15} /></button>
      </div>
    </div>
  );
}

// ---------- challenge registry helpers ----------
const ALL_CHALLENGES = [];
GAUNTLETS.forEach(g => ALL_CHALLENGES.push({ kind: 'gauntlet', id: g.id, world: g.world, title: g.title, xp: g.xp, def: g }));
TRUTH_CHALLENGES.forEach(t => ALL_CHALLENGES.push({ kind: 'truth', id: t.id, world: t.world, title: t.title, xp: t.xp, def: t }));
CODE_CHALLENGES.forEach(c => ALL_CHALLENGES.push({ kind: 'code', id: c.id, world: c.world, title: c.title, xp: c.xp, boss: c.boss, def: c }));
// ============================================================
// WORLD INDEX + 2D SCREENS — challengesOf, WorldScreen
// ============================================================
const WORLD_ORDER = { b1: 1, b2: 2, b3: 3, b4: 4, b5: 5, b6: 6, g1: 1, g2: 2, g3: 3, g4: 4, g5: 5, g7: 6, g6: 7, m1: 1, m2: 2, m3: 3, m4: 4, m5: 5, m7: 6, m6: 7, c1: 1, c2: 2, c3: 3, c4: 4, c5: 5, c6: 6, c8: 7, c9: 8, c10: 9, c11: 10, c7: 11, s1: 1, s2: 2, s3: 3, s4: 4, s5: 5, s6: 6, s8: 7, s7: 8, f1: 1, f4: 2, f2: 3, f3: 4 };
function challengesOf(w) {
  return ALL_CHALLENGES.filter(c => c.world === w).sort((a, b) => (WORLD_ORDER[a.id] || 99) - (WORLD_ORDER[b.id] || 99) || a.id.localeCompare(b.id));
}
function worldDone(w, save) { return challengesOf(w).every(c => save.done[c.id]); }
function activeDone(save) { return save.ngplus ? (save.doneNg || {}) : save.done; }
function worldUnlockedEx(w, save) { return save.ngplus ? true : worldUnlocked(w, save); }
function worldUnlocked(w, save) {
  if (w === 1) return true;
  if (w === 7) return [1, 2, 3, 4, 5, 6].every(x => worldDone(x, save));
  return worldDone(w - 1, save);
}
const WORLD_ICONS = { 1: Pickaxe, 2: Binary, 3: Flame, 4: Mountain, 5: Clock, 6: Castle, 7: Cpu };

function WorldScreen({ w, save, go, onLessonRead }) {
  const world = WORLDS.find(x => x.id === w);
  const lessons = LESSONS[w] || [];
  const chs = challengesOf(w);
  // station numbers — same learning order the 3D worlds use
  const _seq = stationSequence(chs.filter(c => !c.boss), lessons.map(L => L.id));
  const stOrd = {}; _seq.forEach((s, i) => { stOrd[s.kind === 'book' ? s.lid : s.f.id] = i + 1; });
  const bossOrd = _seq.length + 1;
  const [openLesson, setOpenLesson] = useState(null);
  const Icon = WORLD_ICONS[w];
  return (
    <div style={{ marginTop: 22 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 2px' }}>
        <Icon size={22} color={world.color} strokeWidth={1.7} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '.05em' }}>{world.name}</h1>
      </div>
      <div style={{ color: '#76849A', fontSize: 13, maxWidth: 640 }}>{world.desc}</div>
      {w === 1 && (
        <button className="card" onClick={() => { AudioFX.click(); go({ name: 'mine' }); }}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '13px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: '#7A6310', margin: '14px 0 0', maxWidth: 640 }}>
          <Pickaxe size={16} color="#FFC76B" />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#FFC76B', letterSpacing: '.05em' }}>DESCEND INTO THE MINES</div>
            <div style={{ fontSize: 11.5, color: '#76849A' }}>Walk the shaft. Fight the galleries. The wyrm sleeps at the bottom.</div>
          </div>
          <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
      )}

      {w >= 2 && DUNGEON_CFG[w] && (
        <button className="card" onClick={() => { AudioFX.click(); go({ name: 'dungeon', w }); }}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '13px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: world.color, margin: '14px 0 0', maxWidth: 640 }}>
          <Icon size={16} color={world.color} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: world.color, letterSpacing: '.05em' }}>{DUNGEON_CFG[w].descend.label}</div>
            <div style={{ fontSize: 11.5, color: '#76849A' }}>{DUNGEON_CFG[w].descend.sub}</div>
          </div>
          <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
      )}

      {lessons.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>field notes · +5 xp each · numbered = read order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {lessons.map(L => {
              const read = !!save.lessons[L.id];
              const open = openLesson === L.id;
              return (
                <div key={L.id} className="card" style={{ overflow: 'hidden' }}>
                  <button
                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '11px 15px', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      AudioFX.click();
                      setOpenLesson(open ? null : L.id);
                      if (!read) onLessonRead(L.id);
                    }}>
                    <BookOpen size={14} color={read ? world.color : '#5A6A80'} />
                    <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(stOrd[L.id] || 0).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13.5, color: read ? '#D7E0EA' : '#A9B7C9' }}>{L.title}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {read && <Check size={13} color={world.color} />}
                      {open ? <ChevronDown size={14} color="#5A6A80" /> : <ChevronRight size={14} color="#5A6A80" />}
                    </span>
                  </button>
                  {open && (
                    <div className="lessonbody" style={{ padding: '2px 16px 14px', fontSize: 13.5, color: '#B9C6D6', borderTop: '1px solid #161D29' }}>
                      <div style={{ height: 10 }} />
                      <Paragraphs text={L.body} />
                      {L.code && (
                        <pre className="code-common" style={{ background: '#0A0E14', border: '1px solid #1D2632', borderRadius: 7, padding: '10px 13px', overflowX: 'auto', fontSize: 12.5 }}
                          dangerouslySetInnerHTML={{ __html: highlightVerilog(L.code).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
                      )}
                      {LESSON_DEPTH[L.id] && (
                        <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid #161D29' }}>
                          <div className="eyebrow" style={{ marginBottom: 7, color: '#6FB7C9' }}>going deeper</div>
                          <div style={{ fontSize: 13, color: '#A7B6C8' }}><Paragraphs text={LESSON_DEPTH[L.id]} /></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{w === 7 ? 'the final build' : 'challenges · numbers match the trail stations'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {chs.map((c, idx) => {
            const rec = activeDone(save)[c.id];
            return (
              <button key={c.id} className="card" onClick={() => { AudioFX.click(); go({ name: c.kind, id: c.id }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: c.boss ? (rec ? world.color : '#3A2E14') : '#1D2632', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = world.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = c.boss ? (rec ? world.color : '#3A2E14') : '#1D2632'}>
                <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(c.boss ? bossOrd : (stOrd[c.id] || idx + 1)).padStart(2, '0')}</span>
                {c.boss
                  ? <Zap size={15} color="#FACC15" fill={rec ? '#FACC15' : 'none'} />
                  : (c.kind === 'code' ? <Terminal size={14} color={world.color} /> : <Sparkles size={14} color={world.color} />)}
                <span style={{ fontSize: 14, color: rec ? '#D7E0EA' : '#C2CFDE', fontWeight: c.boss ? 600 : 400, letterSpacing: c.boss ? '.04em' : 0 }}>{c.title}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#5A6A80' }}>{c.xp} xp</span>
                  {rec ? <StarRow n={rec.stars} /> : <span style={{ fontSize: 11, color: '#3A4759' }}>—</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- gauntlet screen ----------
function GauntletScreen({ id, save, go, onComplete, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('combat'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const g = GAUNTLETS.find(x => x.id === id);
  const world = WORLDS.find(x => x.id === g.world);
  const [run, setRun] = useState(() => newRun());
  const firstTimeRef = useRef(!save.done[id]);
  function newRun() {
    const rng = mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9));
    return { rng, qIdx: 0, q: g.gen(rng, 0), wrongs: 0, phase: 'ask', input: '', picked: null, lastRight: false, finished: false, stars: 0 };
  }
  const TOTAL = 5;
  const effModeG = save.ngplus ? 'architect' : save.mode;
  const enemyG = useMemo(() => enemyFor(g.id, g.world, g.xp, false, effModeG, !!save.ngplus), []); // eslint-disable-line
  const combat = useCombat({ enemy: enemyG, save, live: !(activeDone(save)[g.id]), onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line
  const submitText = () => {
    if (!run.input.trim()) return;
    const right = run.q.check(run.input);
    onStat(TOPIC_OF[g.id] || 'numbers', right);
    combat.onAnswer(right);
    if (!right) FR.ev('gfail', { id });
    right ? AudioFX.good() : AudioFX.bad();
    setRun(r => ({ ...r, phase: 'show', lastRight: right, wrongs: r.wrongs + (right ? 0 : 1) }));
  };
  const pickMC = (i) => {
    const right = i === run.q.correct;
    onStat(TOPIC_OF[g.id] || 'numbers', right);
    combat.onAnswer(right);
    if (!right) FR.ev('gfail', { id });
    right ? AudioFX.good() : AudioFX.bad();
    setRun(r => ({ ...r, phase: 'show', picked: i, lastRight: right, wrongs: r.wrongs + (right ? 0 : 1) }));
  };
  const next = () => {
    AudioFX.click();
    if (run.qIdx + 1 >= TOTAL) {
      const stars = run.wrongs === 0 ? 3 : run.wrongs <= 2 ? 2 : 1;
      setRun(r => ({ ...r, finished: true, stars, firstClear: firstTimeRef.current }));
      combat.victory();
      onComplete(g.id, stars, g.xp);
      firstTimeRef.current = false;
      return;
    }
    setRun(r => ({ ...r, qIdx: r.qIdx + 1, q: g.gen(r.rng, r.qIdx + 1), phase: 'ask', input: '', picked: null }));
  };
  const already = !!save.done[g.id];

  if (run.finished) {
    return (
      <div style={{ marginTop: 22, maxWidth: 560 }}>
        <CombatHUD c={combat} save={save} />
        <div className="card popin" style={{ padding: 26, textAlign: 'center', borderColor: world.color }}>
          <div className="eyebrow" style={{ color: world.color }}>{g.title} · clear</div>
          <div style={{ fontSize: 24, margin: '10px 0 6px', fontWeight: 600 }}>{run.wrongs === 0 ? 'Flawless.' : run.wrongs <= 2 ? 'Cleared.' : 'Survived.'}</div>
          <StarRow n={run.stars} size={20} />
          <div style={{ color: '#76849A', fontSize: 12.5, margin: '10px 0 18px' }}>
            {run.wrongs === 0 ? 'Five for five — not a single missed bit.' : `${TOTAL - run.wrongs}/${TOTAL} on first attempts.`}
            {run.firstClear ? ` +${g.xp} XP` : ' (replay — no XP)'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { AudioFX.click(); setRun(newRun()); }}><RotateCcw size={13} /> run it again</button>
            <button className="btn primary" onClick={() => go({ name: 'world', w: g.world })}>back to {world.name} <ChevronRight size={13} /></button>
          </div>
        </div>
      </div>
    );
  }

  const q = run.q;
  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: g.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: g.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{g.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{g.xp} xp{already ? ' · cleared' : ''}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>{g.intro}</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} style={{ width: 26, height: 5, borderRadius: 99, background: i < run.qIdx ? world.color : i === run.qIdx ? '#3A4A63' : '#161D29' }} />
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: run.wrongs ? '#FF8B82' : '#5A6A80' }}>{run.wrongs} missed</span>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, lineHeight: 1.7 }}><Inline text={q.text} /></div>
        {q.table && <DataTable table={q.table} accent={world.color} />}

        {q.kind === 'mc' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
            {q.options.map((o, i) => {
              let cls = 'opt';
              if (run.phase === 'show') {
                if (i === q.correct) cls += ' right';
                else if (i === run.picked) cls += ' wrong';
              }
              return (
                <button key={i} className={cls} disabled={run.phase === 'show'} onClick={() => pickMC(i)}>
                  <span style={{ color: '#5A6A80', marginRight: 8 }}>{String.fromCharCode(65 + i)}</span><Inline text={o} />
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              className="field"
              value={run.input}
              disabled={run.phase === 'show'}
              autoFocus
              onChange={e => setRun(r => ({ ...r, input: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && run.phase === 'ask') submitText(); }}
              placeholder="answer…"
              aria-label="answer"
            />
            {run.phase === 'ask' && <button className="btn primary" onClick={submitText}>submit</button>}
          </div>
        )}

        {run.phase === 'show' && (
          <div className={run.lastRight ? '' : 'shake'} style={{ marginTop: 14, padding: '11px 14px', borderRadius: 7, border: '1px solid', borderColor: run.lastRight ? '#2EA56A' : '#B14A52', background: run.lastRight ? '#0E2418' : '#2A1216', fontSize: 13 }}>
            <div style={{ color: run.lastRight ? '#7CE7A2' : '#FF8B82', fontWeight: 600, marginBottom: 4 }}>
              {run.lastRight ? 'CORRECT' : 'MISS'}{!run.lastRight && q.answer ? <span style={{ fontWeight: 400 }}> — answer: <Inline text={q.answer} /></span> : null}
            </div>
            <div style={{ color: '#B9C6D6' }}><Inline text={q.explain} /></div>
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={next} autoFocus>
              {run.qIdx + 1 >= TOTAL ? 'finish' : 'next'} <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- truth-table screen ----------
function TruthScreen({ id, save, go, onComplete, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('combat'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const tc = TRUTH_CHALLENGES.find(t => t.id === id);
  const world = WORLDS.find(x => x.id === tc.world);
  const [item] = useState(() => tc.pool[Math.floor(Math.random() * tc.pool.length)]);
  const rows = useMemo(() => Array.from({ length: 8 }, (_, x) => [(x >> 2) & 1, (x >> 1) & 1, x & 1]), []);
  const [cells, setCells] = useState(Array(8).fill(null));
  const [badRows, setBadRows] = useState(new Set());
  const [subs, setSubs] = useState(0);
  const [done, setDone] = useState(false);
  const already = !!save.done[tc.id];
  const enemyT = useMemo(() => enemyFor(tc.id, tc.world, tc.xp, false, save.ngplus ? 'architect' : save.mode, !!save.ngplus), []); // eslint-disable-line
  const combat = useCombat({ enemy: enemyT, save, live: !(activeDone(save)[tc.id]), onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line

  const toggle = (i) => {
    if (done) return;
    AudioFX.click();
    setCells(c => c.map((v, j) => j === i ? (v === null ? 0 : v === 0 ? 1 : 0) : v));
    setBadRows(b => { const nb = new Set(b); nb.delete(i); return nb; });
  };
  const submit = () => {
    if (cells.some(c => c === null)) { AudioFX.bad(); setBadRows(new Set(cells.map((c, i) => c === null ? i : -1).filter(i => i >= 0))); return; }
    const bad = new Set();
    rows.forEach((r, i) => { if (item.fn(r[0], r[1], r[2]) !== cells[i]) bad.add(i); });
    onStat('boolean', bad.size === 0);
    setSubs(s => s + 1);
    if (bad.size === 0) {
      combat.victory();
      AudioFX.win();
      setDone(true);
      const stars = subs === 0 ? 3 : subs <= 2 ? 2 : 1;
      onComplete(tc.id, stars, tc.xp);
    } else {
      FR.ev('tfail', { id });
      combat.onRun({ ok: false, frac: (8 - bad.size) / 8 });
      AudioFX.bad();
      setBadRows(bad);
    }
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 560 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: tc.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: tc.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{tc.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{tc.xp} xp{already ? ' · cleared' : ''}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>{tc.intro}</div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 16, marginBottom: 12 }}><code className="codespan" style={{ fontSize: 15, padding: '4px 10px', color: world.color }}>{item.label}</code></div>
        <table className="tbl">
          <thead><tr>{item.vars.map(v => <th key={v}>{v}</th>)}<th style={{ color: world.color }}>Y</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((b, j) => <td key={j} style={{ color: '#8FA3BC' }}>{b}</td>)}
                <td>
                  <button className={'ycell' + (badRows.has(i) ? ' bad' : '')} onClick={() => toggle(i)} disabled={done} aria-label={`row ${i} output`}>
                    {cells[i] === null ? '·' : cells[i]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!done ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn primary" onClick={submit}><Play size={13} /> verify table</button>
            {subs > 0 && <span style={{ fontSize: 12, color: '#FF8B82' }}>{badRows.size} row{badRows.size === 1 ? '' : 's'} wrong — fix the marked cells</span>}
          </div>
        ) : (
          <div className="popin" style={{ marginTop: 16, padding: '12px 14px', border: '1px solid #2EA56A', background: '#0E2418', borderRadius: 7 }}>
            <div style={{ color: '#7CE7A2', fontWeight: 600, fontSize: 13 }}>TABLE VERIFIED {subs === 1 ? '— first submit, no corrections' : ''}</div>
            <div style={{ color: '#B9C6D6', fontSize: 12.5, marginTop: 4 }}>This table now uniquely defines the circuit. Any implementation matching it is the same hardware.</div>
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={() => go({ name: 'world', w: tc.world })}>back to {world.name} <ChevronRight size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- code challenge screen ----------
const draftStore = {};
// ============================================================
// DEBUG BAY UI — hardware schematic view
// ============================================================
// "View as hardware": renders the compiled module as a levelized gate
// schematic. Your assign IS these gates; an uncovered always-path IS that
// red dashed latch loop. SVG, headless-safe, no draw effects.
function SchematicView({ mod, iface, accent }) {
  const lay = useMemo(() => {
    try { return levelizeNetlist(netlistOf(mod)); }
    catch (e) { return { err: (e && e.message) || 'failed' }; }
  }, [mod]);
  if (!lay || lay.err) return <div style={{ fontSize: 12, color: '#5A6A80', padding: 8 }}>hardware view unavailable — {lay && lay.err}</div>;
  if (lay.nodes.length > 130) return <div style={{ fontSize: 12, color: '#5A6A80', padding: 8 }}>this one is too big to draw ({lay.nodes.length} elements) — trust the waveform</div>;
  const acc = accent || '#7DEFFF';
  const stroke = '#41546F', fill = '#101823', txt = '#C9D6E6';
  const els = [];
  // wires under nodes
  lay.edges.forEach((e, i) => {
    const a = lay.nodes[e.from], b = lay.nodes[e.to];
    const fx = a.x + a.wd, fy = a.y + a.ht / 2;
    const ty = b.y + b.ht * (e.pin + 1) / (b.ins.length + 1), tx = b.x;
    const dx = Math.max(22, (tx - fx) / 2);
    const busy = (a.w || 1) > 1;
    els.push(<path key={'w' + i}
      d={`M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`}
      stroke={e.fb ? '#FF8B82' : busy ? acc : stroke} strokeWidth={busy ? 2.3 : 1.25}
      strokeDasharray={e.fb ? '5 4' : undefined} fill="none" opacity={e.fb ? 0.9 : 0.8} />);
    if (busy) els.push(<text key={'wl' + i} x={fx + 7} y={fy - 4} fontSize="9" fill={acc} opacity="0.8">{a.w}</text>);
  });
  // nodes
  lay.nodes.forEach(n => {
    const { x, y, wd: w, ht: h, type: t } = n;
    const k = 'n' + n.id;
    const lbl = (tx2, ty2, s, col, size, kk) => <text key={k + (kk || 'l')} x={tx2} y={ty2} fontSize={size || 10.5} textAnchor="middle" fill={col || txt} fontFamily="ui-monospace, monospace">{s}</text>;
    if (t === 'IN' || t === 'OUT') {
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={h / 2} fill={t === 'OUT' ? 'rgba(125,239,255,.08)' : fill} stroke={t === 'OUT' ? acc : stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, n.label + (n.w > 1 ? '[' + (n.w - 1) + ':0]' : ''), t === 'OUT' ? acc : '#9FB4C8', 10));
    } else if (t === 'CONST') {
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, n.label, '#8FA3BC', 10));
    } else if (t === 'DFF' || t === 'LATCH') {
      const bad = t === 'LATCH';
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={bad ? '#FF8B82' : '#FFE27A'} strokeWidth={1.4} strokeDasharray={bad ? '4 3' : undefined} />);
      els.push(<path key={k + 'c'} d={`M ${x} ${y + h - 13} l 8 5.5 l -8 5.5`} stroke={bad ? '#FF8B82' : '#FFE27A'} fill="none" strokeWidth="1.2" />);
      els.push(lbl(x + w / 2, y + 13, n.label, bad ? '#FF8B82' : '#FFE27A', 10));
      els.push(lbl(x + w / 2, y + h / 2 + 8, bad ? 'LATCH ⚠' : 'DFF', bad ? '#FF8B82' : '#B9A24A', 9, 'l2'));
    } else if (t === 'MUX') {
      els.push(<path key={k} d={`M ${x} ${y} L ${x + w} ${y + 9} L ${x + w} ${y + h - 9} L ${x} ${y + h} Z`} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, 'mux', '#8FA3BC', 9));
    } else if (t === 'NOT' || t === 'NEG') {
      els.push(<path key={k} d={`M ${x} ${y + 3} L ${x + w - 9} ${y + h / 2} L ${x} ${y + h - 3} Z`} fill={fill} stroke={stroke} />);
      els.push(<circle key={k + 'b'} cx={x + w - 5} cy={y + h / 2} r={3.6} fill={fill} stroke={stroke} />);
      if (t === 'NEG') els.push(lbl(x + 10, y + h / 2 + 3.5, '−', txt, 11));
    } else if (t === 'AND' || t === 'OR' || t === 'XOR' || t === 'XNOR') {
      const orish = t !== 'AND';
      const back = orish ? `M ${x} ${y} Q ${x + 12} ${y + h / 2} ${x} ${y + h}` : `M ${x} ${y} L ${x} ${y + h}`;
      els.push(<path key={k} d={`${back} L ${x + w * 0.45} ${y + h} Q ${x + w} ${y + h} ${x + w} ${y + h / 2} Q ${x + w} ${y} ${x + w * 0.45} ${y} Z`} fill={fill} stroke={stroke} />);
      if (t === 'XOR' || t === 'XNOR') els.push(<path key={k + 'x'} d={`M ${x - 5} ${y} Q ${x + 7} ${y + h / 2} ${x - 5} ${y + h}`} stroke={stroke} fill="none" />);
      if (t === 'XNOR') els.push(<circle key={k + 'b'} cx={x + w + 4} cy={y + h / 2} r={3.6} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w * 0.52, y + h / 2 + 3.5, n.label, '#8FA3BC', 10));
    } else if (t === 'ADD' || t === 'SUB' || t === 'MUL') {
      els.push(<circle key={k} cx={x + w / 2} cy={y + h / 2} r={w / 2} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 4.5, t === 'ADD' ? '+' : t === 'SUB' ? '−' : '×', txt, 14));
    } else {
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={5} fill={fill} stroke={t === 'NET' ? '#FF8B82' : stroke} strokeDasharray={t === 'NET' ? '4 3' : undefined} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, t === 'PROC' ? n.label : t === 'CMP' || t === 'RED' ? n.label : t === 'NET' ? n.label + ' ↩' : n.label, t === 'NET' ? '#FF8B82' : '#9FB4C8', 9.5));
    }
  });
  return (
    <div>
      {lay.latched.length > 0 && (
        <div style={{ fontSize: 12, color: '#FF8B82', marginBottom: 6 }}>
          ⚠ inferred latch on <b>{lay.latched.join(', ')}</b> — some path through your always block keeps the old value. That dashed loop below is the accidental memory.
        </div>
      )}
      <div style={{ overflow: 'auto', maxHeight: 380, border: '1px solid #1B2534', borderRadius: 8, background: '#0A0F16' }}>
        <svg width={lay.W} height={lay.H} style={{ display: 'block' }}>{els}</svg>
      </div>
      <div style={{ fontSize: 10.5, color: '#5A6A80', marginTop: 5 }}>
        your code, as silicon — gold box = flip-flop (state) · dashed red = feedback · thick {'\u007B'}wire{'\u007D'} = multi-bit bus · signal flows left → right
      </div>
    </div>
  );
}

function CodeScreen({ id, save, go, onComplete, onBossWin, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('boss'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const base = CODE_CHALLENGES.find(c => c.id === id);
  const ng = !!save.ngplus && !!REMIX[id];
  const ch = ng ? { ...base, ...REMIX[id], id: base.id, world: base.world } : base;
  const effMode = save.ngplus ? 'architect' : save.mode;
  const M = modeOf(effMode);
  const starter = effMode === 'architect'
    ? `// ARCHITECT MODE — build module ${ch.iface.name} from the interface spec\n\n`
    : ch.starter;
  const dk = id + '|' + effMode + (ng ? '+' : '');
  const world = WORLDS.find(x => x.id === ch.world);
  const [code, setCode] = useState(() => draftStore[dk] !== undefined ? draftStore[dk] : starter);
  const [out, setOut] = useState(null);
  const [dbgView, setDbgView] = useState('sig');
  const [errLines, setErrLines] = useState(new Set());
  const [hintsOpen, setHintsOpen] = useState(0);
  const [solOpen, setSolOpen] = useState(false);
  const attemptsRef = useRef(0);
  const solUsedRef = useRef(false);
  const timeUpRef = useRef(false);
  const [passed, setPassed] = useState(false);
  const dmap = save.ngplus ? (save.doneNg || {}) : save.done;
  const already = !!dmap[id];
  const activeTest = effMode === 'apprentice' ? ch.test : (ch.testHard || ch.test);
  const topic = TOPIC_OF[id] || 'gates';
  const bossT = (effMode === 'architect' && ch.boss && BOSS_TIME[id]) ? BOSS_TIME[id] : 0;
  const [timeLeft, setTimeLeft] = useState(bossT);
  const expired = bossT > 0 && timeLeft === 0;
  const chsW = challengesOf(ch.world);
  const isBossFight = !!ch.boss || chsW[chsW.length - 1].id === ch.id;
  const enemy = useMemo(() => enemyFor(ch.id, ch.world, ch.xp, isBossFight, effMode, ng), []); // eslint-disable-line
  const combat = useCombat({ enemy, save, live: !already, onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line

  const setCodeWrapped = (v) => { draftStore[dk] = v; setCode(v); };

  useEffect(() => {
    if (!bossT || passed || expired) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [bossT, passed, expired]);
  useEffect(() => { if (expired) timeUpRef.current = true; }, [expired]);

  const run = () => {
    if (combat.dead) return;
    AudioFX.click();
    const res = vCompile(code, ch.iface);
    const lines = [];
    const eset = new Set();
    if (!res.ok) {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: 0 });
      res.errors.forEach(e => {
        lines.push({ cls: 'c-err', text: `ERROR${e.line ? ' line ' + e.line : ''}: ${e.msg}` });
        if (e.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + e.hint });
        const eh = errHelpFor(e.msg, ch.world);
        if (eh) lines.push({ cls: 'c-hint', text: '  📖 ' + (eh.note && eh.note.ord ? 'field note #' + eh.note.ord + ' · ' + eh.note.title + ' — ' : '') + eh.tip });
        if (e.line) eset.add(e.line);
      });
      lines.push({ cls: 'c-dim', text: `// ${res.errors.length} error${res.errors.length > 1 ? 's' : ''} — fix and re-run` });
      FR.ev('cfail', { id: ch.id });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result: null });
      return;
    }
    (res.warnings || []).forEach(w => lines.push({ cls: 'c-warn', text: `warning line ${w.line}: ${w.msg}` }));
    try {
      const _net = netlistOf(res.mod);
      if (_net.latched.length) lines.push({ cls: 'c-warn', text: 'warning: inferred latch on ' + _net.latched.join(', ') + ' — a path through your always block keeps the old value. Open VIEW AS HARDWARE to see the loop.' });
    } catch (e) { }
    let result;
    try {
      result = runChallengeTest(res.mod, activeTest);
    } catch (e) {
      lines.push({ cls: 'c-err', text: 'SIM ERROR: ' + e.message });
      combat.onRun({ ok: false, frac: 0 });
      FR.ev('sfail', { id: ch.id });
      setErrLines(new Set()); setOut({ lines, result: null, mod: res.mod });
      AudioFX.bad();
      return;
    }
    if (result.runtimeError) {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: 0 });
      lines.push({ cls: 'c-err', text: `RUNTIME${result.runtimeError.line ? ' line ' + result.runtimeError.line : ''}: ${result.runtimeError.msg}` });
      if (result.runtimeError.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + result.runtimeError.hint });
      if (result.runtimeError.line) eset.add(result.runtimeError.line);
      FR.ev('rfail', { id: ch.id });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result, mod: res.mod });
      return;
    }
    if (result.pass) {
      onStat(topic, true);
      lines.push({ cls: 'c-ok', text: `TESTBENCH PASSED — ${result.total}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} ✓` });
      if (!passed && !already) {
        let stars = solUsedRef.current ? 1 : (attemptsRef.current === 0 && hintsOpen === 0 ? 3 : 2);
        if (timeUpRef.current) stars = Math.min(stars, 1);
        lines.push({ cls: 'c-dim', text: `// synthesis-clean. logged as ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` });
        if (timeUpRef.current) lines.push({ cls: 'c-warn', text: '// boss timer expired — clean work, late tapeout. capped at 1★' });
        combat.onRun({ ok: true, frac: 1 });
        onComplete(ch.id, stars, ch.xp);
        if (ch.id === 'chip1') onBossWin(ng);
      } else {
        lines.push({ cls: 'c-dim', text: '// already in the record books — clean run' });
      }
      FR.ev('pass', { id: ch.id });
      setPassed(true);
      AudioFX.win();
    } else {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: result.total ? result.passCount / result.total : 0 });
      lines.push({ cls: 'c-err', text: `TESTBENCH FAILED — ${result.passCount}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} passing` });
      lines.push({ cls: 'c-dim', text: result.kind === 'comb' ? '// mismatches highlighted below' : '// red cycles in the waveform are where you and the reference disagree' });
      FR.ev('bfail', { id: ch.id, frac: result.total ? +(result.passCount / result.total).toFixed(2) : 0 });
      AudioFX.bad();
    }
    setErrLines(new Set());
    setOut({ lines, result, mod: res.mod });
  };

  const reveal = () => {
    AudioFX.click();
    solUsedRef.current = true;
    setSolOpen(true);
  };

  const inputNames = ch.iface.ports.filter(p => p.d === 'in' && p.n !== 'clk').map(p => p.n);
  const widths = {};
  ch.iface.ports.forEach(p => widths[p.n] = p.w);

  return (
    <div style={{ marginTop: 22 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: ch.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: ch.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 10px', flexWrap: 'wrap' }}>
        {ch.boss && <Zap size={17} color="#FACC15" fill="#FACC15" />}
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.04em', color: ch.boss ? '#FFE27A' : '#E8F1FA' }}>{ch.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{ch.xp} xp{M.mult > 1 ? ` ×${M.mult}` : ''}{already ? ' · cleared' : ''}</span>
        {ng && <span style={{ fontSize: 10, letterSpacing: '.14em', color: '#FFE27A', border: '1px solid #7A6310', borderRadius: 4, padding: '2px 6px' }}>NG+</span>}
        {already && <StarRow n={dmap[id].stars} />}
      </div>

      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 13.5, color: '#B9C6D6' }}>
            <div className="lessonbody"><Paragraphs text={ch.brief} /></div>
            {ch.table && <DataTable table={ch.table} accent={world.color} />}
            <div className="eyebrow" style={{ margin: '14px 0 6px' }}>interface · module {ch.iface.name}</div>
            <PortTable iface={ch.iface} accent={world.color} />
          </div>

          {M.maxHints === 0 ? (
            <div className="card" style={{ marginTop: 10, padding: '12px 16px', fontSize: 12.5, color: '#8A93A3' }}>
              <span style={{ color: '#FFC76B', letterSpacing: '.14em', fontSize: 10.5 }}>ARCHITECT</span> — no hints, no starter{ng ? ', remixed spec' : ''}, {M.mult}× XP. The interface table is the whole spec.
              {bossT > 0 && <div style={{ marginTop: 6, color: '#76849A' }}>Boss timer armed — finish inside {Math.floor(bossT / 60)}:{String(bossT % 60).padStart(2, '0')} or the clear caps at 1★.</div>}
            </div>
          ) : (
          <div className="card" style={{ marginTop: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={14} color="#FFC76B" />
              <span className="eyebrow">hints · {hintsOpen}/{Math.min(ch.hints.length, M.maxHints)} used</span>
              {hintsOpen < Math.min(ch.hints.length, M.maxHints) && (
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setHintsOpen(h => h + 1); }}>reveal hint {hintsOpen + 1}</button>
              )}
            </div>
            {ch.hints.slice(0, hintsOpen).map((h, i) => (
              <div key={i} style={{ fontSize: 12.5, color: '#B9C6D6', marginTop: 8, paddingLeft: 10, borderLeft: '2px solid #3A2E14' }}><Inline text={h} /></div>
            ))}
            {isFinite(M.solAfter) && attemptsRef.current >= M.solAfter && !solOpen && (
              <button className="lnk" style={{ marginTop: 10, color: '#FFC76B' }} onClick={reveal}><Eye size={13} /> show solution (caps run at 1★)</button>
            )}
            {solOpen && (
              <pre className="code-common" style={{ marginTop: 10, background: '#0A0E14', border: '1px solid #3A2E14', borderRadius: 7, padding: '10px 13px', overflowX: 'auto', fontSize: 12.5 }}
                dangerouslySetInnerHTML={{ __html: highlightVerilog(ch.solution).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
            )}
          </div>
          )}
        </div>

        <div>
          <CodeEditor value={code} onChange={setCodeWrapped} onRun={run} errLines={errLines} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
            <button className={'btn ' + (ch.boss ? 'gold' : 'primary')} onClick={run}><Play size={13} /> COMPILE & RUN</button>
            <span className="eyebrow hidesm">ctrl+enter</span>
            {bossT > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', fontVariantNumeric: 'tabular-nums', color: expired ? '#FF8B82' : timeLeft <= 30 ? '#FFC76B' : '#7DEFFF', border: '1px solid #1D2632', borderRadius: 5, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Timer size={11} />{expired ? 'ESCAPED' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </span>
            )}
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setCodeWrapped(starter); setOut(null); setErrLines(new Set()); }}><RotateCcw size={12} /> reset code</button>
          </div>
          <ConsoleOut state={out} />
          {out && out.result && !out.result.runtimeError && (
            <div style={{ marginTop: 10 }}>
              {(() => { const d = firstDivergence(out.result, widths); return d ? <div style={{ fontSize: 12, color: '#FF8B82', marginBottom: 7 }}>◈ {d}</div> : null; })()}
              {out.mod && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button className={'btn sm' + (dbgView !== 'hw' ? ' primary' : '')} onClick={() => { AudioFX.click(); setDbgView('sig'); }}>signals</button>
                  <button className={'btn sm' + (dbgView === 'hw' ? ' primary' : '')} onClick={() => { AudioFX.click(); setDbgView('hw'); FR.ev('hw', { id: ch.id }); }}>view as hardware</button>
                </div>
              )}
              {dbgView === 'hw' && out.mod
                ? <SchematicView mod={out.mod} iface={ch.iface} accent={world.color} />
                : out.result.kind === 'comb'
                  ? <CombResults result={out.result} iface={ch.iface} />
                  : <Waveform trace={out.result.trace} watch={activeTest.watch} inputNames={inputNames} widths={widths} accent={world.color} />}
            </div>
          )}
          {passed && (
            <div className="popin" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => go({ name: 'world', w: ch.world })}>back to {world.name} <ChevronRight size={13} /></button>
              {nextChallengeAfter(ch.id) && (
                <button className="btn" onClick={() => { const n = nextChallengeAfter(ch.id); go({ name: n.kind, id: n.id }); }}>
                  next: {nextChallengeAfter(ch.id).title} <SkipForward size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function nextChallengeAfter(id) {
  const ch = ALL_CHALLENGES.find(c => c.id === id);
  if (!ch) return null;
  const list = challengesOf(ch.world);
  const idx = list.findIndex(c => c.id === id);
  return idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null;
}

// ---------- Binary Blitz ----------
function BlitzScreen({ save, go, onBlitzEnd }) {
  const [phase, setPhase] = useState('idle'); // idle | run | done
  const [time, setTime] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBest, setComboBest] = useState(0);
  const [q, setQ] = useState(null);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(null); // 'ok' | {answer}
  const rngRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const timeLeftRef = useRef(60);
  const stateRef = useRef({ score: 0, comboBest: 0 });

  const start = () => {
    AudioFX.click();
    rngRef.current = mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9));
    stateRef.current = { score: 0, comboBest: 0 };
    setScore(0); setCombo(0); setComboBest(0); setTime(60); setInput(''); setFlash(null);
    setQ(blitzGen(0, rngRef.current));
    setPhase('run');
    clearInterval(timerRef.current);
    timeLeftRef.current = 60;
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      const t = timeLeftRef.current;
      setTime(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        setPhase('done');
        onBlitzEnd(stateRef.current.score, stateRef.current.comboBest);
      } else if (t <= 5) {
        AudioFX.tick();
      }
    }, 1000);
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => { if (phase === 'run' && inputRef.current) inputRef.current.focus(); }, [phase, q]);

  const submit = () => {
    if (!input.trim() || phase !== 'run') return;
    if (q.check(input)) {
      AudioFX.good();
      const ns = score + 1, nc = combo + 1;
      stateRef.current.score = ns;
      stateRef.current.comboBest = Math.max(stateRef.current.comboBest, nc);
      setScore(ns); setCombo(nc); setComboBest(b => Math.max(b, nc));
      setFlash('ok');
      setQ(blitzGen(ns, rngRef.current));
    } else {
      AudioFX.bad();
      setCombo(0);
      setFlash({ answer: q.answer });
      setQ(blitzGen(score, rngRef.current));
    }
    setInput('');
    setTimeout(() => setFlash(null), 900);
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 560 }}>
      <button className="lnk" onClick={() => { clearInterval(timerRef.current); go({ name: 'home' }); }}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Timer size={18} color="#7DEFFF" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>BINARY BLITZ</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>high score {save.blitzHigh}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>
        60 seconds of conversions. Difficulty ramps with your score: nibbles → hex → bytes → two's complement. +1 XP per correct answer. This is how sight-reading gets built.
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#76849A', marginBottom: 16 }}>Type the answer, hit Enter. Wrong answers cost the combo, never the clock.</div>
          <button className="btn primary" style={{ fontSize: 15, padding: '11px 22px' }} onClick={start}><Play size={15} /> START RUN</button>
        </div>
      )}

      {phase === 'run' && q && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
            <span style={{ color: time <= 10 ? '#FF8B82' : '#76849A' }}>⏱ {time}s</span>
            <span style={{ color: '#7DEFFF' }}>score {score}</span>
            <span style={{ color: combo >= 5 ? '#FFC76B' : '#76849A' }}>{combo >= 2 ? `combo ×${combo}` : 'combo —'}</span>
          </div>
          <div className="hbar" style={{ marginBottom: 18 }}><div style={{ width: (time / 60 * 100) + '%', background: time <= 10 ? '#B14A52' : 'linear-gradient(90deg,#155E6B,#22D3EE)', transition: 'width 1s linear' }} /></div>
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div className="eyebrow">{q.sub}</div>
            <div style={{ fontSize: 34, letterSpacing: '.06em', margin: '8px 0 2px', color: '#E8F1FA' }}>{q.text}</div>
            <div style={{ height: 18, fontSize: 12 }}>
              {flash === 'ok' && <span style={{ color: '#7CE7A2' }}>✓ +1</span>}
              {flash && flash !== 'ok' && <span style={{ color: '#FF8B82' }}>✗ was {flash.answer}</span>}
            </div>
          </div>
          <input ref={inputRef} className="field" style={{ textAlign: 'center', fontSize: 19 }} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="…" aria-label="blitz answer" />
        </div>
      )}

      {phase === 'done' && (
        <div className="card popin" style={{ padding: 28, textAlign: 'center', borderColor: score > save.blitzHigh ? '#FACC15' : '#1D2632' }}>
          <div className="eyebrow" style={{ color: '#7DEFFF' }}>run complete</div>
          <div style={{ fontSize: 42, fontWeight: 600, margin: '6px 0 2px' }}>{score}</div>
          <div style={{ fontSize: 12.5, color: '#76849A', marginBottom: 6 }}>best combo ×{comboBest} · +{score} XP</div>
          {score >= save.blitzHigh && score > 0 && <div style={{ color: '#FFE27A', fontSize: 13, marginBottom: 6 }}>NEW HIGH SCORE</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={start}><RotateCcw size={13} /> run it back</button>
            <button className="btn" onClick={() => go({ name: 'home' })}>the fab</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Bug Bounty ----------
function BugScreen({ save, go, onBugSolve }) {
  const [openId, setOpenId] = useState(null);
  const [tries, setTries] = useState(0);
  const [picked, setPicked] = useState(new Set());
  const [state, setState] = useState('hunt'); // hunt | solved | revealed
  const bug = BUG_HUNTS.find(b => b.id === openId);

  const openCase = (id) => { AudioFX.click(); setOpenId(id); setTries(0); setPicked(new Set()); setState('hunt'); };
  const clickLine = (i) => {
    if (state !== 'hunt' || picked.has(i)) return;
    if (i === bug.bug) {
      AudioFX.win();
      setState('solved');
      onBugSolve(bug.id, tries === 0);
    } else {
      AudioFX.bad();
      const np = new Set(picked); np.add(i); setPicked(np);
      const nt = tries + 1;
      setTries(nt);
      if (nt >= 2) setState('revealed');
    }
  };

  if (bug) {
    return (
      <div style={{ marginTop: 22, maxWidth: 640 }}>
        <button className="lnk" onClick={() => setOpenId(null)}><ChevronLeft size={14} /> case files</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
          <Bug size={17} color="#FB7185" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{bug.title}</h2>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{bug.cat}</span>
        </div>
        <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 12 }}>
          One line is lying. Click it. {state === 'hunt' && (tries === 0 ? 'First click for the clean solve.' : '1 miss — last chance.')}
        </div>
        <div className="card" style={{ padding: '12px 6px', overflowX: 'auto' }}>
          {bug.lines.map((ln, i) => {
            let cls = 'bugline';
            if (state !== 'hunt' && i === bug.bug) cls += state === 'solved' ? ' hit' : ' reveal';
            else if (picked.has(i)) cls += ' miss';
            return (
              <button key={i} className={cls} disabled={state !== 'hunt'} onClick={() => clickLine(i)}>
                <span style={{ color: '#3A4759', marginRight: 12 }}>{String(i + 1).padStart(2, ' ')}</span>{ln}
              </button>
            );
          })}
        </div>
        {state !== 'hunt' && (
          <div className="popin card" style={{ marginTop: 12, padding: '14px 16px', borderColor: state === 'solved' ? '#2EA56A' : '#7A6310' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: state === 'solved' ? '#7CE7A2' : '#FFC76B', marginBottom: 6 }}>
              {state === 'solved' ? (tries === 0 ? 'CLEAN SOLVE — line ' + (bug.bug + 1) : 'SOLVED — line ' + (bug.bug + 1)) : 'REVEALED — line ' + (bug.bug + 1)}
            </div>
            <div style={{ fontSize: 13, color: '#B9C6D6' }}>{bug.why}</div>
            <div style={{ fontSize: 12.5, color: '#7CE7A2', marginTop: 8 }}>fix → <code className="codespan">{bug.fix}</code></div>
            <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => setOpenId(null)}>next case <ChevronRight size={12} /></button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Bug size={18} color="#FB7185" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>BUG BOUNTY</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{save.bugsSolved.length}/12 squashed</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>
        Twelve modules from the rejected pile, each hiding one bug. Click the guilty line — first-click solves pay 15 XP, second-click 8. These are the exact mistakes that eat real engineers' afternoons.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {BUG_HUNTS.map((b, idx) => {
          const solved = save.bugsSolved.includes(b.id);
          return (
            <button key={b.id} className="card" onClick={() => openCase(b.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#FB7185'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1D2632'}>
              <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(idx + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 13.5, color: solved ? '#76849A' : '#C2CFDE' }}>{b.title}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, color: '#5A6A80' }}>{b.cat}</span>
                {solved ? <Check size={14} color="#7CE7A2" /> : <span style={{ fontSize: 11, color: '#3A4759' }}>—</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- achievements ----------
function AchScreen({ save, go }) {
  const ri = rankIndex(save.xp);
  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <Award size={18} color="#FACC15" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>SERVICE RECORD</h2>
      </div>
      <StatsPanel save={save} />
      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>career ladder</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RANKS.map((r, i) => (
            <span key={r[0]} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 99, border: '1px solid', borderColor: i === ri ? '#22D3EE' : i < ri ? '#2EA56A' : '#1D2632', color: i === ri ? '#7DEFFF' : i < ri ? '#7CE7A2' : '#5A6A80' }}>
              {r[0]} · {r[1]}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {ACHIEVEMENTS.map(a => {
          const got = save.ach.includes(a.id);
          return (
            <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', opacity: got ? 1 : 0.55 }}>
              {got ? <Medal size={16} color="#FACC15" /> : <Lock size={14} color="#3A4759" />}
              <div>
                <div style={{ fontSize: 13.5, color: got ? '#FFE27A' : '#76849A' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: '#5A6A80' }}>{a.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: got ? '#FFC76B' : '#3A4759' }}>+{a.xp} xp</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- field manual ----------
const MANUAL = [
  ['Module template', "module name(\n  input        a,\n  input  [3:0] bus_in,\n  output       y,\n  output reg [3:0] q   // reg if driven in always\n);\n  wire [3:0] t;        // internal wiring\n  // logic here\nendmodule"],
  ['Literals', "4'b1010   // 4-bit binary = 10\n8'hD6     // 8-bit hex   = 214\n8'd214    // 8-bit decimal\n4'b10_10  // underscores ok\n7         // bare = 32-bit (be deliberate)"],
  ['Operators (high → low)', "~  !  -        // not, logical-not, negate\n&  |  ^  ~&    // reductions (unary, on a bus)\n*  /  %\n+  -\n<<  >>\n<  <=  >  >=\n==  !=\n&              // bitwise and\n^  ~^          // xor, xnor\n|              // bitwise or\n&&  ||         // logical\ncond ? a : b   // mux"],
  ['Wiring tricks', "{a, b}            // concatenate (a on top)\n{cout, sum} = a+b // split a wide result\n{4{bit}}          // replicate\nbus[7:4]          // part-select\nbus[i]            // bit-select\n|bus  &bus  ^bus  // any-set, all-set, parity"],
  ['The two always blocks', "// combinational: blocking =, cover every path\nalways @(*) begin\n  case (sel)\n    2'd0: y = a;\n    default: y = 1'b0;  // no latches\n  endcase\nend\n\n// clocked: non-blocking <=, reset first\nalways @(posedge clk) begin\n  if (rst)     q <= 4'd0;\n  else if (en) q <= q + 1;\n  // no else: register holds\nend"],
  ['Iron laws', "wire  <- driven by assign (one driver each)\nreg   <- driven inside always\nclocked  -> <=     combinational -> =\ncomb if needs else; comb case needs default\nclocked if without else just HOLDS (that's fine)\nN-bit + N-bit needs N+1 bits"],
  ['Dojo subset', "Supported: assign, always @(*) / @(posedge clk),\nif/else, case, parameter/localparam, all the\noperators above, up to 32-bit signals.\n\nNot here (yet, in your career): instantiation,\ninitial blocks, signed, x/z, generate, functions.\nThe bench drives clk and rst for you — sequential\ntests always start with a reset cycle."],
];
function ManualScreen({ go }) {
  return (
    <div style={{ marginTop: 22, maxWidth: 680 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <BookOpen size={18} color="#A3E635" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>FIELD MANUAL</h2>
      </div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
        {MANUAL.map(([title, body]) => (
          <div key={title} className="card" style={{ padding: '13px 15px' }}>
            <div className="eyebrow" style={{ marginBottom: 8, color: '#A3E635' }}>{title}</div>
            <pre className="code-common" style={{ fontSize: 12, overflowX: 'auto', color: '#B9C6D6' }}
              dangerouslySetInnerHTML={{ __html: highlightVerilog(body).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- App ----------
const SAVE_KEY = 'tapeout_save_v1'; // legacy single-save (auto-migrated to slot 1)
const META_KEY = 'tapeout_meta_v1';
const SLOT_KEY = (n) => 'tapeout_slot_' + n;
const DEFAULT_SAVE = {
  v: 2, xp: 0, done: {}, lessons: {}, ach: [],
  blitzHigh: 0, comboBest: 0, bugsSolved: [], bugClean: [],
  streak: { last: null, count: 0 }, sound: true, tapeoutDone: false,
  mode: 'apprentice', ngplus: false, doneNg: {},
  training: {}, trainTotal: 0, dailyDone: {}, dailyCount: 0,
  stats: { topics: {}, playMs: 0, runs: 0 },
  skill: {},
  campusVisited: false,
};
function normalizeSave(p) { return rpgFix(normalizeSaveBase(p)); }
function normalizeSaveBase(p) {
  const q = p || {};
  return {
    ...DEFAULT_SAVE, ...q,
    done: { ...(q.done || {}) }, doneNg: { ...(q.doneNg || {}) },
    lessons: { ...(q.lessons || {}) }, ach: [...(q.ach || [])],
    bugsSolved: [...(q.bugsSolved || [])], bugClean: [...(q.bugClean || [])],
    streak: { ...DEFAULT_SAVE.streak, ...(q.streak || {}) },
    training: { ...(q.training || {}) }, dailyDone: { ...(q.dailyDone || {}) },
    stats: {
      topics: { ...((q.stats && q.stats.topics) || {}) },
      playMs: (q.stats && q.stats.playMs) || 0,
      runs: (q.stats && q.stats.runs) || 0,
    },
    skill: { ...(q.skill || {}) },
    mode: ['apprentice', 'engineer', 'architect'].includes(q.mode) ? q.mode : 'apprentice',
    v: 2,
  };
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// ============================================================
// APP SHELL — save system, routing, screens wiring
// ============================================================
export default function App() {
  const [save, setSave] = useState(() => normalizeSave(null));
  const [activeSlot, setActiveSlot] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState({ name: 'menu' });
  const drillReturnRef = useRef(false);
  const [toasts, setToasts] = useState([]);
  const [rankModal, setRankModal] = useState(null);
  const [tapeoutModal, setTapeoutModal] = useState(null);
  const [levelModal, setLevelModal] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gfx, setGfx] = useState({ exposure: 1.2, lights: 1.2, ambient: 1.0, fog: 0.032, normal: 0.95, glow: 0.82, bloom: 0.9 });
  const [frNote, setFrNote] = useState(false);
  const [frText, setFrText] = useState('');
  const [frReport, setFrReport] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Backquote') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e2) { }
      setFrText(''); setFrNote(true);
    };
    try { window.addEventListener('keydown', h); } catch (e) { }
    return () => { try { window.removeEventListener('keydown', h); } catch (e) { } };
  }, []);
  const [resetArmed, setResetArmed] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const slotRef = useRef(activeSlot);
  slotRef.current = activeSlot;
  const toastId = useRef(0);
  const forgeKey = useRef(0);

  // ---- load (slot system + legacy migration) ----
  useEffect(() => {
    (async () => {
      let slot = 1;
      let s = normalizeSave(null);
      try {
        if (window.storage) {
          let meta = null;
          try { const m = await window.storage.get(META_KEY); if (m && m.value) meta = JSON.parse(m.value); } catch (e) { }
          if (!meta) {
            let legacy = null;
            try { const r = await window.storage.get(SAVE_KEY); if (r && r.value) legacy = JSON.parse(r.value); } catch (e) { }
            if (legacy) {
              try { await window.storage.set(SLOT_KEY(1), JSON.stringify(normalizeSave(legacy))); } catch (e) { }
              try { await window.storage.delete(SAVE_KEY); } catch (e) { }
            }
            meta = { active: 1 };
            try { await window.storage.set(META_KEY, JSON.stringify(meta)); } catch (e) { }
          }
          slot = meta.active || 1;
          try { const r = await window.storage.get(SLOT_KEY(slot)); if (r && r.value) s = normalizeSave(JSON.parse(r.value)); } catch (e) { }
        }
      } catch (e) { /* fresh wafer */ }
      const today = todayStr();
      if (s.streak.last !== today) {
        s.streak = { last: today, count: s.streak.last === yesterdayStr() ? s.streak.count + 1 : 1 };
      }
      AudioFX.enabled = s.sound;
      setActiveSlot(slot);
      setSave(s);
      setLoaded(true);
    })();
  }, []);

  // ---- persist (debounced, per-slot, stamps lastPlayed) ----
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try { window.storage && window.storage.set(SLOT_KEY(slotRef.current), JSON.stringify({ ...saveRef.current, lastPlayed: Date.now() })).catch(() => { }); } catch (e) { }
    }, 600);
    return () => clearTimeout(t);
  }, [save, loaded]);

  // ---- toasts ----
  const toast = useCallback((title, sub, kind) => {
    const id = ++toastId.current;
    setToasts(ts => [...ts.slice(-3), { id, title, sub, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3600);
  }, []);

  // ---- xp / achievements core ----
  const mutate = useCallback((fn) => {
    const prev = saveRef.current;
    const next = {
      ...prev,
      done: { ...prev.done }, doneNg: { ...prev.doneNg },
      lessons: { ...prev.lessons }, ach: [...prev.ach],
      skill: { ...prev.skill },
      bugsSolved: [...prev.bugsSolved], bugClean: [...prev.bugClean],
      streak: { ...prev.streak }, training: { ...prev.training },
      dailyDone: { ...prev.dailyDone },
      stats: { ...prev.stats, topics: { ...prev.stats.topics } },
    };
    const fx = [];
    const ctx = {
      addXp: (n, label) => { next.xp += n; if (label) fx.push([`+${n} XP`, label, undefined]); },
      award: (id) => {
        if (next.ach.includes(id)) return;
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (!def) return;
        next.ach.push(id);
        next.xp += def.xp;
        fx.push([`ACHIEVEMENT · ${def.name}`, `${def.desc} (+${def.xp} XP)`, 'ach']);
      },
    };
    const before = rankIndex(prev.xp);
    fn(next, ctx);
    if (next.streak.count >= 3) ctx.award('streak_3');
    if (next.streak.count >= 7) ctx.award('streak_7');
    const after = rankIndex(next.xp);
    saveRef.current = next;
    setSave(next);
    fx.forEach(([a, b, c]) => toast(a, b, c));
    if (after > before) {
      setTimeout(() => { AudioFX.rank(); setRankModal(RANKS[after][0]); setConfetti(['#22D3EE', '#7DEFFF', '#A3E635', '#FACC15']); }, 350);
    }
  }, [toast]);

  // streak check once after load
  useEffect(() => {
    if (!loaded) return;
    mutate(() => { });
  }, [loaded, mutate]);

  // play-time meter (counts only while the tab is visible)
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        mutate((s) => { s.stats.playMs += 30000; });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [loaded, mutate]);

  const completeChallenge = useCallback((id, stars, xp) => {
    try { FR.ev('clear', { id, stars, xp }); } catch (e) { }
    mutate((s, ctx) => {
      const ng = !!s.ngplus;
      const effMode = ng ? 'architect' : s.mode;
      const mult = modeOf(effMode).mult;
      const map = ng ? s.doneNg : s.done;
      const first = !map[id];
      const prevStars = map[id] ? map[id].stars : 0;
      map[id] = { stars: Math.max(prevStars, stars), mode: effMode };
      const _tp = TOPIC_OF[id];
      if (_tp) s.skill[_tp] = reviewUpdate(s.skill[_tp], Math.max(0.5, stars / 3), todayNum());
      if (first) {
        ctx.addXp(Math.round(xp * mult), ALL_CHALLENGES.find(c => c.id === id).title + ' cleared' + (mult > 1 ? ` (×${mult})` : ''));
        ctx.award('first_blood');
        const ch = ALL_CHALLENGES.find(c => c.id === id);
        if (ch.kind === 'code') ctx.award('it_compiles');
        if (!ng) {
          for (let w = 1; w <= 6; w++) if (worldDone(w, s)) ctx.award(`w${w}_done`);
          if (id === 'chip1') { s.tapeoutDone = true; ctx.award('tapeout'); }
        } else if (id === 'chip1') {
          ctx.award('second_silicon');
        }
      }
      const threeStars = Object.values(s.done).filter(d => d.stars === 3).length;
      if (threeStars >= 10) ctx.award('stars_10');
      const archCount = Object.values(s.done).filter(d => d.mode === 'architect').length
        + Object.values(s.doneNg).filter(d => d.mode === 'architect').length;
      if (archCount >= 10) ctx.award('iron_architect');
    });
  }, [mutate]);

  const onStat = useCallback((topic, pass) => {
    mutate((s) => {
      const t = s.stats.topics[topic] || { a: 0, p: 0 };
      s.stats.topics[topic] = { a: t.a + 1, p: t.p + (pass ? 1 : 0) };
      s.stats.runs += 1;
    });
  }, [mutate]);

  const onTrainingClear = useCallback((ch, daily) => {
    mutate((s, ctx) => {
      const mult = modeOf(s.ngplus ? 'architect' : s.mode).mult;
      if (daily) {
        const ds = ch.daily;
        if (!s.dailyDone[ds]) {
          s.dailyDone[ds] = true;
          s.dailyCount = (s.dailyCount || 0) + 1;
          ctx.addXp(Math.round(30 * mult), 'daily bench logged');
          if (s.dailyCount >= 7) ctx.award('daily_7');
        }
      } else {
        s.training[ch.gid] = (s.training[ch.gid] || 0) + 1;
        s.trainTotal = (s.trainTotal || 0) + 1;
        ctx.addXp(Math.round(15 * mult), 'training rep logged');
        if (s.trainTotal >= 25) ctx.award('forge_25');
      }
    });
  }, [mutate]);

  const onLessonRead = useCallback((lid) => {
    try { FR.ev('read', { id: lid }); } catch (e) { }
    mutate((s, ctx) => {
      if (s.lessons[lid]) return;
      s.lessons[lid] = true;
      ctx.addXp(5, 'field notes read');
      const allLessons = Object.values(LESSONS).flat();
      if (allLessons.every(L => s.lessons[L.id])) ctx.award('scholar');
    });
  }, [mutate]);

  const onBlitzEnd = useCallback((score, comboBest) => {
    mutate((s, ctx) => {
      if (score > 0) ctx.addXp(score, `Binary Blitz · ${score} correct`);
      if (score > s.blitzHigh) s.blitzHigh = score;
      if (comboBest > s.comboBest) s.comboBest = comboBest;
      if (score >= 15) ctx.award('blitz_15');
      if (score >= 30) ctx.award('blitz_30');
      if (comboBest >= 10) ctx.award('combo_10');
    });
  }, [mutate]);

  const onBugSolve = useCallback((id, clean) => {
    mutate((s, ctx) => {
      if (!s.bugsSolved.includes(id)) {
        s.bugsSolved.push(id);
        if (clean) s.bugClean.push(id);
        ctx.addXp(clean ? 15 : 8, 'bug squashed');
        if (s.bugsSolved.length >= 5) ctx.award('bug_5');
        if (s.bugsSolved.length >= 12) ctx.award('bug_all');
      }
    });
  }, [mutate]);

  const onCombatEnd = useCallback((r) => { mutate((s) => { if (r.win) { s.scrap = (s.scrap || 0) + r.scrap; s.combat.kills++; if (r.flawless) s.combat.flawless++; } if (r.death) { s.combat.deaths++; s.scrap = Math.max(0, (s.scrap || 0) - r.scrapLoss); } }); }, [mutate]);
  const onConsume = useCallback((k) => { mutate((s) => { if ((s.inv[k] || 0) > 0) s.inv[k]--; }); }, [mutate]);
  const onBuy = useCallback((iid) => { const it = ITEM_BY_ID[iid]; if (!it) return; AudioFX.good(); mutate((s) => { if ((s.scrap || 0) < it.cost) return; if (it.slot === 'consumable') { if ((s.inv[it.inv] || 0) >= 5) return; s.scrap -= it.cost; s.inv[it.inv] = (s.inv[it.inv] || 0) + 1; } else { if (s.owned.includes(iid)) return; s.scrap -= it.cost; s.owned.push(iid); s.gear[it.slot] = iid; } }); }, [mutate]);
  const onEquip = useCallback((iid) => { AudioFX.click(); mutate((s) => { const it = ITEM_BY_ID[iid]; if (it && s.owned.includes(iid)) s.gear[it.slot] = iid; }); }, [mutate]);
  useEffect(() => {
    const l = levelFromXp(save.xp || 0);
    if (save.lvlSeen !== undefined && l > save.lvlSeen) {
      setLevelModal({ from: save.lvlSeen, to: l });
      AudioFX.win();
      mutate((s) => { s.lvlSeen = l; });
    }
  }, [save.xp]); // eslint-disable-line

  const onVisited = useCallback(() => { mutate((s) => { s.campusVisited = true; }); }, [mutate]);

  const onBossWin = useCallback((ng) => {
    setTimeout(() => { setTapeoutModal(ng ? 'ng' : 'base'); setConfetti(['#FACC15', '#FFE27A', '#FB923C', '#7DEFFF', '#A3E635']); }, 600);
  }, []);

  // ---- difficulty / NG+ ----
  const setMode = useCallback((id) => {
    if (saveRef.current.mode === id || saveRef.current.ngplus) return;
    mutate((s) => { s.mode = id; });
    AudioFX.click();
    toast('Difficulty set', modeOf(id).label + ' — ' + modeOf(id).blurb);
  }, [mutate, toast]);

  const toggleNg = useCallback(() => {
    const cur = saveRef.current;
    if (!cur.tapeoutDone) return;
    const on = !cur.ngplus;
    mutate((s) => { s.ngplus = on; });
    AudioFX.click();
    toast(on ? 'NG+ ENGAGED' : 'NG+ disengaged',
      on ? 'Every spec remixed. Architect rules. Separate star track, 2× XP.' : 'Back to the first lap. NG+ stars are kept.',
      on ? 'ach' : undefined);
    setScreen({ name: 'home' });
  }, [mutate, toast]);

  // ---- profiles / slots ----
  const readSlot = useCallback(async (n) => {
    try {
      if (!window.storage) return null;
      const r = await window.storage.get(SLOT_KEY(n));
      if (!r || !r.value) return null;
      return normalizeSave(JSON.parse(r.value));
    } catch (e) { return null; }
  }, []);

  const activateSave = useCallback((slot, s) => {
    Object.keys(draftStore).forEach(k => delete draftStore[k]);
    const today = todayStr();
    if (s.streak.last !== today) {
      s.streak = { last: today, count: s.streak.last === yesterdayStr() ? s.streak.count + 1 : 1 };
    }
    AudioFX.enabled = s.sound;
    saveRef.current = s;
    slotRef.current = slot;
    setActiveSlot(slot);
    try { window.storage && window.storage.set(META_KEY, JSON.stringify({ active: slot })).catch(() => { }); } catch (e) { }
    try { window.storage && window.storage.set(SLOT_KEY(slot), JSON.stringify({ ...s, lastPlayed: Date.now() })).catch(() => { }); } catch (e) { }
    setSave(s);
  }, []);

  const onLoadSlot = useCallback(async (n) => {
    const s = (await readSlot(n)) || (() => { const f = normalizeSave(null); f.streak = { last: todayStr(), count: 1 }; return f; })();
    activateSave(n, s);
    toast('Slot ' + n + ' loaded', RANKS[rankIndex(s.xp)][0] + ' · ' + s.xp + ' XP');
  }, [readSlot, activateSave, toast]);

  const onNewSlot = useCallback((n) => {
    const fresh = normalizeSave(null);
    fresh.streak = { last: todayStr(), count: 1 };
    activateSave(n, fresh);
    toast('Fresh wafer in slot ' + n, 'Back to Intern. Make it count.');
  }, [activateSave, toast]);

  const onDeleteSlot = useCallback(async (n) => {
    try { window.storage && await window.storage.delete(SLOT_KEY(n)); } catch (e) { }
    if (n === slotRef.current) {
      const fresh = normalizeSave(null);
      fresh.streak = { last: todayStr(), count: 1 };
      activateSave(n, fresh);
    } else {
      setSave(s => ({ ...s })); // nudge ProfilesScreen to re-read slot summaries
    }
    toast('Slot ' + n + ' wiped', 'That wafer is gone.');
  }, [activateSave, toast]);

  const onImport = useCallback((raw) => {
    const s = normalizeSave(raw);
    activateSave(slotRef.current, s);
    toast('Save imported', RANKS[rankIndex(s.xp)][0] + ' restored into slot ' + slotRef.current);
  }, [activateSave, toast]);

  const toggleSound = () => {
    mutate(s => { s.sound = !s.sound; AudioFX.enabled = s.sound; });
    AudioFX.click();
  };

  const resetAll = () => {
    onNewSlot(slotRef.current);
    setResetArmed(false);
    setSettingsOpen(false);
    setScreen({ name: 'home' });
  };

  const go = useCallback((sc) => {
    try { FR.enter(sc.name + (sc.w ? ':' + sc.w : '')); } catch (e) { }
    if (drillReturnRef.current && sc && sc.name === 'world') { drillReturnRef.current = false; sc = { name: 'drill' }; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setScreen(sc);
    window.scrollTo({ top: 0 });
  }, []);

  // confetti auto-clear
  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(null), 4200);
    return () => clearTimeout(t);
  }, [confetti]);

  if (!loaded) {
    return (
      <div className="tk-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <div style={{ color: '#5A6A80', fontSize: 13, letterSpacing: '.2em' }}>POWERING ON<span className="cursorblink">_</span></div>
      </div>
    );
  }

  return (
    <div className="tk-root" onPointerDown={() => AudioFX.ensure()}>
      <style>{CSS}</style>
      <div className="scanlines" />
      {!['menu', 'campus', 'mine', 'arcade', 'dungeon', 'home'].includes(screen.name) && <Header save={save} onHome={() => go({ name: 'menu' })} onToggleSound={toggleSound} onSettings={() => setSettingsOpen(true)} />}
      <div className="wrap">
        {screen.name === 'menu' && <MainMenu save={save} go={go} onSettings={() => setSettingsOpen(true)} onNewGame={() => { setSave(normalizeSave(null)); go({ name: 'campus' }); }} />}
        {screen.name === 'drill' && <DrillScreen save={save} go={go} onReview={(id, kind) => { drillReturnRef.current = true; go({ name: kind, id }); }} />}
        {screen.name === 'tapeout' && <TapeoutBay save={save} go={go} />}
        {screen.name === 'world' && <WorldScreen w={screen.w} save={save} go={go} onLessonRead={onLessonRead} />}
        {screen.name === 'gauntlet' && <GauntletScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'truth' && <TruthScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'code' && <CodeScreen key={screen.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={screen.id} save={save} go={go} onComplete={completeChallenge} onBossWin={onBossWin} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'blitz' && <BlitzScreen save={save} go={go} onBlitzEnd={onBlitzEnd} />}
        {screen.name === 'bugs' && <BugScreen save={save} go={go} onBugSolve={onBugSolve} />}
        {(screen.name === 'campus' || screen.name === 'home') && <CampusScreen save={save} go={go} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'mine' && <MineScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'arcade' && <ArcadeScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'dungeon' && <DungeonScreen w={screen.w} save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'shop' && <ShopScreen save={save} go={go} onBuy={onBuy} onEquip={onEquip} />}
        {levelModal && <LevelUpModal info={levelModal} save={save} onClose={() => setLevelModal(null)} />}
        {screen.name === 'training' && <TrainingScreen save={save} go={go} />}
        {screen.name === 'forge' && <ForgeScreen key={screen.key} ch0={screen.ch} daily={!!screen.daily} save={save} go={go} onTrainingClear={onTrainingClear} onStat={onStat} />}
        {screen.name === 'profiles' && <ProfilesScreen save={save} activeSlot={activeSlot} go={go} onLoadSlot={onLoadSlot} onNewSlot={onNewSlot} onDeleteSlot={onDeleteSlot} onImport={onImport} readSlot={readSlot} />}
        {screen.name === 'ach' && <AchScreen save={save} go={go} />}
        {screen.name === 'manual' && <ManualScreen go={go} />}
      </div>

      <Toasts items={toasts} />
      {confetti && <Confetti colors={confetti} />}

      {rankModal && (
        <Modal onClose={() => setRankModal(null)} width={420}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div className="eyebrow" style={{ color: '#7DEFFF' }}>promotion</div>
            <Cpu size={34} color="#22D3EE" style={{ margin: '14px auto 8px', display: 'block' }} strokeWidth={1.4} />
            <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: '.06em', color: '#E8F1FA' }}>{rankModal.toUpperCase()}</div>
            <div style={{ fontSize: 12.5, color: '#76849A', margin: '8px 0 18px' }}>New badge printed. The fab expects more of you now.</div>
            <button className="btn primary" onClick={() => setRankModal(null)}>back to work</button>
          </div>
        </Modal>
      )}

      {tapeoutModal && (
        <Modal onClose={() => setTapeoutModal(null)} width={480}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div className="eyebrow" style={{ color: '#FACC15' }}>{tapeoutModal === 'ng' ? 'architect protocol survived' : 'final verification passed'}</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '.14em', margin: '14px 0 4px', color: '#FFE27A' }}>
              {tapeoutModal === 'ng' ? 'SECOND SILICON' : 'TAPEOUT'}
            </div>
            <div style={{ fontSize: 13, color: '#B9C6D6', maxWidth: 360, margin: '0 auto' }}>
              {tapeoutModal === 'ng'
                ? 'CHIP-2 ships. Remixed specs, hardened benches, no hints, no starter code, a ticking clock — and the testbench still signed off. There is nothing left in this dojo you cannot build.'
                : 'CHIP-1 is on the truck to the fab. Number systems, gates, combinational logic, registers, state machines — you used all of it, and the testbench signed off.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, margin: '18px 0', fontSize: 12, color: '#76849A' }}>
              <span>{save.xp} XP</span>
              <span>{tapeoutModal === 'ng' ? `NG+ ${Object.keys(save.doneNg).length}/${ALL_CHALLENGES.length}` : `${Object.keys(save.done).length}/${ALL_CHALLENGES.length} challenges`}</span>
              <span>{save.ach.length} achievements</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#5A6A80', marginBottom: 16 }}>
              {tapeoutModal === 'ng'
                ? 'Next stop: the same modules in real Vivado, then a Tiny Tapeout slot with your name etched in the silicon.'
                : 'Next stop after the Dojo: the same modules in real Vivado, then a Tiny Tapeout slot with your name in the silicon. (NG+ just unlocked in fab controls.)'}
            </div>
            <button className="btn gold" onClick={() => setTapeoutModal(null)}><Trophy size={14} /> accept the chip</button>
          </div>
        </Modal>
      )}

      {frNote && (
        <Modal onClose={() => setFrNote(false)} width={430}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>flight note · logged with screen + timestamp</div>
          <textarea value={frText} onChange={e => setFrText(e.target.value)} autoFocus rows={3}
            placeholder="what's broken / ugly / great, right here?"
            style={{ width: '100%', background: '#0A0F16', color: '#D7E0EA', border: '1px solid #273245', borderRadius: 8, padding: 10, font: 'inherit', fontSize: 13, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn primary" onClick={() => { AudioFX.click(); if (frText.trim()) FR.note(frText.trim()); setFrNote(false); }}>log it</button>
            <button className="btn sm" onClick={() => { AudioFX.click(); setFrNote(false); setFrReport(true); }}>view flight report</button>
          </div>
        </Modal>
      )}
      {frReport && (
        <Modal onClose={() => setFrReport(false)} width={580}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>flight report · paste this to Claude</div>
          <textarea readOnly value={FR.report(save, gfx)} rows={16}
            style={{ width: '100%', background: '#0A0F16', color: '#9FE8C8', border: '1px solid #273245', borderRadius: 8, padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, whiteSpace: 'pre', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn primary" onClick={() => { AudioFX.click(); try { navigator.clipboard && navigator.clipboard.writeText(FR.report(save, gfx)); } catch (e) { } }}>copy report</button>
          </div>
        </Modal>
      )}
      {settingsOpen && (
        <Modal onClose={() => { setSettingsOpen(false); setResetArmed(false); }} width={470}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>fab controls</div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#7DEFFF' }}>flight recorder</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => { AudioFX.click(); setSettingsOpen(false); setFrReport(true); }}>view flight report</button>
            <button className="btn sm" onClick={() => { AudioFX.click(); setSettingsOpen(false); setFrText(''); setFrNote(true); }}>add note ( ` )</button>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#7DEFFF' }}>difficulty</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
            {MODES.map(m => {
              const sel = (save.ngplus ? 'architect' : save.mode) === m.id;
              return (
                <button key={m.id} className="card" onClick={() => setMode(m.id)} disabled={save.ngplus}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', font: 'inherit', color: 'inherit', cursor: save.ngplus ? 'not-allowed' : 'pointer', textAlign: 'left', borderColor: sel ? '#22D3EE' : '#1D2632', opacity: save.ngplus && m.id !== 'architect' ? .45 : 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, width: 92, flexShrink: 0, color: sel ? '#7DEFFF' : '#D7E0EA' }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, color: '#76849A' }}>{m.blurb}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: save.ngplus ? '#FFC76B' : '#3A4759', marginBottom: 14 }}>
            {save.ngplus ? 'NG+ pins the fab to Architect rules.' : 'Switch any time — earned stars and XP are kept.'}
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#FFE27A' }}>new game+</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={!save.tapeoutDone}
              style={save.ngplus ? { borderColor: '#7A6310', color: '#FFE27A' } : null}
              onClick={toggleNg}>
              <Zap size={12} /> {save.ngplus ? 'NG+ engaged — disengage' : 'engage NG+'}
            </button>
            <span style={{ fontSize: 11.5, color: '#5A6A80' }}>
              {save.tapeoutDone ? 'every spec remixed · architect rules · separate stars' : 'locked until CHIP-1 tapes out'}
            </span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#A3E635' }}>graphics</div>
          <div style={{ marginBottom: 16 }}>
            <GfxPanel gfx={gfx} setGfx={setGfx} accent="#A3E635" embedded />
            <div style={{ fontSize: 11, color: '#5A6A80', marginTop: 2 }}>Applies across the mines &amp; die blocks — brightness, lights, fog &amp; glow.</div>
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>wafers</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { AudioFX.click(); setSettingsOpen(false); setResetArmed(false); go({ name: 'profiles' }); }}><Cpu size={13} /> profiles & save codes</button>
            <button className="btn" style={{ borderColor: '#B14A52', color: '#FF8B82' }}
              onClick={() => { if (resetArmed) resetAll(); else { AudioFX.bad(); setResetArmed(true); } }}>
              <RotateCcw size={13} /> {resetArmed ? 'click again — no undo' : `scrap wafer (reset slot ${activeSlot})`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// META UI — training grounds, forge, profiles, stats
// ============================================================

function starterFromIface(iface) {
  const lines = iface.ports.map((p, i) => {
    const dir = p.d === 'in' ? 'input ' : 'output';
    const rng = p.w > 1 ? ` [${p.w - 1}:0]` : '';
    return `  ${dir}${rng} ${p.n}${i < iface.ports.length - 1 ? ',' : ''}`;
  });
  return `module ${iface.name}(\n${lines.join('\n')}\n);\n  // your logic here\n\nendmodule\n`;
}

// ---------- Forge: generic runner for dynamic challenges ----------
function ForgeScreen({ ch0, daily, save, go, onTrainingClear, onStat }) {
  const effMode = save.ngplus ? 'architect' : save.mode;
  const M = modeOf(effMode);
  const [ch, setCh] = useState(ch0);
  const mkStarter = (c) => effMode === 'architect'
    ? `// ARCHITECT MODE — build module ${c.iface.name} from the interface spec\n\n`
    : starterFromIface(c.iface);
  const [code, setCode] = useState(() => mkStarter(ch0));
  const [out, setOut] = useState(null);
  const [errLines, setErrLines] = useState(new Set());
  const [solOpen, setSolOpen] = useState(false);
  const [passed, setPassed] = useState(false);
  const attemptsRef = useRef(0);
  const awardedRef = useRef(false);
  const test = useMemo(() => effMode === 'apprentice' ? ch.test : hardenTest(ch), [ch, effMode]);
  const topic = TOPIC_OF[ch.gid] || 'boolean';
  const gmeta = TRAINING_GENS.find(g => g.gid === ch.gid);

  const freshSpec = () => {
    AudioFX.click();
    const next = gmeta.gen(mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9)));
    setCh(next); setCode(mkStarter(next)); setOut(null); setErrLines(new Set());
    setSolOpen(false); setPassed(false); attemptsRef.current = 0; awardedRef.current = false;
  };

  const run = () => {
    AudioFX.click();
    const res = vCompile(code, ch.iface);
    const lines = [];
    const eset = new Set();
    if (!res.ok) {
      attemptsRef.current++;
      onStat(topic, false);
      res.errors.forEach(e => {
        lines.push({ cls: 'c-err', text: `ERROR${e.line ? ' line ' + e.line : ''}: ${e.msg}` });
        if (e.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + e.hint });
        if (e.line) eset.add(e.line);
      });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result: null });
      return;
    }
    (res.warnings || []).forEach(w => lines.push({ cls: 'c-warn', text: `warning line ${w.line}: ${w.msg}` }));
    let result;
    try { result = runChallengeTest(res.mod, test); }
    catch (e) { lines.push({ cls: 'c-err', text: 'SIM ERROR: ' + e.message }); setOut({ lines, result: null }); AudioFX.bad(); return; }
    if (result.runtimeError) {
      attemptsRef.current++;
      onStat(topic, false);
      lines.push({ cls: 'c-err', text: `RUNTIME${result.runtimeError.line ? ' line ' + result.runtimeError.line : ''}: ${result.runtimeError.msg}` });
      if (result.runtimeError.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + result.runtimeError.hint });
      if (result.runtimeError.line) eset.add(result.runtimeError.line);
      AudioFX.bad(); setErrLines(eset); setOut({ lines, result });
      return;
    }
    if (result.pass) {
      onStat(topic, true);
      lines.push({ cls: 'c-ok', text: `BENCH PASSED — ${result.total}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} ✓` });
      if (!awardedRef.current) {
        awardedRef.current = true;
        onTrainingClear(ch, daily, solOpen);
        lines.push({ cls: 'c-dim', text: daily ? '// daily bench logged' : '// training rep logged' });
      }
      setPassed(true);
      AudioFX.win();
    } else {
      attemptsRef.current++;
      onStat(topic, false);
      lines.push({ cls: 'c-err', text: `BENCH FAILED — ${result.passCount}/${result.total} passing` });
      AudioFX.bad();
    }
    setErrLines(new Set());
    setOut({ lines, result });
  };

  const inputNames = ch.iface.ports.filter(p => p.d === 'in' && p.n !== 'clk').map(p => p.n);
  const widths = {};
  ch.iface.ports.forEach(p => widths[p.n] = p.w);
  const accent = daily ? '#FACC15' : '#7DEFFF';

  return (
    <div style={{ marginTop: 22 }}>
      <button className="lnk" onClick={() => go({ name: 'training' })}><ChevronLeft size={14} /> training grounds</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 10px', flexWrap: 'wrap' }}>
        {daily ? <Flame size={16} color="#FACC15" /> : <Sparkles size={15} color="#7DEFFF" />}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{ch.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{ch.xp} xp{M.mult > 1 ? ` ×${M.mult}` : ''}{daily && save.dailyDone[ch.daily] ? ' · logged today' : ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, letterSpacing: '.14em', color: effMode === 'architect' ? '#FFC76B' : '#5A6A80' }}>{M.label.toUpperCase()}</span>
      </div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 13.5, color: '#B9C6D6' }}>
            <div className="lessonbody"><Paragraphs text={ch.brief} /></div>
            <div className="eyebrow" style={{ margin: '14px 0 6px' }}>interface · module {ch.iface.name}</div>
            <PortTable iface={ch.iface} accent={accent} />
          </div>
          <div className="card" style={{ marginTop: 10, padding: '12px 16px', fontSize: 12.5, color: '#76849A' }}>
            {effMode === 'architect'
              ? 'ARCHITECT — no hints, no starter. The spec above is everything.'
              : 'No hints in the training yard — the brief is the spec.'}
            {attemptsRef.current >= 3 && !solOpen && (
              <div><button className="lnk" style={{ marginTop: 8, color: '#FFC76B', paddingLeft: 0 }} onClick={() => { AudioFX.click(); setSolOpen(true); }}><Eye size={13} /> show a reference solution</button></div>
            )}
            {solOpen && (
              <pre className="code-common" style={{ marginTop: 10, background: '#0A0E14', border: '1px solid #3A2E14', borderRadius: 7, padding: '10px 13px', overflowX: 'auto', fontSize: 12.5 }}
                dangerouslySetInnerHTML={{ __html: highlightVerilog(ch.solution).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
            )}
          </div>
        </div>
        <div>
          <CodeEditor value={code} onChange={setCode} onRun={run} errLines={errLines} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
            <button className={'btn ' + (daily ? 'gold' : 'primary')} onClick={run}><Play size={13} /> COMPILE & RUN</button>
            <span className="eyebrow hidesm">ctrl+enter</span>
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setCode(mkStarter(ch)); setOut(null); setErrLines(new Set()); }}><RotateCcw size={12} /> reset</button>
          </div>
          <ConsoleOut state={out} />
          {out && out.result && !out.result.runtimeError && (
            <div style={{ marginTop: 10 }}>
              {out.result.kind === 'comb'
                ? <CombResults result={out.result} iface={ch.iface} />
                : <Waveform trace={out.result.trace} watch={test.watch} inputNames={inputNames} widths={widths} accent={accent} />}
            </div>
          )}
          {passed && (
            <div className="popin" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!daily && <button className="btn primary" onClick={freshSpec}><Sparkles size={13} /> another one</button>}
              <button className="btn" onClick={() => go({ name: 'training' })}>training grounds <ChevronRight size={13} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Training Grounds ----------
function TrainingScreen({ save, go }) {
  const today = todayStr();
  const dailyCh = useMemo(() => dailyFor(today), [today]);
  const dailyDone = !!save.dailyDone[today];
  const M = modeOf(save.ngplus ? 'architect' : save.mode);
  return (
    <div style={{ marginTop: 22, maxWidth: 720 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Sparkles size={18} color="#7DEFFF" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>TRAINING GROUNDS</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{save.trainTotal || 0} reps logged</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 16 }}>
        Infinite procedurally-generated benches — fresh specs every time, graded by the same engine as the campaign. {15 * M.mult} XP per clear at {M.label} pace. This is where sight-reading turns into muscle.
      </div>

      <button className="card" onClick={() => { AudioFX.click(); go({ name: 'forge', ch: dailyCh, daily: true }); }}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '14px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: dailyDone ? '#2EA56A' : '#7A6310', marginBottom: 16 }}>
        <Flame size={17} color="#FACC15" fill={dailyDone ? '#FACC15' : 'none'} />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#FFE27A', letterSpacing: '.03em' }}>{dailyCh.title}</div>
          <div style={{ fontSize: 11.5, color: '#76849A' }}>same puzzle for everyone today · {Math.round(30 * M.mult)} XP once per day · {save.dailyCount || 0} dailies logged</div>
        </div>
        <span style={{ marginLeft: 'auto' }}>{dailyDone ? <Check size={16} color="#7CE7A2" /> : <ChevronRight size={15} color="#5A6A80" />}</span>
      </button>

      <div className="eyebrow" style={{ marginBottom: 8 }}>practice ranges</div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {TRAINING_GENS.map(g => (
          <button key={g.gid} className="card" onClick={() => {
            AudioFX.click();
            const ch = g.gen(mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9)));
            go({ name: 'forge', ch, daily: false });
          }}
            style={{ padding: '13px 15px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7DEFFF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1D2632'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Terminal size={14} color="#7DEFFF" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{(save.training && save.training[g.gid]) || 0} clears</span>
            </div>
            <div style={{ fontSize: 12, color: '#76849A', marginTop: 5 }}>{g.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Stats panel (lives in Service Record) ----------
function fmtPlay(ms) {
  const m = Math.floor((ms || 0) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function StatsPanel({ save }) {
  const stats = save.stats || { topics: {}, playMs: 0, runs: 0 };
  const cleared = Object.keys(save.done).length;
  const clearedNg = Object.keys(save.doneNg || {}).length;
  const threeStar = Object.values(save.done).filter(d => d.stars === 3).length;
  const nums = [
    ['xp', save.xp], ['cleared', `${cleared}/${ALL_CHALLENGES.length}` + (save.ngplus || clearedNg ? ` · NG+ ${clearedNg}` : '')],
    ['3★', threeStar], ['time', fmtPlay(stats.playMs)],
    ['blitz', save.blitzHigh], ['combo', '×' + (save.comboBest || 0)],
    ['bugs', `${save.bugsSolved.length}/12`], ['dailies', save.dailyCount || 0], ['reps', save.trainTotal || 0],
  ];
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>engineering stats</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginBottom: 14 }}>
        {nums.map(([k, v]) => (
          <span key={k} style={{ fontSize: 12.5 }}><span style={{ color: '#5A6A80' }}>{k} </span><span style={{ color: '#D7E0EA' }}>{v}</span></span>
        ))}
      </div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>accuracy by topic · first-try precision across {stats.runs || 0} graded attempts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TOPIC_LIST.map(t => {
          const d = stats.topics[t.id];
          const acc = d && d.a > 0 ? d.p / d.a : null;
          const col = acc === null ? '#1D2632' : acc >= 0.8 ? '#2EA56A' : acc >= 0.55 ? '#FFC76B' : '#B14A52';
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: '#76849A', width: 130, flexShrink: 0 }}>{t.label}</span>
              <div className="hbar" style={{ flex: 1 }}>
                <div style={{ width: (acc === null ? 0 : Math.max(4, acc * 100)) + '%', background: col }} />
              </div>
              <span style={{ fontSize: 11, color: acc === null ? '#3A4759' : '#A9B7C9', width: 70, textAlign: 'right' }}>
                {acc === null ? '—' : `${Math.round(acc * 100)}% · ${d.p}/${d.a}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>concept recall · spaced review{(() => { const due = dueTopics(save.skill, todayNum()).length; return due ? ` · ${due} due` : ''; })()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TOPIC_LIST.map(t => {
          const rec = (save.skill || {})[t.id];
          const lvl = masteryLevel(rec);
          const due = rec && rec.seen && (rec.dueDay || 0) <= todayNum();
          const names = ['—', 'learning', 'practiced', 'mastered'];
          const cols = ['#1D2632', '#FFC76B', '#7FB2E8', '#2EA56A'];
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: '#76849A', width: 130, flexShrink: 0 }}>{t.label}</span>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 22, height: 6, borderRadius: 3, background: i < lvl ? cols[lvl] : '#161E28' }} />)}
              </div>
              <span style={{ fontSize: 11, color: lvl ? '#A9B7C9' : '#3A4759', width: 70, textAlign: 'right' }}>{names[lvl]}{due ? ' ·due' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- save export / import ----------
function checksum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i % 31 + 1)) % 65521; return h.toString(16); }
function exportSave(save) {
  const json = JSON.stringify(save);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return 'TPO1.' + b64 + '.' + checksum(b64);
}
function importSave(str) {
  const parts = (str || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'TPO1') throw new Error('Not a TAPEOUT save code.');
  if (checksum(parts[1]) !== parts[2]) throw new Error('Checksum mismatch — the code got mangled in transit.');
  const json = decodeURIComponent(escape(atob(parts[1])));
  const s = JSON.parse(json);
  if (typeof s.xp !== 'number' || typeof s.done !== 'object') throw new Error('Save code is missing core fields.');
  return s;
}

// ---------- Profiles ----------
function ProfilesScreen({ save, activeSlot, go, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }) {
  const [infos, setInfos] = useState(null);
  const [armed, setArmed] = useState(null); // {action, slot}
  const [exportStr, setExportStr] = useState(null);
  const [importStr, setImportStr] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const out = [];
    for (const n of [1, 2, 3]) out.push(await readSlot(n));
    setInfos(out);
  }, [readSlot]);
  useEffect(() => { refresh(); }, [refresh, save]);

  const arm = (action, slot, fn) => {
    if (armed && armed.action === action && armed.slot === slot) { setArmed(null); fn(); }
    else { AudioFX.click(); setArmed({ action, slot }); }
  };

  const doImport = () => {
    try {
      const s = importSave(importStr);
      onImport(s);
      setImportMsg({ ok: true, text: `Save imported into slot ${activeSlot} — rank restored.` });
      setImportStr('');
    } catch (e) {
      AudioFX.bad();
      setImportMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 620 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <Cpu size={18} color="#22D3EE" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>PROFILES</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map((n, idx) => {
          const info = infos && infos[idx];
          const active = n === activeSlot;
          return (
            <div key={n} className="card" style={{ padding: '13px 15px', borderColor: active ? '#155E6B' : '#1D2632' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="eyebrow" style={{ color: active ? '#7DEFFF' : '#5A6A80' }}>slot {n}{active ? ' · active' : ''}</span>
                {info ? (
                  <span style={{ fontSize: 12.5, color: '#B9C6D6' }}>
                    {RANKS[rankIndex(info.xp)][0]} · {info.xp} XP · {Object.keys(info.done || {}).length}/{ALL_CHALLENGES.length} cleared{info.ngplus ? ' · NG+' : ''}
                  </span>
                ) : infos ? <span style={{ fontSize: 12.5, color: '#3A4759' }}>empty wafer</span> : <span style={{ fontSize: 12.5, color: '#3A4759' }}>reading…</span>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {!active && info && <button className="btn sm" onClick={() => { AudioFX.click(); onLoadSlot(n); }}>load</button>}
                  <button className="btn sm" style={armed && armed.action === 'new' && armed.slot === n ? { borderColor: '#FFC76B', color: '#FFC76B' } : null}
                    onClick={() => arm('new', n, () => onNewSlot(n))}>
                    {armed && armed.action === 'new' && armed.slot === n ? 'confirm new' : 'new'}
                  </button>
                  {info && <button className="btn sm" style={armed && armed.action === 'del' && armed.slot === n ? { borderColor: '#FF8B82', color: '#FF8B82' } : null}
                    onClick={() => arm('del', n, () => onDeleteSlot(n))}>
                    {armed && armed.action === 'del' && armed.slot === n ? 'confirm delete' : 'delete'}
                  </button>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="eyebrow" style={{ margin: '20px 0 8px' }}>save portability · walks across devices and artifact versions</div>
      <div className="card" style={{ padding: '13px 15px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm primary" onClick={() => { AudioFX.click(); setExportStr(exportSave(save)); setCopied(false); }}>export active slot</button>
          {exportStr && (
            <button className="btn sm" onClick={async () => {
              try { await navigator.clipboard.writeText(exportStr); setCopied(true); AudioFX.good(); } catch (e) { setCopied(false); }
            }}>{copied ? 'copied ✓' : 'copy code'}</button>
          )}
        </div>
        {exportStr && (
          <textarea readOnly className="field" style={{ marginTop: 10, fontSize: 11, height: 84, resize: 'vertical' }} value={exportStr}
            onFocus={e => e.target.select()} aria-label="export code" />
        )}
        <div style={{ marginTop: 14 }}>
          <textarea className="field" style={{ fontSize: 11, height: 64, resize: 'vertical' }} placeholder="paste a TPO1 save code to import into the active slot…"
            value={importStr} onChange={e => { setImportStr(e.target.value); setImportMsg(null); }} aria-label="import code" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button className="btn sm" disabled={!importStr.trim()} onClick={doImport}>import → slot {activeSlot}</button>
            {importMsg && <span style={{ fontSize: 12, color: importMsg.ok ? '#7CE7A2' : '#FF8B82' }}>{importMsg.text}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMBAT SYSTEM — combat hook, HUD, flatline, shop, level-up
// ============================================================

function useCombat({ enemy, save, live: liveIn, onEnd, onConsume }) {
  const live0 = useRef(liveIn).current;
  const stats = useMemo(() => derivedStats(save), [save.xp, save.gear]);
  const [php, setPhp] = useState(stats.maxHp);
  const [ehp, setEhp] = useState(enemy.hp);
  const [phase, setPhase] = useState(1);
  const phaseRef = useRef(1); phaseRef.current = phase;
  const [phaseT, setPhaseT] = useState(0);
  const [tele, setTele] = useState(0);
  const [feed, setFeed] = useState([]);
  const [over, setOver] = useState(null); // 'won' | 'dead'
  const [fluxArmed, setFluxArmed] = useState(false);
  const bestRef = useRef(0);
  const hitRef = useRef(false);
  const endedRef = useRef(false);
  const nextRef = useRef(null);
  const overRef = useRef(null); overRef.current = over;
  const fluxRef = useRef(false); fluxRef.current = fluxArmed;
  const statsRef = useRef(stats); statsRef.current = stats;
  const saveRef = useRef(save); saveRef.current = save;
  const fid = useRef(0);
  const push = (txt, cls) => setFeed(f => [...f.slice(-3), { id: ++fid.current, txt, cls }]);
  const psp = () => enemy.boss ? (phaseRef.current >= 3 ? 0.84 : phaseRef.current === 2 ? 0.92 : 1) : 1;
  const pdm = () => enemy.boss ? (phaseRef.current >= 3 ? 1.16 : phaseRef.current === 2 ? 1.08 : 1) : 1;
  const applyEhp = (ne) => {
    setEhp(ne);
    if (!enemy.boss) return;
    const np = bossPhase(ne, enemy.hp);
    if (np > phaseRef.current) {
      phaseRef.current = np; setPhase(np); setPhaseT(Date.now()); AudioFX.bad();
      push(enemy.name + (np >= 3 ? ' — LAST STAND · PHASE III' : ' — ENRAGED · PHASE II'), 'boss');
      if (nextRef.current) nextRef.current = Math.min(nextRef.current, Date.now() + 700);
    }
  };

  useEffect(() => {
    if (!live0) return;
    nextRef.current = Date.now() + enemy.grace * 1000;
    const iv = setInterval(() => {
      if (overRef.current) return;
      const now = Date.now();
      const windowMs = enemy.interval * 1000 * statsRef.current.slowMult * psp();
      setTele(Math.max(0, Math.min(1, 1 - (nextRef.current - now) / windowMs)));
      if (now >= nextRef.current) {
        const dmg = Math.max(1, Math.round(enemy.atk * (1 - statsRef.current.defPct) * pdm()));
        hitRef.current = true;
        AudioFX.bad();
        push(enemy.name + ' hits — −' + dmg + ' HP', 'hit');
        nextRef.current = now + windowMs;
        setPhp(p => {
          const np = Math.max(0, p - dmg);
          if (np <= 0 && !endedRef.current) { try { FR.ev('flatline', {}); } catch (eFl) { } setOver('dead'); }
          return np;
        });
      }
    }, 120);
    return () => clearInterval(iv);
  }, [live0]); // eslint-disable-line

  const suppress = () => {
    const sec = Math.min(20, (0.5 + statsRef.current.atk / 10) * (fluxRef.current ? 3 : 1));
    if (nextRef.current) nextRef.current = Math.max(nextRef.current, Date.now()) + sec * 1000;
    push((fluxRef.current ? 'flux burn — ' : '') + 'suppressed +' + sec.toFixed(1) + 's', 'good');
    if (fluxRef.current) setFluxArmed(false);
    if (statsRef.current.lifesteal) setPhp(p => Math.min(statsRef.current.maxHp, p + statsRef.current.lifesteal));
  };
  const counter = (why) => {
    const dmg = Math.max(1, Math.round(enemy.counter * (1 - statsRef.current.defPct) * pdm()));
    hitRef.current = true;
    push(why + ' — −' + dmg + ' HP', 'hit');
    setPhp(p => {
      const np = Math.max(0, p - dmg);
      if (np <= 0 && !endedRef.current) { try { FR.ev('flatline', {}); } catch (eFl) { } setOver('dead'); }
      return np;
    });
  };
  const victory = () => {
    if (endedRef.current || !live0 || overRef.current === 'dead') return;
    endedRef.current = true;
    setEhp(0); setOver('won');
    const flaw = !hitRef.current;
    const scrap = Math.round(enemy.scrap * statsRef.current.scrapMult * (flaw ? 1.5 : 1));
    push(enemy.name + ' destroyed · +' + scrap + ' scrap' + (flaw ? ' · FLAWLESS ×1.5' : ''), 'win');
    onEnd({ win: true, scrap, flawless: flaw });
  };
  const onRun = ({ ok, frac }) => {
    if (!live0 || overRef.current) return;
    if (ok) { victory(); return; }
    const f = Math.max(0, Math.min(1, frac || 0));
    if (f > bestRef.current) {
      const gained = f - bestRef.current;
      bestRef.current = f;
      applyEhp(Math.max(1, Math.round(enemy.hp * (1 - f))));
      push('dealt ' + Math.max(1, Math.round(enemy.hp * gained)) + ' dmg', 'good');
      suppress();
    } else {
      counter('no ground gained');
    }
  };
  const onAnswer = (right) => {
    if (!live0 || overRef.current) return;
    if (right) {
      bestRef.current = Math.min(1, bestRef.current + 0.2);
      applyEhp(Math.max(1, Math.round(enemy.hp * (1 - bestRef.current))));
      push('clean hit — ' + Math.round(enemy.hp * 0.2) + ' dmg', 'good');
      suppress();
    } else counter('counterattack');
  };
  const retreatDead = () => {
    if (endedRef.current) return 0;
    endedRef.current = true;
    const loss = Math.min(saveRef.current.scrap || 0, Math.max(10, Math.round(enemy.scrap * 0.6)));
    onEnd({ death: true, scrapLoss: loss });
    return loss;
  };
  const potion = () => {
    if (!live0 || overRef.current) return;
    if ((saveRef.current.inv && saveRef.current.inv.potions || 0) <= 0) return;
    onConsume('potions');
    AudioFX.good();
    setPhp(p => Math.min(statsRef.current.maxHp, p + 40));
    push('solder ration — +40 HP', 'good');
  };
  const flux = () => {
    if (!live0 || overRef.current || fluxArmed) return;
    if ((saveRef.current.inv && saveRef.current.inv.flux || 0) <= 0) return;
    onConsume('flux');
    AudioFX.click();
    setFluxArmed(true);
    push('flux armed — next gain ×3 suppression', 'good');
  };

  return { live: live0, stats, enemy, php, ehp, tele, feed, over, dead: over === 'dead', won: over === 'won', fluxArmed, onRun, onAnswer, victory, retreatDead, potion, flux, phase, phaseT };
}

function Bar({ pct, color, h }) {
  return (
    <div style={{ height: h || 8, background: '#11161F', borderRadius: 99, overflow: 'hidden', marginTop: 3, border: '1px solid #1A2230' }}>
      <div style={{ height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color, transition: 'width .25s ease' }} />
    </div>
  );
}

function CombatHUD({ c, save }) {
  if (!c) return null;
  if (!c.live) {
    return (
      <div className="card" style={{ margin: '10px 0 4px', padding: '8px 14px', display: 'flex', gap: 9, alignItems: 'center' }}>
        <Swords size={13} color="#5A6A80" />
        <span className="eyebrow">sparring — already cleared, the {c.enemy.name.toLowerCase()} won't bite</span>
      </div>
    );
  }
  const hpPct = c.php / c.stats.maxHp * 100;
  const ePct = c.ehp / c.enemy.hp * 100;
  const pots = (save.inv && save.inv.potions) || 0;
  const fluxN = (save.inv && save.inv.flux) || 0;
  return (
    <div className="card" style={{ margin: '10px 0 4px', padding: '10px 14px', borderColor: c.enemy.boss ? '#7A6310' : undefined }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8FA3BC', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Heart size={11} color="#7CE7A2" /> ENGINEER · Lv {c.stats.lvl}</span>
            <span>{c.php}/{c.stats.maxHp}</span>
          </div>
          <Bar pct={hpPct} color={hpPct > 50 ? '#2EA56A' : hpPct > 25 ? '#FFC76B' : '#FF6B62'} />
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button className="btn sm" disabled={pots <= 0} onClick={c.potion} title="restore 40 HP">
              <FlaskConical size={11} /> ration ×{pots}
            </button>
            <button className="btn sm" disabled={fluxN <= 0 || c.fluxArmed} onClick={c.flux} title="next improving run ×3 suppression"
              style={c.fluxArmed ? { borderColor: '#7DEFFF', color: '#7DEFFF' } : undefined}>
              <Zap size={11} /> {c.fluxArmed ? 'flux armed' : 'flux ×' + fluxN}
            </button>
          </div>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.enemy.boss ? '#FFE27A' : '#FF8B82', letterSpacing: '.06em' }}>
              <Skull size={11} /> {c.enemy.name}{c.enemy.boss ? ' · BOSS' : ''}
            </span>
            <span style={{ color: '#8FA3BC' }}>{c.ehp}/{c.enemy.hp}</span>
          </div>
          <Bar pct={ePct} color={c.enemy.boss ? '#FACC15' : '#C4453F'} />
          {c.enemy.boss && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
              {[1, 2, 3].map(p => (
                <span key={p} style={{ flex: 1, height: 4, borderRadius: 2, transition: 'background .25s', background: p <= (c.phase || 1) ? ((c.phase || 1) >= 3 ? '#FF6B62' : '#FACC15') : '#2A3344' }} />
              ))}
              <span style={{ fontSize: 9, color: '#8FA3BC', letterSpacing: '.12em', marginLeft: 4 }}>PHASE {['I', 'II', 'III'][(c.phase || 1) - 1]}</span>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#76849A', marginTop: 7, display: 'flex', justifyContent: 'space-between' }}>
            <span>winding up{c.tele > 0.85 ? ' — BRACE' : ''}</span>
          </div>
          <Bar pct={c.tele * 100} color={c.tele > 0.85 ? '#FF6B62' : '#3A4A63'} h={4} />
        </div>
      </div>
      {c.feed.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #161D29', paddingTop: 6 }}>
          {c.feed.map(f => (
            <div key={f.id} style={{ fontSize: 11, color: f.cls === 'hit' ? '#FF8B82' : f.cls === 'win' ? '#FFE27A' : '#7CE7A2' }}>{f.txt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlatlineOverlay({ c, onRetreat }) {
  const [loss, setLoss] = useState(null);
  useEffect(() => { setLoss(c.retreatDead()); AudioFX.bad(); }, []); // eslint-disable-line
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,10,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card popin" style={{ maxWidth: 440, padding: 26, textAlign: 'center', borderColor: '#B14A52' }}>
        <Skull size={30} color="#FF6B62" style={{ margin: '0 auto' }} />
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '.12em', color: '#FF8B82', margin: '12px 0 6px' }}>FLATLINED</div>
        <div style={{ fontSize: 13, color: '#B9C6D6', lineHeight: 1.6 }}>
          The {c.enemy.name.toLowerCase()} grinds you into the substrate.
          {loss > 0 ? <> Scavengers strip <b style={{ color: '#FFC76B' }}>{loss} scrap</b> from your kit.</> : null} Your code draft survives — come back leveled, geared, or both.
        </div>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { AudioFX.click(); onRetreat(); }}>
          crawl back <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, val }) {
  return (
    <span style={{ fontSize: 11.5, border: '1px solid #1D2632', borderRadius: 6, padding: '4px 9px', color: '#B9C6D6' }}>
      <span style={{ color: '#76849A' }}>{label} </span>{val}
    </span>
  );
}

function ShopScreen({ save, go, onBuy, onEquip }) {
  const st = derivedStats(save);
  const groups = [['weapon', 'probes'], ['armor', 'suits'], ['tool', 'talismans'], ['consumable', 'rations']];
  return (
    <div style={{ marginTop: 22, maxWidth: 760 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.06em' }}>SCRAP EXCHANGE</h2>
        <span style={{ fontSize: 14, color: '#FFC76B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Coins size={14} /> {save.scrap || 0}
        </span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 12 }}>Scrap in, edge out. Kills pay; flawless kills pay half again.</div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>loadout · Lv {st.lvl}</span>
        <StatChip label="HP" val={st.maxHp} />
        <StatChip label="ATK" val={st.atk} />
        <StatChip label="DEF" val={Math.round(st.defPct * 100) + '%'} />
        {st.lifesteal > 0 && <StatChip label="LEECH" val={'+' + st.lifesteal} />}
        {st.scrapMult > 1 && <StatChip label="SALVAGE" val={'+' + Math.round((st.scrapMult - 1) * 100) + '%'} />}
        {st.timerMult > 1 && <StatChip label="BOSS TIMER" val={'+' + Math.round((st.timerMult - 1) * 100) + '%'} />}
        {st.slowMult > 1 && <StatChip label="ENEMY SLOW" val={Math.round((st.slowMult - 1) * 100) + '%'} />}
        {st.hintBonus > 0 && <StatChip label="HINTS" val={'+' + st.hintBonus} />}
      </div>

      {groups.map(([slot, label]) => (
        <div key={slot}>
          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{label}</div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ITEMS.filter(i => i.slot === slot).map(it => {
              const owned = (save.owned || []).includes(it.id);
              const equipped = save.gear && save.gear[it.slot] === it.id;
              const cnt = it.slot === 'consumable' ? ((save.inv && save.inv[it.inv]) || 0) : null;
              const afford = (save.scrap || 0) >= it.cost;
              return (
                <div key={it.id} className="card" style={{ padding: '12px 14px', borderColor: equipped ? '#155E6B' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</span>
                    {it.cost > 0 && <span style={{ fontSize: 11, color: '#FFC76B', marginLeft: 'auto' }}>{it.cost} ⛁</span>}
                    {cnt !== null && <span style={{ fontSize: 11, color: '#76849A', marginLeft: it.cost > 0 ? 0 : 'auto' }}>held ×{cnt}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8A93A3', margin: '5px 0 9px', lineHeight: 1.5 }}>{it.blurb}</div>
                  {it.slot === 'consumable' ? (
                    <button className="btn sm" disabled={!afford || cnt >= 5} onClick={() => onBuy(it.id)}>buy · {it.name}</button>
                  ) : equipped ? (
                    <span style={{ fontSize: 11, letterSpacing: '.14em', color: '#7DEFFF' }}>EQUIPPED</span>
                  ) : owned ? (
                    <button className="btn sm" onClick={() => onEquip(it.id)}>equip {it.name}</button>
                  ) : (
                    <button className="btn sm" disabled={!afford} onClick={() => onBuy(it.id)}>buy · {it.name}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#5A6A80', marginTop: 14 }}>Stats come from level (XP) and gear. Defeats cost scrap — the work itself is never lost.</div>
    </div>
  );
}

function LevelUpModal({ info, save, onClose }) {
  const st = derivedStats(save);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(4,6,10,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card popin" style={{ maxWidth: 420, padding: 26, textAlign: 'center', borderColor: '#155E6B' }}>
        <div className="eyebrow" style={{ color: '#7DEFFF' }}>promotion</div>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '.1em', margin: '10px 0 4px', color: '#E8F1FA' }}>
          Lv {info.from} <span style={{ color: '#5A6A80' }}>→</span> <span style={{ color: '#7DEFFF' }}>Lv {info.to}</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#B9C6D6', margin: '6px 0 14px' }}>+14 max HP · +4 ATK per level</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <StatChip label="HP" val={st.maxHp} />
          <StatChip label="ATK" val={st.atk} />
          <StatChip label="DEF" val={Math.round(st.defPct * 100) + '%'} />
        </div>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { AudioFX.click(); onClose(); }}>onward <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

// ============================================================
// FAB CAMPUS CORE — model, pure logic, 3D builders
// ============================================================

const CAMPUS_SIZE = 260;
const COURT_HALF = 28;
const WALL_H = 5;
const CAMPUS_DISTRICTS = [
  { w: 1, name: 'Bit Mines', x: -75, z: 62, color: 0xFFB86B },
  { w: 2, name: 'Gate Valley', x: 75, z: 62, color: 0x7DEFFF },
  { w: 3, name: 'Module Foundry', x: -95, z: 0, color: 0xFB923C },
  { w: 4, name: 'Combinational Canyon', x: 95, z: 0, color: 0xA3E635 },
  { w: 5, name: 'Clock Tower', x: -75, z: -62, color: 0x22D3EE },
  { w: 6, name: 'FSM Fortress', x: 75, z: -62, color: 0xC4B5FD },
  { w: 7, name: 'TAPEOUT', x: 0, z: -95, color: 0xFACC15 },
];

// ---------- pure helpers (headless-testable) ----------
function mkBox(cx, cz, sx, sz, tag) { return { minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, tag: tag || '' }; }
function circleVsAABB(px, pz, r, b) {
  const cx = Math.max(b.minX, Math.min(px, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) { const d = Math.sqrt(d2), push = r - d; return { x: dx / d * push, z: dz / d * push }; }
  const cands = [
    { x: (b.minX - r) - px, z: 0 }, { x: (b.maxX + r) - px, z: 0 },
    { x: 0, z: (b.minZ - r) - pz }, { x: 0, z: (b.maxZ + r) - pz },
  ];
  let best = cands[0], bd = Infinity;
  for (const c of cands) { const m = Math.abs(c.x) + Math.abs(c.z); if (m < bd) { bd = m; best = c; } }
  return best;
}
function resolveCollisions(px, pz, r, colliders) {
  let x = px, z = pz;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.off) continue;
      const p = circleVsAABB(x, z, r, b);
      if (p) { x += p.x; z += p.z; moved = true; }
    }
    if (!moved) break;
  }
  return { x, z };
}
function nearestInteractable(px, pz, items) {
  let best = null, bd = Infinity;
  for (const it of items) {
    const dx = px - it.x, dz = pz - it.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= it.r && d < bd) { bd = d; best = it; }
  }
  return best;
}
function districtFacing(d) {
  const dx = -d.x, dz = -d.z;
  if (Math.abs(dx) >= Math.abs(dz)) return { fx: dx > 0 ? 1 : -1, fz: 0, side: dx > 0 ? '+x' : '-x' };
  return { fx: 0, fz: dz > 0 ? 1 : -1, side: dz > 0 ? '+z' : '-z' };
}

// Build the full walkable model: colliders, gates, interactables, layout anchors.
function campusModel() {
  const colliders = [];
  const gates = [];
  const interactables = [];
  const anchors = {}; // per-district placement info for builders

  // die edge (keep player on the platform)
  const H = CAMPUS_SIZE / 2, T = 6;
  colliders.push(mkBox(0, -H - T / 2, CAMPUS_SIZE + T * 2, T, 'edge'));
  colliders.push(mkBox(0, H + T / 2, CAMPUS_SIZE + T * 2, T, 'edge'));
  colliders.push(mkBox(-H - T / 2, 0, T, CAMPUS_SIZE + T * 2, 'edge'));
  colliders.push(mkBox(H + T / 2, 0, T, CAMPUS_SIZE + T * 2, 'edge'));

  const OPEN = 14;  // gate opening width
  const WT = 1.6;   // wall thickness

  CAMPUS_DISTRICTS.forEach(d => {
    const f = districtFacing(d);
    const C = COURT_HALF;
    // wall segments: 3 solid sides + flanks around the opening on the facing side
    const sides = ['+x', '-x', '+z', '-z'];
    sides.forEach(side => {
      const horiz = side === '+z' || side === '-z'; // wall runs along X
      const off = side === '+x' ? { x: C, z: 0 } : side === '-x' ? { x: -C, z: 0 } : side === '+z' ? { x: 0, z: C } : { x: 0, z: -C };
      const wx = d.x + off.x, wz = d.z + off.z;
      if (side === f.side) {
        // two flank segments leaving an OPEN gap in the middle
        const span = C * 2, flank = (span - OPEN) / 2;
        if (horiz) {
          colliders.push(mkBox(d.x - (OPEN / 2 + flank / 2), wz, flank, WT, 'wall' + d.w));
          colliders.push(mkBox(d.x + (OPEN / 2 + flank / 2), wz, flank, WT, 'wall' + d.w));
        } else {
          colliders.push(mkBox(wx, d.z - (OPEN / 2 + flank / 2), WT, flank, 'wall' + d.w));
          colliders.push(mkBox(wx, d.z + (OPEN / 2 + flank / 2), WT, flank, 'wall' + d.w));
        }
        // gate collider sits in the opening; toggled by progression
        const gateBox = horiz ? mkBox(d.x, wz, OPEN, WT, 'gate' + d.w) : mkBox(wx, d.z, WT, OPEN, 'gate' + d.w);
        colliders.push(gateBox);
        gates.push({ w: d.w, x: horiz ? d.x : wx, z: horiz ? wz : d.z, horiz, collider: gateBox, name: d.name });
      } else {
        if (horiz) colliders.push(mkBox(d.x, wz, C * 2 + WT, WT, 'wall' + d.w));
        else colliders.push(mkBox(wx, d.z, WT, C * 2 + WT, 'wall' + d.w));
      }
    });

    // placement anchors inside the courtyard
    const consolePos = { x: d.x + f.fx * 10, z: d.z + f.fz * 10 };
    const landmarkPos = { x: d.x - f.fx * 9, z: d.z - f.fz * 9 };
    const px = f.fz !== 0 ? 1 : 0, pz = f.fx !== 0 ? 1 : 0; // perpendicular axis
    const padPos = { x: d.x + px * 17 + f.fx * 16, z: d.z + pz * 17 + f.fz * 16 };
    anchors[d.w] = { facing: f, consolePos, landmarkPos, padPos };

    interactables.push({
      id: 'console' + d.w, kind: 'console', w: d.w,
      x: consolePos.x, z: consolePos.z, r: 3.4,
      prompt: 'OPEN ' + d.name.toUpperCase() + ' CONSOLE',
      target: { name: 'world', w: d.w },
    });
    interactables.push({
      id: 'pad' + d.w, kind: 'pad', w: d.w,
      x: padPos.x, z: padPos.z, r: 2.6,
      prompt: 'FAST TRAVEL',
      target: { name: 'fasttravel' },
    });
  });

  // plaza kiosks (always-reachable hub at origin)
  const plazaItems = [
    { id: 'k_training', label: 'TRAINING GROUNDS', x: -22, z: 16, target: { name: 'training' }, needsW3: true },
    { id: 'k_blitz', label: 'BINARY BLITZ', x: 22, z: 16, target: { name: 'blitz' } },
    { id: 'k_bugs', label: 'BUG BOUNTY', x: -22, z: -14, target: { name: 'bugs' }, needsW3: true },
    { id: 'k_ach', label: 'SERVICE RECORD', x: 22, z: -14, target: { name: 'ach' } },
    { id: 'k_manual', label: 'FIELD MANUAL', x: 7, z: 30, target: { name: 'manual' } },
    { id: 'k_shop', label: 'SCRAP EXCHANGE', x: -7, z: 30, target: { name: 'shop' } },
  ];
  plazaItems.forEach(k => {
    colliders.push(mkBox(k.x, k.z, 2.2, 2.2, k.id));
    interactables.push({ id: k.id, kind: 'arcade', x: k.x, z: k.z, r: 3.4, prompt: 'OPEN ' + k.label, target: k.target, needsW3: !!k.needsW3, label: k.label });
  });
  interactables.push({ id: 'pad_plaza', kind: 'pad', w: 0, x: 0, z: 44, r: 2.6, prompt: 'FAST TRAVEL', target: { name: 'fasttravel' } });

  return {
    colliders, gates, interactables, anchors,
    districts: CAMPUS_DISTRICTS,
    spawn: { x: 0, z: 96, yaw: 0 },
    padSpots: [{ w: 0, name: 'Central Plaza', x: 0, z: 44 }].concat(CAMPUS_DISTRICTS.map(d => ({ w: d.w, name: d.name, x: anchors[d.w].padPos.x, z: anchors[d.w].padPos.z }))),
  };
}

// ---------- canvas-texture helpers (browser only) ----------
function makeTextCanvas(lines, opts) {
  const o = opts || {};
  const cv = document.createElement('canvas');
  cv.width = o.w || 512; cv.height = o.h || 256;
  const g = cv.getContext('2d');
  g.fillStyle = o.bg || '#0A0E14';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = o.border || '#22D3EE';
  g.lineWidth = 6;
  g.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    g.fillStyle = ln.color || '#E8F1FA';
    g.font = `${ln.bold ? '700' : '500'} ${ln.size || 44}px monospace`;
    g.fillText(ln.text, cv.width / 2, cv.height * (i + 1) / (n + 1));
  });
  const tx = new THREE.CanvasTexture(cv);
  return tx;
}
function groundTexture(model) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  const S = 1024 / CAMPUS_SIZE;
  const X = (wx) => (wx + CAMPUS_SIZE / 2) * S;
  const Z = (wz) => (wz + CAMPUS_SIZE / 2) * S;
  g.fillStyle = '#0A0F16';
  g.fillRect(0, 0, 1024, 1024);
  // faint substrate grid
  g.strokeStyle = 'rgba(34,211,238,0.06)';
  g.lineWidth = 1;
  for (let i = 0; i <= 32; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(1024, i * 32); g.stroke();
  }
  // traces: plaza -> each district gate
  model.districts.forEach(d => {
    const a = model.anchors[d.w];
    const gx = d.x + a.facing.fx * COURT_HALF, gz = d.z + a.facing.fz * COURT_HALF;
    g.strokeStyle = 'rgba(34,211,238,0.55)';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(0), Z(0));
    // manhattan route: out along district's dominant axis then across
    if (a.facing.fz !== 0) { g.lineTo(X(d.x), Z(0)); g.lineTo(X(d.x), Z(gz)); }
    else { g.lineTo(X(0), Z(d.z)); g.lineTo(X(gx), Z(d.z)); }
    g.stroke();
    g.strokeStyle = 'rgba(125,239,255,0.9)';
    g.lineWidth = 3;
    g.stroke();
    // district pad
    g.fillStyle = 'rgba(13,20,28,1)';
    g.strokeStyle = '#' + d.color.toString(16).padStart(6, '0');
    g.lineWidth = 4;
    const px = X(d.x - COURT_HALF), pz = Z(d.z - COURT_HALF), ps = COURT_HALF * 2 * S;
    g.fillRect(px, pz, ps, ps);
    g.globalAlpha = 0.8; g.strokeRect(px, pz, ps, ps); g.globalAlpha = 1;
  });
  // plaza pad
  g.beginPath();
  g.arc(X(0), Z(0), 40 * S, 0, Math.PI * 2);
  g.fillStyle = 'rgba(16,24,33,1)'; g.fill();
  g.strokeStyle = 'rgba(125,239,255,0.7)'; g.lineWidth = 4; g.stroke();
  const tx = new THREE.CanvasTexture(cv);
  tx.anisotropy = 4;
  return tx;
}

// ---------- 3D builders ----------
function matStd(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.15 }, opts || {})); }
function addBoxMesh(scene, cx, cy, cz, sx, sy, sz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(cx, cy, cz);
  scene.add(m);
  return m;
}

// ============================================================
// ULTRA FAB LAYER — monument, sigils, conveyor, towers, traces, wisps
// The die comes alive: floating master-wafer monument, holo sigils over every district gate, overhead coolant network, an animated
// wafer conveyor ring, corner watchtowers with sweeping searchlights, glowing
// die traces along the roads, drifting dust and orbiting wisps. All decorative
// (no colliders touched); everything animated rides api.anims.
// ============================================================
function buildFabUltra(scene, model, api) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const A = api.anims;

  // --- 1) master-die monument: floating wafer over the die center ---
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#140a22'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = ((x * 7 + y * 13) % 5) < 2 ? '#f5b14c' : '#8a5cf5';
      g.globalAlpha = 0.28 + ((x + y) % 3) * 0.24;
      g.fillRect(x * 32 + 4, y * 32 + 4, 24, 24);
    }
    g.globalAlpha = 0.5; g.strokeStyle = '#7defff'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
    }
    g.globalAlpha = 1;
    const tx = new THREE.CanvasTexture(cv);
    const wafer = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.55, 48),
      new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.85 }));
    wafer.position.set(0, 13, 0); wafer.rotation.z = 0.15; scene.add(wafer);
    const haloA = new THREE.Mesh(new THREE.TorusGeometry(8.8, 0.2, 10, 64), new THREE.MeshBasicMaterial({ color: 0xf5b14c }));
    haloA.rotation.x = Math.PI / 2; haloA.position.y = 13; scene.add(haloA);
    const haloB = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.1, 8, 64), new THREE.MeshBasicMaterial({ color: 0x7defff, transparent: true, opacity: 0.7 }));
    haloB.position.y = 13; scene.add(haloB);
    const under = new THREE.PointLight(0x8a5cf5, 1.7, 52, 2); under.position.set(0, 9.5, 0); scene.add(under);
    [[5.4, 5.4], [-5.4, 5.4], [5.4, -5.4], [-5.4, -5.4]].forEach(([bx, bz]) => scene.add(fxCone(0x8a5cf5, 1.5, 12.4, 0.06, bx, bz)));
    scene.add(fxCone(0xf5b14c, 3.2, 12.6, 0.05, 0, 0));
    const marquee = mineLabelSprite('T A P E O U T   F A B', '#FFD98A', 3.0);
    marquee.position.set(0, 18.6, 0); scene.add(marquee);
    A.push((t) => {
      wafer.rotation.y = t * 0.22;
      const bob = 13 + Math.sin(t * 0.7) * 0.5;
      wafer.position.y = bob; haloA.position.y = bob; haloB.position.y = bob;
      haloA.rotation.z = t * 0.3;
      haloB.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.35;
      haloB.rotation.z = -t * 0.22;
      under.intensity = 1.5 + Math.sin(t * 1.7) * 0.35;
    });
  }

  // --- 2) holo sigils spinning over every district gate ---
  (model.gates || []).forEach((gt, gi) => {
    const d = CAMPUS_DISTRICTS.find(x => x.w === gt.w) || {};
    const col = d.color || 0x7defff;
    const grp = new THREE.Group();
    grp.position.set(gt.x, 7.4, gt.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 40), new THREE.MeshBasicMaterial({ color: col }));
    grp.add(ring);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true }));
    grp.add(core);
    const sp = glowSprite(col, 5.4, 0.5); grp.add(sp);
    scene.add(grp);
    A.push((t) => {
      grp.position.y = 7.4 + Math.sin(t * 1.1 + gi) * 0.35;
      ring.rotation.y = t * 0.9 + gi;
      ring.rotation.x = Math.sin(t * 0.6 + gi) * 0.5;
      core.rotation.y = -t * 1.4;
      core.rotation.x = t * 0.7;
    });
  });

  // --- 3) overhead coolant network above the roads ---
  {
    const pipeMat = matStd(0x232f42, { roughness: 0.35, metalness: 0.9 });
    const coolMat = new THREE.MeshBasicMaterial({ color: 0x7defff, transparent: true, opacity: 0.85 });
    const clampMat = matStd(0x394a66, { roughness: 0.4, metalness: 0.85, emissive: 0x123a44, emissiveIntensity: 0.6 });
    const L = CAMPUS_SIZE - 24;
    const runs = [
      { x: 0, z: -30, y: 11.2, alongX: true }, { x: 0, z: 30, y: 11.2, alongX: true },
      { x: -30, z: 0, y: 12.6, alongX: false }, { x: 30, z: 0, y: 12.6, alongX: false },
    ];
    runs.forEach(rn => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, L, 12), pipeMat);
      const cool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, L + 0.4, 8), coolMat);
      pipe.position.set(rn.x, rn.y, rn.z); cool.position.set(rn.x, rn.y - 0.62, rn.z);
      if (rn.alongX) { pipe.rotation.z = Math.PI / 2; cool.rotation.z = Math.PI / 2; }
      else { pipe.rotation.x = Math.PI / 2; cool.rotation.x = Math.PI / 2; }
      scene.add(pipe); scene.add(cool);
      for (let s = -L / 2 + 12; s <= L / 2 - 12; s += 26) {
        const cl = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 8, 18), clampMat);
        cl.position.set(rn.alongX ? rn.x + s : rn.x, rn.y, rn.alongX ? rn.z : rn.z + s);
        cl.rotation.y = rn.alongX ? 0 : Math.PI / 2;
        scene.add(cl);
      }
    });
    [[-30, -30], [30, -30], [-30, 30], [30, 30]].forEach(([jx, jz]) => {
      const j = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), clampMat);
      j.position.set(jx, 11.9, jz); scene.add(j);
    });
  }

  // --- 4) wafer conveyor ring: product circling the die at y7 ---
  {
    const R = 40;
    const railMat = matStd(0x1b2434, { roughness: 0.5, metalness: 0.8, emissive: 0x0c2a33, emissiveIntensity: 0.5 });
    [[0, -R, true], [0, R, true], [-R, 0, false], [R, 0, false]].forEach(([rx, rz, ax]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ax ? R * 2 : 0.9, 0.32, ax ? 0.9 : R * 2), railMat);
      rail.position.set(rx, 6.6, rz); scene.add(rail);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 6.6, 8), railMat);
      post.position.set(rx, 3.3, rz); scene.add(post);
    });
    const squarePos = (p, r) => {
      const s = (p % 1) * 4, k = Math.floor(s), f = s - k;
      if (k === 0) return { x: -r + f * 2 * r, z: -r };
      if (k === 1) return { x: r, z: -r + f * 2 * r };
      if (k === 2) return { x: r - f * 2 * r, z: r };
      return { x: -r, z: r - f * 2 * r };
    };
    const wMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const wafers = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20), wMat);
      scene.add(m); wafers.push(m);
    }
    A.push((t) => {
      for (let i = 0; i < wafers.length; i++) {
        const pos = squarePos(t * 0.028 + i / wafers.length, R);
        wafers[i].position.set(pos.x, 6.95 + Math.sin(t * 2 + i) * 0.07, pos.z);
        wafers[i].rotation.y = t * 1.2 + i;
      }
    });
  }

  // --- 5) corner watchtowers with sweeping searchlights ---
  [[-118, -118], [118, -118], [-118, 118], [118, 118]].forEach(([tx2, tz], ti) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.7, 16, 1.7), matStd(0x1a2434, { roughness: 0.6, metalness: 0.7 }));
    col.position.set(tx2, 8, tz); scene.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.6), matStd(0x2a3a55, { roughness: 0.4, metalness: 0.8 }));
    cap.position.set(tx2, 16.2, tz); scene.add(cap);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5f52 }));
    beacon.position.set(tx2, 17, tz); scene.add(beacon);
    scene.add(fxCone(0x9fd8ff, 2.8, 15.4, 0.045, tx2, tz));
    const pivot = new THREE.Group(); pivot.position.set(tx2, 16.4, tz); scene.add(pivot);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 30, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = -14; beam.rotation.x = Math.PI; beam.renderOrder = 5;
    const tilt = new THREE.Group(); tilt.rotation.z = 0.62; tilt.add(beam); pivot.add(tilt);
    A.push((t) => {
      pivot.rotation.y = t * (0.24 + ti * 0.05) + ti * 1.7;
      beacon.material.color.setHex(Math.sin(t * 3.4 + ti) > 0 ? 0xff5f52 : 0x53160f);
    });
  });

  // --- 6) glowing die traces from the center plaza to every gate ---
  (model.gates || []).forEach(gt => {
    const d = CAMPUS_DISTRICTS.find(x => x.w === gt.w) || {};
    const dist = Math.hypot(gt.x, gt.z);
    if (dist < 20) return;
    const len = dist - 18;
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, len),
      new THREE.MeshBasicMaterial({ color: d.color || 0x7defff, transparent: true, opacity: 0.5 }));
    const ux = gt.x / dist, uz = gt.z / dist, mid = 12 + len / 2;
    tr.position.set(ux * mid, 0.06, uz * mid);
    tr.rotation.y = Math.atan2(ux, uz);
    scene.add(tr);
    const node = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.07, 16),
      new THREE.MeshBasicMaterial({ color: d.color || 0x7defff, transparent: true, opacity: 0.75 }));
    node.position.set(ux * 12, 0.07, uz * 12); scene.add(node);
  });

  // --- 7) drifting dust + high haze motes ---
  {
    const mk = (N, col, y0, y1, size, op) => {
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * CAMPUS_SIZE * 0.94;
        pos[i * 3 + 1] = y0 + Math.random() * (y1 - y0);
        pos[i * 3 + 2] = (Math.random() - 0.5) * CAMPUS_SIZE * 0.94;
      }
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(gm, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(pts);
      return pts;
    };
    const warm = mk(low ? 220 : 520, 0xffc98a, 0.4, 5, 0.5, 0.5);
    const cold = mk(low ? 140 : 340, 0x7defff, 6, 16, 0.7, 0.3);
    A.push((t) => {
      warm.rotation.y = t * 0.008; warm.position.y = Math.sin(t * 0.23) * 0.5;
      cold.rotation.y = -t * 0.005; cold.position.y = Math.sin(t * 0.17) * 0.8;
    });
  }

  // --- 8) orbiting service wisps ---
  for (let i = 0; i < 3; i++) {
    const col = [0x7defff, 0xf5b14c, 0xc4b5fd][i];
    const wg = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: col }));
    wg.add(orb); wg.add(glowSprite(col, 3.6, 0.7));
    const lt = new THREE.PointLight(col, 0.7, 16, 2); wg.add(lt);
    scene.add(wg);
    const r0 = 56 + i * 22, sp0 = 0.1 - i * 0.022, ph = i * 2.1;
    A.push((t) => {
      wg.position.set(Math.cos(t * sp0 + ph) * r0, 8.4 + Math.sin(t * 0.9 + ph) * 1.6, Math.sin(t * sp0 + ph) * r0);
    });
  }

  // --- shadow flags for the whole campus (desktop only) ---
  if (!low) {
    scene.traverse(o => {
      if (o.isMesh) {
        const tr = o.material && o.material.transparent;
        o.castShadow = !tr;
        o.receiveShadow = true;
      }
    });
  }
}

function buildCampusWorld(scene, model) {
  const api = { anims: [], gates: {}, beacons: {}, windows: {}, kioskScreens: {}, dispose: [] };

  // --- lights / sky ---
  scene.background = new THREE.Color(0x060A12);
  scene.fog = new THREE.Fog(0x060A12, 60, 230);
  const hemi = new THREE.HemisphereLight(0x3a566e, 0x0a0e14, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0x9fd8ff, 0.5);
  dir.position.set(60, 90, 30);
  scene.add(dir);
  if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) {
    try {
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      const SC = CAMPUS_SIZE / 2 + 14;
      dir.shadow.camera.left = -SC; dir.shadow.camera.right = SC;
      dir.shadow.camera.top = SC; dir.shadow.camera.bottom = -SC;
      dir.shadow.camera.near = 10; dir.shadow.camera.far = 260;
      dir.shadow.bias = -0.0006;
    } catch (e) { }
  }
  api.anims.push((t) => { // subtle 120s "fab night" cycle
    const c = (Math.sin(t * Math.PI * 2 / 120) + 1) / 2;
    hemi.intensity = 0.7 + 0.3 * c;
    dir.intensity = 0.35 + 0.3 * c;
  });

  // stars
  {
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.85);
      const r = 380;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 10;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(gm, new THREE.PointsMaterial({ color: 0xaad4ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
    scene.add(pts);
  }

  // --- ground ---
  const gtex = groundTexture(model);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CAMPUS_SIZE, CAMPUS_SIZE), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // die rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(CAMPUS_SIZE + 6, 1.2, CAMPUS_SIZE + 6), matStd(0x101826, { emissive: 0x123a44, emissiveIntensity: 0.5 }));
  rim.position.y = -0.7;
  scene.add(rim);

  // --- courtyard walls (mesh per collider tagged wall*) ---
  const wallMat = matStd(0x18222F, { emissive: 0x0c2a33, emissiveIntensity: 0.35 });
  model.colliders.forEach(b => {
    if (!/^wall/.test(b.tag)) return;
    const sx = b.maxX - b.minX, sz = b.maxZ - b.minZ;
    addBoxMesh(scene, (b.minX + b.maxX) / 2, WALL_H / 2, (b.minZ + b.maxZ) / 2, sx, WALL_H, sz, wallMat);
  });

  // --- gates ---
  model.gates.forEach(gt => {
    const d = model.districts.find(x => x.w === gt.w);
    const frameMat = matStd(0x222d3c);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x301014, emissive: 0xB1303A, emissiveIntensity: 1.1, transparent: true, opacity: 0.92 });
    const span = 14;
    // posts
    const p1 = gt.horiz ? [gt.x - span / 2, gt.z] : [gt.x, gt.z - span / 2];
    const p2 = gt.horiz ? [gt.x + span / 2, gt.z] : [gt.x, gt.z + span / 2];
    addBoxMesh(scene, p1[0], (WALL_H + 2) / 2, p1[1], 1.4, WALL_H + 2, 1.4, frameMat);
    addBoxMesh(scene, p2[0], (WALL_H + 2) / 2, p2[1], 1.4, WALL_H + 2, 1.4, frameMat);
    const lintel = addBoxMesh(scene, gt.x, WALL_H + 1.6, gt.z, gt.horiz ? span + 1.4 : 1.4, 1.2, gt.horiz ? 1.4 : span + 1.4, frameMat);
    // sliding panel
    const panel = addBoxMesh(scene, gt.x, WALL_H / 2, gt.z, gt.horiz ? span - 1 : 0.8, WALL_H, gt.horiz ? 0.8 : span - 1, panelMat);
    // sign above
    const signTex = makeTextCanvas([
      { text: 'SEAL ' + String(gt.w).padStart(2, '0'), size: 64, bold: true, color: '#FF8B82' },
      { text: d.name.toUpperCase(), size: 40, color: '#B9C6D6' },
    ], { border: '#B14A52' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(gt.x, WALL_H + 4.6, gt.z);
    if (!gt.horiz) sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    const g = { panel, panelMat, sign, open: false, anim: 0, collider: gt.collider, w: gt.w };
    api.gates[gt.w] = g;
    api.anims.push((t, dt) => {
      if (g.open && panel.position.y > -WALL_H / 2 - 0.6) {
        panel.position.y = Math.max(-WALL_H / 2 - 0.6, panel.position.y - dt * 3.2);
        panelMat.opacity = Math.max(0, panelMat.opacity - dt * 0.5);
      }
      if (!g.open) panelMat.emissiveIntensity = 0.9 + 0.35 * Math.sin(t * 2.2 + gt.w);
    });
  });

  // --- district landmarks + beacons + consoles + pads ---
  model.districts.forEach(d => {
    const a = model.anchors[d.w];
    const L = a.landmarkPos;
    buildLandmark(scene, d, L, api);
    // beacon pillar
    const bMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.16 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 10, 1, true), bMat);
    beam.position.set(L.x, 30, L.z);
    scene.add(beam);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), new THREE.MeshBasicMaterial({ color: d.color }));
    tip.position.set(L.x, 18 + (d.w === 7 ? 6 : 0), L.z);
    scene.add(tip);
    api.beacons[d.w] = { beam, bMat, tip };
    api.anims.push((t) => { tip.position.y = 18 + (d.w === 7 ? 6 : 0) + Math.sin(t * 1.4 + d.w) * 0.6; });
  });

  // consoles + plaza kiosks + pads
  model.interactables.forEach(it => {
    if (it.kind === 'console') {
      const d = model.districts.find(x => x.w === it.w);
      buildKiosk(scene, it.x, it.z, d.name.toUpperCase(), 'DISTRICT CONSOLE', '#' + d.color.toString(16).padStart(6, '0'), api, 'c' + it.w);
    } else if (it.kind === 'arcade') {
      buildKiosk(scene, it.x, it.z, it.label, 'PERIPHERAL', '#7DEFFF', api, it.id);
    } else if (it.kind === 'pad') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0x7DEFFF }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(it.x, 0.12, it.z);
      scene.add(ring);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x155E6B, transparent: true, opacity: 0.5 }));
      glow.position.set(it.x, 0.06, it.z);
      scene.add(glow);
      api.anims.push((t) => { ring.rotation.z = t * 0.6; });
    }
  });

  return api;
}

function buildKiosk(scene, x, z, title, sub, color, api, key) {
  const ped = addBoxMesh(scene, x, 0.7, z, 1.8, 1.4, 1.2, matStd(0x1a2432));
  const neck = addBoxMesh(scene, x, 1.8, z, 0.4, 1.0, 0.4, matStd(0x222d3c));
  const tex = makeTextCanvas([
    { text: title, size: 46, bold: true, color },
    { text: sub, size: 26, color: '#76849A' },
  ], { border: color });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(x, 2.9, z);
  scene.add(screen);
  api.kioskScreens[key] = { screen, baseY: 2.9 };
  api.anims.push((t) => { screen.position.y = 2.9 + Math.sin(t * 1.1 + x) * 0.07; screen.lookAtPlayer = true; });
  return screen;
}

function buildLandmark(scene, d, L, api) {
  const acc = d.color;
  if (d.w === 1) { // Bit Mines: headframe + ore
    const legMat = matStd(0x2a3344);
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([ox, oz]) => {
      const leg = addBoxMesh(scene, L.x + ox * 0.7, 5, L.z + oz * 0.7, 0.7, 10, 0.7, legMat);
      leg.rotation.y = 0.1;
    });
    addBoxMesh(scene, L.x, 10.2, L.z, 6.4, 0.8, 6.4, legMat);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 20), matStd(0x3a4759, { emissive: acc, emissiveIntensity: 0.25 }));
    wheel.position.set(L.x, 12.4, L.z);
    scene.add(wheel);
    api.anims.push((t) => { wheel.rotation.y = t * 0.7; });
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, matStd(0x33271a, { emissive: 0xFFB86B, emissiveIntensity: 0.12 }), 14);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2, rr = 10 + (i % 3) * 3;
      m4.makeRotationY(i);
      m4.setPosition(L.x + Math.cos(ang) * rr, 0.7, L.z + Math.sin(ang) * rr * 0.7);
      rocks.setMatrixAt(i, m4);
    }
    scene.add(rocks);
  } else if (d.w === 2) { // Gate Valley: arch row with gate names
    const names = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];
    names.forEach((nm, i) => {
      const gx = L.x - 12 + i * 6, gz = L.z;
      const m = matStd(0x223041, { emissive: acc, emissiveIntensity: 0.15 });
      addBoxMesh(scene, gx - 1.6, 3, gz, 0.8, 6, 0.8, m);
      addBoxMesh(scene, gx + 1.6, 3, gz, 0.8, 6, 0.8, m);
      addBoxMesh(scene, gx, 6.3, gz, 4.6, 0.7, 1.0, m);
      const tx = makeTextCanvas([{ text: nm, size: 90, bold: true, color: '#7DEFFF' }], { h: 160, border: '#155E6B' });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      s.position.set(gx, 5.2, gz + 0.6);
      scene.add(s);
    });
  } else if (d.w === 3) { // Module Foundry: hall + chimneys + crucible
    addBoxMesh(scene, L.x, 4, L.z, 16, 8, 11, matStd(0x232c39));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ color: 0xFB923C, transparent: true, opacity: 0.85 }));
    win.position.set(L.x, 4, L.z + 5.56);
    scene.add(win);
    api.windows[3] = win;
    [-4, 4].forEach(ox => {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 7, 10), matStd(0x2a3344));
      ch.position.set(L.x + ox, 11, L.z - 2);
      scene.add(ch);
    });
    const cru = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.8, 2.6, 12), matStd(0x33271a, { emissive: 0xFB923C, emissiveIntensity: 0.9 }));
    cru.position.set(L.x + 11, 1.4, L.z + 2);
    scene.add(cru);
    api.anims.push((t) => { cru.material.emissiveIntensity = 0.7 + 0.4 * Math.sin(t * 3); });
  } else if (d.w === 4) { // Combinational Canyon: ridges + plank bridge
    const ridge = matStd(0x1f2a23, { emissive: 0xA3E635, emissiveIntensity: 0.06 });
    for (let i = 0; i < 5; i++) {
      const r1 = addBoxMesh(scene, L.x - 8 + i * 4, 2.6 + (i % 2), L.z - 7, 3.2, 5 + (i % 3) * 2, 3.5, ridge);
      r1.rotation.y = i * 0.5;
      const r2 = addBoxMesh(scene, L.x - 8 + i * 4, 2.2 + ((i + 1) % 2), L.z + 7, 3.4, 4 + ((i + 1) % 3) * 2, 3.2, ridge);
      r2.rotation.y = -i * 0.4;
    }
    for (let i = 0; i < 7; i++) addBoxMesh(scene, L.x - 7 + i * 2.4, 5.2, L.z, 1.8, 0.25, 2.6, matStd(0x4a3a22));
    addBoxMesh(scene, L.x - 8.4, 2.6, L.z, 0.5, 5.4, 0.5, matStd(0x2a3344));
    addBoxMesh(scene, L.x + 8.4, 2.6, L.z, 0.5, 5.4, 0.5, matStd(0x2a3344));
  } else if (d.w === 5) { // Clock Tower: tower + animated face
    addBoxMesh(scene, L.x, 11, L.z, 5, 22, 5, matStd(0x232c39));
    addBoxMesh(scene, L.x, 22.8, L.z, 6.4, 1.6, 6.4, matStd(0x2a3344, { emissive: acc, emissiveIntensity: 0.3 }));
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), new THREE.MeshBasicMaterial({ color: 0x0E141C }));
    face.position.set(L.x, 18, L.z + 2.56);
    scene.add(face);
    const rimm = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.16, 8, 26), new THREE.MeshBasicMaterial({ color: acc }));
    rimm.position.copy(face.position);
    scene.add(rimm);
    const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.06), new THREE.MeshBasicMaterial({ color: 0x7DEFFF }));
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.06), new THREE.MeshBasicMaterial({ color: 0xE8F1FA }));
    hand1.position.set(L.x, 18, L.z + 2.6);
    hand2.position.set(L.x, 18, L.z + 2.62);
    scene.add(hand1); scene.add(hand2);
    api.anims.push((t) => {
      hand1.rotation.z = -t * 0.5;
      hand2.rotation.z = -t * 0.05;
      hand1.position.x = L.x + Math.sin(-t * 0.5) * 0.65;
      hand1.position.y = 18 + Math.cos(-t * 0.5) * 0.65;
      hand2.position.x = L.x + Math.sin(-t * 0.05) * 0.45;
      hand2.position.y = 18 + Math.cos(-t * 0.05) * 0.45;
    });
  } else if (d.w === 6) { // FSM Fortress: keep + towers + crenellations
    addBoxMesh(scene, L.x, 5.5, L.z, 11, 11, 11, matStd(0x262433));
    [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4]].forEach(([ox, oz]) => {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 14, 10), matStd(0x2c2a3d));
      tw.position.set(L.x + ox, 7, L.z + oz);
      scene.add(tw);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 10), matStd(0x3a3454, { emissive: acc, emissiveIntensity: 0.3 }));
      cap.position.set(L.x + ox, 15.2, L.z + oz);
      scene.add(cap);
    });
    const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matStd(0x262433), 20);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) {
      const side = i % 4, k = Math.floor(i / 4) - 2;
      const px = side === 0 ? k * 2.4 : side === 1 ? k * 2.4 : side === 2 ? -5.5 : 5.5;
      const pz = side === 0 ? -5.5 : side === 1 ? 5.5 : k * 2.4;
      m4.setPosition(L.x + px, 11.5, L.z + pz);
      cren.setMatrixAt(i, m4);
    }
    scene.add(cren);
  } else if (d.w === 7) { // TAPEOUT fab: cleanroom + antenna
    addBoxMesh(scene, L.x, 5, L.z, 22, 10, 15, matStd(0x1c2735, { emissive: 0x0e3a44, emissiveIntensity: 0.4 }));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(19, 3.2), new THREE.MeshBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.7 }));
    win.position.set(L.x, 5, L.z + 7.56);
    scene.add(win);
    api.windows[7] = win;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 8), matStd(0x3a4759));
    mast.position.set(L.x + 7, 14.5, L.z - 3);
    scene.add(mast);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xFACC15 }));
    blink.position.set(L.x + 7, 19.3, L.z - 3);
    scene.add(blink);
    api.anims.push((t) => { blink.visible = Math.sin(t * 4) > -0.2; });
    const tx = makeTextCanvas([{ text: 'TAPEOUT', size: 86, bold: true, color: '#FFE27A' }], { h: 170, border: '#7A6310' });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
    s.position.set(L.x, 11.6, L.z + 7.6);
    scene.add(s);
  }
}

// progress → world state (beacons, gates, windows)
function applyCampusProgress(api, model, progress) {
  model.districts.forEach(d => {
    const p = progress.perWorld[d.w] || { unlocked: false, complete: false, frac: 0 };
    const b = api.beacons[d.w];
    if (b) {
      const col = !p.unlocked ? 0x39434f : p.complete ? (d.w === 7 || progress.ngplus ? 0xFACC15 : 0x2EA56A) : d.color;
      b.bMat.color.setHex(col);
      b.bMat.opacity = p.unlocked ? 0.16 + p.frac * 0.14 : 0.05;
      b.tip.material.color.setHex(col);
    }
    const g = api.gates[d.w];
    if (g) {
      const open = !!p.unlocked;
      if (open && !g.open) { g.open = true; g.collider.off = true; g.sign.visible = false; }
      if (!open) { g.open = false; g.collider.off = false; g.sign.visible = true; }
    }
    const w = api.windows[d.w];
    if (w) w.material.opacity = 0.35 + p.frac * 0.55;
  });
}

// ============================================================
// FAB CAMPUS SCREEN — walkable fab, overlay bridge, HUD
// ============================================================

function campusProgress(save) {
  const perWorld = {};
  for (let w = 1; w <= 7; w++) {
    const chs = challengesOf(w);
    const dmap = activeDone(save);
    const done = chs.filter(c => dmap[c.id]).length;
    perWorld[w] = {
      unlocked: worldUnlockedEx(w, save),
      complete: chs.length > 0 && done === chs.length,
      frac: chs.length ? done / chs.length : 0,
    };
  }
  return { perWorld, tapeoutDone: save.tapeoutDone, ngplus: save.ngplus };
}

function CampusScreen({ save, go, cb }) {
  const mountRef = useRef(null);
  const minimapRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState(null);
  const [showHelp, setShowHelp] = useState(!save.campusVisited);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRef2 = useRef(save); saveRef2.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKey = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => { if (!save.campusVisited) cb.onVisited(); /* once */ // eslint-disable-line
  }, []); // eslint-disable-line

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'campus') { setOverlay(null); return; }
    if (sc.name === 'mine') { setOverlay(null); go({ name: 'mine' }); return; }
    if (sc.name === 'dungeon') { setOverlay(null); go({ name: 'dungeon', w: sc.w }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);

  // ---------- engine ----------
  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      const camera = new THREE.PerspectiveCamera(72, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 600);
      camera.rotation.order = 'YXZ';

      const model = campusModel();
      const api = buildCampusWorld(scene, model);
      try { buildFabUltra(scene, model, api); } catch (e) { }

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.04 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0;
      let zoneW = 0, promptKey = '', miniT = 0, helpDismissed = false;

      const lockedTest = (it) => {
        const s = saveRef2.current;
        if (it.kind === 'arcade' && it.needsW3) return !worldUnlockedEx(3, s) ? 'SEALED — opens with Module Foundry' : null;
        if (it.kind === 'console') return !worldUnlockedEx(it.w, s) ? 'SEALED' : null;
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        const lock = lockedTest(it);
        if (lock) { AudioFX.bad(); return; }
        if (it.kind === 'pad') openOverlay({ name: 'fasttravel' });
        else openOverlay({ ...it.target });
      };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      // touch-look on the canvas (right half); joystick handled by HUD via inputRef
      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.005;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.004));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      let progress = campusProgress(saveRef2.current);
      applyCampusProgress(api, model, progress);

      engineRef.current = {
        applyProgress: (p) => { progress = p; applyCampusProgress(api, model, p); },
        teleport: (w) => {
          const spot = model.padSpots.find(s => s.w === w);
          if (!spot) return;
          player.x = spot.x; player.z = spot.z + 3;
          const d = model.districts.find(dd => dd.w === w);
          if (d) player.yaw = Math.atan2(-(d.x - player.x), (d.z - player.z)) + Math.PI;
          AudioFX.good();
        },
        interact: tryInteract,
      };

      const clock = new THREE.Clock();
      const camVec = new THREE.Vector3();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;
        const paused = !!overlayRef.current;

        if (!paused) {
          const inp = inputRef.current;
          const sprint = keys.ShiftLeft || keys.ShiftRight || inp.sprint;
          const sp = sprint ? 17 : 10;
          let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + inp.jx;
          let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + inp.jy;
          const len = Math.hypot(mx, mz);
          if (len > 1) { mx /= len; mz /= len; }
          if (len > 0.01) {
            if (!helpDismissed) { helpDismissed = true; setShowHelp(false); }
            const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
            const vx = (-sy) * (-mz) + cy * mx;
            const vz = (-cy) * (-mz) + (-sy) * mx;
            const res = resolveCollisions(player.x + vx * sp * dt, player.z + vz * sp * dt, 0.9, model.colliders);
            player.x = res.x; player.z = res.z;
          }
          // interact prompt
          const it = nearestInteractable(player.x, player.z, model.interactables);
          const lock = it ? lockedTest(it) : null;
          const pk = it ? it.id + (lock ? '!' : '') : '';
          if (pk !== promptKey) {
            promptKey = pk;
            setPrompt(it ? { text: lock ? lock : (isTouch ? 'TAP ⏎ — ' : '[E] ') + it.prompt, locked: !!lock } : null);
          }
          // district banner
          let zw = 0;
          for (const d of model.districts) {
            if (Math.abs(player.x - d.x) < COURT_HALF && Math.abs(player.z - d.z) < COURT_HALF) { zw = d.w; break; }
          }
          if (zw !== zoneW) {
            zoneW = zw;
            setBanner(zw ? model.districts.find(d => d.w === zw).name : null);
          }
        }

        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;

        api.anims.forEach(f => f(t, dt));
        // billboard kiosk screens
        camVec.set(player.x, 0, player.z);
        Object.values(api.kioskScreens).forEach(k => {
          k.screen.lookAt(camVec.x, k.screen.position.y, camVec.z);
        });

        // minimap @ ~8Hz
        miniT += dt;
        if (miniT > 0.12 && minimapRef.current) {
          miniT = 0;
          drawMinimap(minimapRef.current, model, player, progress);
        }

        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      loop();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
      try { renderer && renderer.dispose && renderer.dispose(); } catch (e2) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
      return () => { };
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      try {
        renderer.dispose(); try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      } catch (e) { }
      engineRef.current = null;
    };
  }, []); // eslint-disable-line

  // progress sync on save changes
  useEffect(() => {
    if (engineRef.current) engineRef.current.applyProgress(campusProgress(save));
  }, [save]);

  // ---------- overlay router (mirrors App routes) ----------
  const renderOverlay = () => {
    if (!overlay) return null;
    const s = save;
    let body = null, label = 'CONSOLE';
    if (overlay.name === 'world') { label = WORLDS.find(w => w.id === overlay.w).name; body = <WorldScreen w={overlay.w} save={s} go={oGo} onLessonRead={cb.onLessonRead} />; }
    else if (overlay.name === 'gauntlet') { label = 'GAUNTLET'; body = <GauntletScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'truth') { label = 'TRUTH TABLE'; body = <TruthScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'code') { label = 'WORKBENCH'; body = <CodeScreen key={overlay.id + '|' + (s.ngplus ? 'ng' : s.mode)} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={s} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={s} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={s} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={s} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={s} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={s} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') { label = 'PROFILES'; body = <ProfilesScreen save={s} activeSlot={cb.activeSlot} go={oGo} onLoadSlot={cb.onLoadSlot} onNewSlot={cb.onNewSlot} onDeleteSlot={cb.onDeleteSlot} onImport={cb.onImport} readSlot={cb.readSlot} />; }
    else if (overlay.name === 'fasttravel') {
      label = 'FAST TRAVEL';
      const spots = [{ w: 0, name: 'Central Plaza' }].concat(WORLDS.filter(w => worldUnlockedEx(w.id, s)).map(w => ({ w: w.id, name: w.name })));
      body = (
        <div style={{ marginTop: 22, maxWidth: 460 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>trace network · cleared pads only</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {spots.map(sp => (
              <button key={sp.w} className="card" style={{ padding: '12px 15px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => { engineRef.current && engineRef.current.teleport(sp.w); setOverlay(null); }}>
                <Zap size={13} color="#7DEFFF" />
                <span style={{ fontSize: 14 }}>{sp.name}</span>
                <ChevronRight size={14} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(4,7,12,0.88)', backdropFilter: 'blur(2px)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1D2632', paddingBottom: 10 }}>
            <Terminal size={14} color="#7DEFFF" />
            <span className="eyebrow" style={{ color: '#7DEFFF' }}>console link · {label}</span>
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              <X size={12} /> close
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the 3D fab. Direct console uplinks below — same destinations, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {WORLDS.map(w => (
              <button key={w.id} className="card" disabled={!worldUnlockedEx(w.id, save)}
                style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: worldUnlockedEx(w.id, save) ? 'pointer' : 'not-allowed', opacity: worldUnlockedEx(w.id, save) ? 1 : 0.45 }}
                onClick={() => openOverlay({ name: 'world', w: w.id })}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</span>
              </button>
            ))}
            {[['Training Grounds', { name: 'training' }], ['Binary Blitz', { name: 'blitz' }], ['Bug Bounty', { name: 'bugs' }], ['Service Record', { name: 'ach' }], ['Field Manual', { name: 'manual' }], ['Scrap Exchange', { name: 'shop' }]].map(([nm, tg]) => (
              <button key={nm} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => openOverlay(tg)}>
                <span style={{ fontSize: 13 }}>{nm}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#060A12' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* exit */}
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {/* crosshair */}
      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#7DEFFF', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #22D3EE' }} />
      )}

      {/* district banner */}
      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(10,14,20,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#7DEFFF' }}>
            {banner.toUpperCase()}
          </div>
        </div>
      )}

      {/* interact prompt */}
      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,14,20,0.86)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#155E6B'), color: prompt.locked ? '#FF8B82' : '#7DEFFF', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {/* minimap */}
      {!overlay && (
        <canvas ref={minimapRef} width={150} height={150}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 22, border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(8,12,18,0.85)' }} />
      )}

      {/* help card */}
      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 8 }}>fab floor access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ opens consoles.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E opens consoles. Follow the glowing traces — Bit Mines is southwest.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {/* touch controls */}
      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

function drawMinimap(cv, model, player, progress) {
  const g = cv.getContext('2d');
  const S = cv.width / CAMPUS_SIZE;
  const X = (x) => (x + CAMPUS_SIZE / 2) * S;
  const Z = (z) => (z + CAMPUS_SIZE / 2) * S;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(8,12,18,0.2)';
  g.fillRect(0, 0, cv.width, cv.height);
  model.districts.forEach(d => {
    const p = (progress && progress.perWorld[d.w]) || {};
    g.strokeStyle = !p.unlocked ? '#39434f' : p.complete ? '#2EA56A' : '#' + d.color.toString(16).padStart(6, '0');
    g.lineWidth = 1.5;
    g.globalAlpha = p.unlocked ? 0.95 : 0.45;
    g.strokeRect(X(d.x - COURT_HALF), Z(d.z - COURT_HALF), COURT_HALF * 2 * S, COURT_HALF * 2 * S);
    g.globalAlpha = 1;
  });
  // plaza
  g.beginPath();
  g.arc(X(0), Z(0), 38 * S, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(125,239,255,0.5)';
  g.stroke();
  // gates
  model.gates.forEach(gt => {
    const open = !gt.collider.off ? false : true;
    g.fillStyle = open ? '#2EA56A' : '#FF8B82';
    g.fillRect(X(gt.x) - 2, Z(gt.z) - 2, 4, 4);
  });
  // player arrow
  g.save();
  g.translate(X(player.x), Z(player.z));
  g.rotate(-player.yaw);
  g.fillStyle = '#FFE27A';
  g.beginPath();
  g.moveTo(0, -5); g.lineTo(3.4, 4); g.lineTo(-3.4, 4);
  g.closePath();
  g.fill();
  g.restore();
}

function TouchControls({ inputRef, onInteract }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const handle = (e, end) => {
    if (end) { inputRef.current.jx = 0; inputRef.current.jy = 0; setKnob({ x: 0, y: 0, on: false }); return; }
    const t = e.touches[0];
    if (!t || !baseRef.current) return;
    const r = baseRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    inputRef.current.jx = dx;
    inputRef.current.jy = dy;
    setKnob({ x: dx * 28, y: dy * 28, on: true });
  };
  return (
    <>
      <div ref={baseRef}
        onTouchStart={(e) => handle(e)} onTouchMove={(e) => handle(e)} onTouchEnd={(e) => handle(e, true)}
        style={{ position: 'absolute', bottom: 26, left: 22, width: 104, height: 104, borderRadius: 99, border: '1.5px solid #1D2632', background: 'rgba(10,14,20,0.5)', zIndex: 24, touchAction: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 42, height: 42, borderRadius: 99, background: knob.on ? '#155E6B' : '#11202b', border: '1px solid #22D3EE', transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <button onTouchStart={(e) => { e.preventDefault(); onInteract(); }}
        style={{ position: 'absolute', bottom: 44, right: 26, width: 66, height: 66, borderRadius: 99, border: '1.5px solid #155E6B', background: 'rgba(13,30,38,0.8)', color: '#7DEFFF', fontSize: 22, zIndex: 24, touchAction: 'none' }}>⏎</button>
      <button onTouchStart={() => { inputRef.current.sprint = !inputRef.current.sprint; }}
        style={{ position: 'absolute', bottom: 120, right: 36, width: 46, height: 46, borderRadius: 99, border: '1px solid #1D2632', background: inputRef.current.sprint ? 'rgba(34,211,238,0.25)' : 'rgba(10,14,20,0.6)', color: '#A9B7C9', fontSize: 11, zIndex: 24, touchAction: 'none' }}>RUN</button>
    </>
  );
}

// ============================================================
// CINEMATIC HELPERS — glow, sky, light rigs (core three r128 only)
// No examples/jsm: fake-bloom via additive sprites, real shadow maps,
// ACES tone mapping, procedural textures, dust, CSS grade.
// ============================================================

function tuneRenderer(renderer, low) {
  try {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  } catch (e) { }
}

// Fake-volumetric light shaft: additive open cone. With bloom it reads as a god ray.
function fxCone(hex, r, h, op, x, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x || 0, h / 2, z || 0);
  m.renderOrder = 5;
  return m;
}

// ============================================================
// ULTRA POST PIPELINE — bloom, CA, vignette, grain (core three only)
// Composer chain: scene -> bright pass -> separable blur x2 -> composite (bloom + chromatic aberration + vignette +
// film grain + linear->sRGB). No examples/jsm — ShaderMaterial + RTs only.
// ============================================================
const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const POST_BRIGHT_FS = [
  'uniform sampler2D tex; uniform float thresh; varying vec2 vUv;',
  'void main(){ vec4 c = texture2D(tex, vUv);',
  '  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));',
  '  float k = smoothstep(thresh, thresh + 0.34, l);',
  '  gl_FragColor = vec4(c.rgb * k, 1.0); }',
].join('\n');
const POST_BLUR_FS = [
  'uniform sampler2D tex; uniform vec2 dir; uniform vec2 res; varying vec2 vUv;',
  'void main(){ vec2 px = dir / res;',
  '  vec3 s = texture2D(tex, vUv).rgb * 0.227027;',
  '  s += (texture2D(tex, vUv + px * 1.3846).rgb + texture2D(tex, vUv - px * 1.3846).rgb) * 0.3162162;',
  '  s += (texture2D(tex, vUv + px * 3.2308).rgb + texture2D(tex, vUv - px * 3.2308).rgb) * 0.0702703;',
  '  gl_FragColor = vec4(s, 1.0); }',
].join('\n');
const POST_COMP_FS = [
  'uniform sampler2D tex; uniform sampler2D bloomTex; uniform float strength; uniform float t; varying vec2 vUv;',
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'void main(){',
  '  vec2 uv = vUv; vec2 cc = uv - 0.5; float r2 = dot(cc, cc);',
  '  float ca = 0.0014 + r2 * 0.0042;',
  '  vec3 base;',
  '  base.r = texture2D(tex, uv + cc * ca).r;',
  '  base.g = texture2D(tex, uv).g;',
  '  base.b = texture2D(tex, uv - cc * ca).b;',
  '  vec3 c = base + texture2D(bloomTex, uv).rgb * strength;',
  '  float vig = 1.0 - smoothstep(0.32, 1.05, r2 * 1.9);',
  '  c *= mix(0.68, 1.0, vig);',
  '  c += vec3((hash(uv * vec2(1613.0, 1021.0) + vec2(mod(t, 10.0) * 61.0)) - 0.5) * 0.028);',
  '  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));',
  '  gl_FragColor = vec4(c, 1.0); }',
].join('\n');

function makePostFX(renderer, cssW, cssH) {
  const pr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
  const dims = (w, h) => ({ W: Math.max(2, Math.floor(w * pr)), H: Math.max(2, Math.floor(h * pr)) });
  let { W, H } = dims(cssW, cssH);
  const pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(W, H, pars);
  const rtA = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false, depthBuffer: false });
  const rtB = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false, depthBuffer: false });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bright = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, thresh: { value: 0.5 } }, vertexShader: POST_VS, fragmentShader: POST_BRIGHT_FS, depthTest: false, depthWrite: false });
  const blur = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(W >> 1, H >> 1) } }, vertexShader: POST_VS, fragmentShader: POST_BLUR_FS, depthTest: false, depthWrite: false });
  const comp = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, bloomTex: { value: null }, strength: { value: 0.9 }, t: { value: 0 } }, vertexShader: POST_VS, fragmentShader: POST_COMP_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };
  // Warm-up: force-compile all three programs NOW and verify they built.
  // If any shader fails on this GPU, throw — callers fall back to plain
  // rendering instead of a black screen.
  try {
    [bright, blur, comp].forEach(m => pass(m, rtA));
    renderer.setRenderTarget(null);
    const progs = (renderer.info && renderer.info.programs) || [];
    if (progs.some(p => p && p.diagnostics)) throw new Error('post shader failed to compile');
  } catch (e) {
    try { rtScene.dispose(); rtA.dispose(); rtB.dispose(); } catch (e2) { }
    throw e;
  }
  return {
    setStrength(v) { comp.uniforms.strength.value = v; },
    render(scene, camera) {
      try {
        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);
        bright.uniforms.tex.value = rtScene.texture; pass(bright, rtA);
        blur.uniforms.tex.value = rtA.texture; blur.uniforms.dir.value.set(1, 0); pass(blur, rtB);
        blur.uniforms.tex.value = rtB.texture; blur.uniforms.dir.value.set(0, 1); pass(blur, rtA);
        blur.uniforms.tex.value = rtA.texture; blur.uniforms.dir.value.set(2.4, 0); pass(blur, rtB);
        blur.uniforms.tex.value = rtB.texture; blur.uniforms.dir.value.set(0, 2.4); pass(blur, rtA);
        comp.uniforms.tex.value = rtScene.texture;
        comp.uniforms.bloomTex.value = rtA.texture;
        comp.uniforms.t.value = (Date.now() % 100000) / 1000;
        pass(comp, null);
      } catch (e) {
        try { renderer.setRenderTarget(null); } catch (e2) { }
        renderer.render(scene, camera);
      }
    },
    resize(w, h) {
      const d = dims(w, h);
      rtScene.setSize(d.W, d.H);
      rtA.setSize(d.W >> 1, d.H >> 1);
      rtB.setSize(d.W >> 1, d.H >> 1);
      blur.uniforms.res.value.set(d.W >> 1, d.H >> 1);
    },
    dispose() {
      try { rtScene.dispose(); rtA.dispose(); rtB.dispose(); } catch (e) { }
    },
  };
}

function glowTexture() {
  if (glowTexture._t) return glowTexture._t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  glowTexture._t = t; return t;
}

function glowSprite(hex, size, opacity) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opacity == null ? 0.85 : opacity });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}


function dustField(bounds, hex, count) {
  const n = count || 130;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const b = bounds;
  let seed = 99;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    pos[i * 3] = b.minX + rnd() * (b.maxX - b.minX);
    pos[i * 3 + 1] = 0.4 + rnd() * 4.6;
    pos[i * 3 + 2] = b.minZ + rnd() * (b.maxZ - b.minZ);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: glowTexture(), color: hex, size: 0.5, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

function keyLight(scene, hex, bounds, intensity) {
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  const dir = new THREE.DirectionalLight(hex, intensity == null ? 0.85 : intensity);
  dir.position.set(cx + span * 0.32, span * 0.75, cz + span * 0.22);
  dir.target.position.set(cx, 0, cz);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const d = span * 0.7 + 14;
  const c = dir.shadow.camera;
  c.left = -d; c.right = d; c.top = d; c.bottom = -d; c.near = 1; c.far = span * 2.2 + 40;
  c.updateProjectionMatrix();
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 0.7;
  scene.add(dir); scene.add(dir.target);
  return dir;
}

// One call at the end of a builder: shadow-flag meshes, glow every static
// point light (fake bloom), enable shadows (cube lights or a sky key), add dust.
function lightScene(scene, bounds, opts) {
  opts = opts || {};
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const pls = [];
  scene.traverse(o => {
    if (o.isMesh) { const _tr = o.material && o.material.transparent; o.castShadow = !_tr; o.receiveShadow = true; }
    else if (o.isPointLight) pls.push(o);
  });
  pls.forEach(L => {
    const sp = glowSprite(L.color.getHex(), opts.glowSize || 4.4, opts.glowOpacity == null ? 0.8 : opts.glowOpacity);
    sp.position.copy(L.position);
    scene.add(sp);
  });
  if (opts.ceil === false) {
    keyLight(scene, opts.sky || 0xbfd0ff, bounds, low ? 0.45 : (opts.skyI == null ? 0.85 : opts.skyI));
  } else if (!low) {
    pls.slice().sort((a, b) => b.intensity - a.intensity).slice(0, opts.shadowLights || 3).forEach(L => {
      L.castShadow = true;
      L.shadow.mapSize.set(1024, 1024);
      L.shadow.bias = -0.004;
      L.shadow.camera.near = 0.4;
      L.shadow.camera.far = (L.distance || 20) + 4;
    });
  }
  if (!opts.noDust) scene.add(dustField(bounds, opts.dust || 0x88a0c0, low ? 55 : (opts.dustN || 130)));
}

function CinematicFX({ accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 21, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(125% 105% at 50% 42%, transparent 50%, rgba(0,0,0,0.34) 82%, rgba(0,0,0,0.62) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.07, background: accent || '#7DEFFF' }} />
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'soft-light', opacity: 0.5, background: 'linear-gradient(180deg, rgba(120,150,200,0.10) 0%, transparent 30%, transparent 72%, rgba(0,0,0,0.18) 100%)' }} />
    </div>
  );
}

// ============================================================
// PROCEDURAL ROCK — sandstone color/normal/roughness textures
// + displacement, all from tileable fbm. Plus cave dressing.
// ============================================================

function caveTextures() {
  if (caveTextures._c) return caveTextures._c;
  const N = 256;
  function tile(freq, seed) {
    const grid = new Float32Array(freq * freq);
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const out = new Float32Array(N * N);
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * freq, fy = y / N * freq;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy);
      const x0 = ix % freq, y0 = iy % freq, x1 = (ix + 1) % freq, y1 = (iy + 1) % freq;
      const v00 = grid[y0 * freq + x0], v10 = grid[y0 * freq + x1], v01 = grid[y1 * freq + x0], v11 = grid[y1 * freq + x1];
      const a = v00 + (v10 - v00) * tx, bb = v01 + (v11 - v01) * tx;
      out[y * N + x] = a + (bb - a) * ty;
    }
    return out;
  }
  const H = new Float32Array(N * N);
  const layers = [[4, 1.0, 11], [8, 0.5, 23], [16, 0.27, 47], [32, 0.14, 91], [64, 0.08, 131]];
  let amp = 0; layers.forEach(l => amp += l[1]);
  layers.forEach(([f, a, sd]) => { const t = tile(f, sd); for (let i = 0; i < H.length; i++) H[i] += t[i] * a; });
  for (let i = 0; i < H.length; i++) { let v = H[i] / amp; H[i] = Math.min(1, Math.max(0, (v - 0.5) * 1.4 + 0.5)); }
  const M = tile(6, 271), crevN = tile(11, 313);
  function mk(drawer, sRGB) {
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N); drawer(img.data); ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = sRGB ? THREE.sRGBEncoding : THREE.LinearEncoding;
    return t;
  }
  const crev = [44, 33, 21], mid = [96, 79, 52], ridge = [158, 134, 88];
  const colorMap = mk(d => {
    for (let i = 0; i < N * N; i++) {
      const h = H[i];
      const dark = 1 - Math.min(0.7, (1 - crevN[i]) * 1.3);
      const mot = 0.82 + M[i] * 0.42;
      let r, g, b2;
      if (h < 0.5) { const t = h / 0.5; r = crev[0] + (mid[0] - crev[0]) * t; g = crev[1] + (mid[1] - crev[1]) * t; b2 = crev[2] + (mid[2] - crev[2]) * t; }
      else { const t = (h - 0.5) / 0.5; r = mid[0] + (ridge[0] - mid[0]) * t; g = mid[1] + (ridge[1] - mid[1]) * t; b2 = mid[2] + (ridge[2] - mid[2]) * t; }
      const o = i * 4; d[o] = Math.min(255, r * mot * dark); d[o + 1] = Math.min(255, g * mot * dark); d[o + 2] = Math.min(255, b2 * mot * dark); d[o + 3] = 255;
    }
  }, true);
  const roughMap = mk(d => { for (let i = 0; i < N * N; i++) { const r = Math.max(0, Math.min(255, 255 * (0.97 - H[i] * 0.3))); const o = i * 4; d[o] = d[o + 1] = d[o + 2] = r; d[o + 3] = 255; } }, false);
  const NS = 2.4;
  const normalMap = mk(d => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const xl = H[y * N + ((x - 1 + N) % N)], xr = H[y * N + ((x + 1) % N)];
      const yt = H[((y - 1 + N) % N) * N + x], yb = H[((y + 1) % N) * N + x];
      let nx = (xl - xr) * NS, ny = (yt - yb) * NS, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const o = (y * N + x) * 4; d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }, false);
  const dispMap = mk(d => { for (let i = 0; i < N * N; i++) { const v = H[i] * 255; const o = i * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; } }, false);
  caveTextures._c = { map: colorMap, normalMap, roughnessMap: roughMap, displacementMap: dispMap };
  return caveTextures._c;
}

function rockMaterial(o) {
  o = o || {};
  const t = caveTextures();
  const rep = o.repeat || [2, 2];
  const R = (tex) => { const c = tex.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rep[0], rep[1]); return c; };
  const m = new THREE.MeshStandardMaterial({
    map: R(t.map), normalMap: R(t.normalMap), roughnessMap: R(t.roughnessMap),
    roughness: 1, metalness: 0, color: o.tint == null ? 0xffffff : o.tint,
    normalScale: new THREE.Vector2(o.normal == null ? 1.3 : o.normal, o.normal == null ? 1.3 : o.normal),
  });
  if (o.disp) { m.displacementMap = R(t.displacementMap); m.displacementScale = o.disp; m.displacementBias = o.dispBias == null ? -o.disp * 0.5 : o.dispBias; }
  return m;
}

function caveDressing(scene, model) {
  const matBoulder = rockMaterial({ repeat: [1.3, 1.3], normal: 1.1 });
  const matSpire = rockMaterial({ repeat: [1, 2], normal: 1.0, tint: 0xc9bba0 });
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const irregular = (g, a) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (rnd() - 0.5) * a; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } p.needsUpdate = true; g.computeVertexNormals(); return g; };
  // overhead stalactites along the shaft (clip-free)
  for (let z = 56; z > -52; z -= 4 + rnd() * 5) {
    const h = 0.9 + rnd() * 2.0;
    const m = new THREE.Mesh(irregular(new THREE.ConeGeometry(0.28 + rnd() * 0.34, h, 7, 2), 0.4), matSpire);
    m.position.set((rnd() - 0.5) * 6.2, 5.15 - h / 2, z);
    m.rotation.set(Math.PI + (rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.3);
    m.castShadow = true; scene.add(m);
  }
  // rocks bulging from the shaft walls (just past the walkable band, clip-free)
  for (let z = 57; z > -52; z -= 3.5 + rnd() * 4) {
    const side = (z | 0) % 2 ? -1 : 1, sx = 4.9 + rnd() * 0.5;
    if (rnd() < 0.6) {
      const r = 0.55 + rnd() * 0.8;
      const m = new THREE.Mesh(irregular(new THREE.IcosahedronGeometry(r, 1), 0.6), matBoulder);
      m.position.set(side * sx, r * 0.7, z); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      m.castShadow = m.receiveShadow = true; scene.add(m);
    } else {
      const h = 1.0 + rnd() * 2.0;
      const m = new THREE.Mesh(irregular(new THREE.ConeGeometry(0.3 + rnd() * 0.4, h, 7, 2), 0.4), matSpire);
      m.position.set(side * sx, h / 2, z); m.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.2);
      m.castShadow = true; scene.add(m);
    }
  }
  // floor pebbles (tiny, clip-negligible)
  for (let i = 0; i < 55; i++) {
    const r = 0.12 + rnd() * 0.26;
    const m = new THREE.Mesh(irregular(new THREE.IcosahedronGeometry(r, 0), 0.7), matBoulder);
    m.position.set((rnd() - 0.5) * 7, r * 0.5, 70 - rnd() * 128); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    m.receiveShadow = true; scene.add(m);
  }
}

// ---- organic rock wall geometry (world-coherent noise displacement) ----
function rockNoise(x, y, z) {
  return (
    0.5 * Math.sin(x * 0.45 + z * 0.33) +
    0.32 * Math.cos(z * 0.8 - y * 0.5) +
    0.22 * Math.sin(x * 0.9 + y * 0.4 + 1.7) +
    0.16 * Math.sin(z * 1.5 + x * 1.2 + 4.2) +
    0.1 * Math.cos(x * 2.1 - z * 1.8 + 2.1)
  );
}

// Box wall whose surface/edges are deformed by coherent noise so it reads as
// rough rock, not a box. Noise sampled in WORLD space (cx,cz) so neighbouring
// wall runs join seamlessly. Caller positions the mesh at (cx, sy/2, cz).
function rockWall(sx, sy, sz, mat, cx, cz) {
  const segX = Math.max(2, Math.min(16, Math.round(sx / 2.5)));
  const segZ = Math.max(2, Math.min(16, Math.round(sz / 2.5)));
  const geo = new THREE.BoxGeometry(sx, sy, sz, segX, 8, segZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const wx = cx + vx, wy = sy / 2 + vy, wz = cz + vz;
    const top = Math.min(1, Math.max(0, (vy + sy / 2) / sy)); // 0 base -> 1 top
    const baseW = 0.35 + 0.65 * top;
    const dx = Math.max(-0.42, Math.min(0.42, rockNoise(wx, wy, wz) * 0.5)) * baseW;
    const dz = Math.max(-0.42, Math.min(0.42, rockNoise(wz + 50, wy, wx + 50) * 0.5)) * baseW;
    const dy = rockNoise(wx + 13, wz + 13, wy) * 0.85 * (0.3 + 0.7 * top);
    p.setXYZ(i, vx + dx, vy + dy, vz + dz);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ---- live graphics tuning (so the art pass isn't done blind) ----
function applyGfx(ctx, g) {
  if (!ctx) return;
  const { renderer, scene } = ctx;
  try {
    renderer.toneMappingExposure = g.exposure;
    if (ctx.post && ctx.post.setStrength) ctx.post.setStrength(g.bloom == null ? 0.9 : g.bloom);
    if (scene.fog) scene.fog.density = g.fog;
    scene.traverse(o => {
      if (o.isAmbientLight || o.isHemisphereLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.intensity = o.userData.base * g.ambient;
      } else if (o.isPointLight || o.isSpotLight || o.isDirectionalLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.userData.gfxIntensity = o.userData.base * g.lights;
        o.intensity = o.userData.gfxIntensity;
      } else if (o.isSprite && o.material && o.material.blending === THREE.AdditiveBlending) {
        o.material.opacity = g.glow;
      } else if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m.normalScale) m.normalScale.set(g.normal, g.normal); });
      }
    });
  } catch (e) { }
}

function GfxPanel({ gfx, setGfx, accent, embedded }) {
  const [open, setOpen] = useState(false);
  const rows = [
    ['exposure', 0.5, 2.2, 0.01], ['lights', 0.2, 3, 0.05], ['ambient', 0, 2.5, 0.05],
    ['fog', 0, 0.08, 0.002], ['normal', 0, 2.5, 0.05], ['glow', 0, 1.5, 0.05], ['bloom', 0, 2, 0.05],
  ];
  const sliders = rows.map(([k, mn, mx, st]) => (
    <div key={k} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9FB4C8', marginBottom: 2 }}><span>{k}</span><span style={{ color: '#D7E0EA' }}>{(+gfx[k]).toFixed(3)}</span></div>
      <input type="range" min={mn} max={mx} step={st} value={gfx[k]} style={{ width: '100%', accentColor: accent || '#7DEFFF' }}
        onChange={e => setGfx(g => ({ ...g, [k]: +e.target.value }))} />
    </div>
  ));
  if (embedded) return <div>{sliders}</div>;
  if (!open) return (
    <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => setOpen(true)}>graphics</button>
  );
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 26, width: 236, background: 'rgba(8,10,14,0.93)', border: '1px solid #273245', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span className="eyebrow" style={{ color: accent || '#7DEFFF' }}>graphics · tune live</span>
        <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>close</button>
      </div>
      {sliders}
      <button className="btn sm" style={{ width: '100%', marginTop: 4 }}
        onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(gfx)); } catch (e) { } }}>
        copy settings → paste to Claude
      </button>
    </div>
  );
}

// ============================================================
// IMMERSION FX — cinematic overlays, transitions, juice
// EnterFade: black -> transparent on scene mount
// stepCamera: head-bob, lateral sway, view roll, sprint FOV kick, footstep beats
// createAmbience: synthesized ambient bed (drone + air + torch flicker + footsteps + crackle)
//   hung off AudioFX.ctx, gated by AudioFX.enabled, composes with GfxPanel lights slider.
// All audio wrapped in try/catch — a failed AudioContext must never break the scene.
// ============================================================

function EnterFade() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 28, background: '#000',
      opacity: on ? 1 : 0, transition: 'opacity 0.9s ease', pointerEvents: 'none',
    }} />
  );
}

// Mutates camera each frame. `st` is a persistent per-screen state bag ({}).
// Returns true on the frames a footfall lands (so the caller can play a step).
function stepCamera(camera, eyeY, dt, moving, sprint, st) {
  const targetFov = (sprint && moving) ? 81 : 74;
  if (st.fov == null) st.fov = 74;
  st.fov += (targetFov - st.fov) * Math.min(1, dt * 6);
  camera.fov = st.fov;
  camera.updateProjectionMatrix();

  if (st.phase == null) { st.phase = 0; st.stepIdx = 0; }
  let stepped = false;
  if (moving) {
    const freq = sprint ? 12.5 : 8.5;
    st.phase += dt * freq;
    const amp = sprint ? 0.10 : 0.065;
    // abs(sin) -> classic double-bounce-per-stride foot strike
    camera.position.y = eyeY + Math.abs(Math.sin(st.phase)) * amp - amp * 0.5;
    camera.position.x += Math.sin(st.phase) * (sprint ? 0.045 : 0.03);
    camera.rotation.z = Math.sin(st.phase) * (sprint ? 0.016 : 0.011);
    const idx = Math.floor(st.phase / Math.PI);
    if (idx !== st.stepIdx) { st.stepIdx = idx; stepped = true; }
  } else {
    // settle bob + roll back toward neutral
    camera.position.y = eyeY + (camera.position.y - eyeY) * (1 - Math.min(1, dt * 9));
    camera.rotation.z += (0 - camera.rotation.z) * Math.min(1, dt * 9);
  }
  return stepped;
}

// Build a synthesized ambient bed for a scene. Call once after lights exist.
// kind: 'mine' | 'cave' | 'fortress' | 'foundry' | 'canyon' | 'arcade'
function createAmbience(scene, kind) {
  // collect flicker-able point lights once (lanterns / torches / held fill light)
  const pls = [];
  try {
    scene.traverse((o) => { if (o.isPointLight) pls.push({ l: o, base: o.intensity, ph: Math.random() * 6.28 }); });
  } catch (e) { }

  let audio = null;
  try {
    AudioFX.ensure();
    const ctx = AudioFX.ctx;
    if (ctx) {
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      // --- drone: 3 detuned oscillators -> lowpass ---
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kind === 'arcade' ? 320 : 220;
      lp.Q.value = 0.7;
      lp.connect(master);
      const baseFreq = kind === 'foundry' ? 70 : kind === 'canyon' ? 58 : kind === 'arcade' ? 96 : 62;
      const oscs = [];
      [[baseFreq, 'sine', 0.5], [baseFreq * 1.5, 'triangle', 0.26], [baseFreq * 0.5, 'sine', 0.42]].forEach((spec) => {
        const o = ctx.createOscillator();
        o.type = spec[1];
        o.frequency.value = spec[0];
        o.detune.value = (Math.random() - 0.5) * 8;
        const og = ctx.createGain();
        og.gain.value = spec[2];
        o.connect(og); og.connect(lp);
        o.start();
        oscs.push(o);
      });

      // --- air: looped filtered noise ---
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const dch = buf.getChannelData(0);
      for (let i = 0; i < dch.length; i++) dch[i] = (Math.random() * 2 - 1) * 0.5;
      const noise = ctx.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = kind === 'arcade' ? 1400 : 600;
      bp.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.value = kind === 'arcade' ? 0.06 : 0.1;
      noise.connect(bp); bp.connect(ng); ng.connect(master);
      noise.start();

      audio = {
        ctx, master, oscs, noise,
        target: kind === 'arcade' ? 0.42 : 0.5,
        crackle: (kind === 'mine' || kind === 'cave' || kind === 'fortress'),
        tAcc: 0, next: 0.5,
      };
    }
  } catch (e) { audio = null; }

  return {
    update(dt, t, moving, sprint) {
      // torch flicker (composes with GfxPanel lights slider via gfxIntensity)
      for (let i = 0; i < pls.length; i++) {
        const p = pls[i];
        const steady = (p.l.userData && p.l.userData.gfxIntensity != null) ? p.l.userData.gfxIntensity : p.base;
        const f = 0.82 + 0.11 * Math.sin(t * 6.5 + p.ph) + 0.06 * Math.sin(t * 21 + p.ph * 2.3) + 0.03 * Math.sin(t * 47 + p.ph);
        p.l.intensity = steady * f;
      }
      if (audio) {
        try {
          const want = AudioFX.enabled ? audio.target : 0;
          audio.master.gain.setTargetAtTime(want, audio.ctx.currentTime, 0.4);
          if (audio.crackle && AudioFX.enabled) {
            audio.tAcc += dt;
            if (audio.tAcc >= audio.next) { audio.tAcc = 0; audio.next = 0.5 + Math.random() * 2.5; this._crackle(); }
          }
        } catch (e) { }
      }
    },
    _crackle() {
      if (!audio) return;
      try {
        const ctx = audio.ctx, t0 = ctx.currentTime;
        const n = Math.floor(ctx.sampleRate * 0.08);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
        const s = ctx.createBufferSource(); s.buffer = b;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
        const g = ctx.createGain(); g.gain.value = 0.04;
        s.connect(hp); hp.connect(g); g.connect(ctx.destination);
        s.start(t0); s.stop(t0 + 0.1);
      } catch (e) { }
    },
    footstep() {
      if (!audio || !AudioFX.enabled) return;
      try {
        const ctx = audio.ctx, t0 = ctx.currentTime;
        const n = Math.floor(ctx.sampleRate * 0.09);
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.4);
        const s = ctx.createBufferSource(); s.buffer = b;
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 320 + Math.random() * 120;
        const g = ctx.createGain(); g.gain.value = 0.05;
        s.connect(flt); flt.connect(g); g.connect(ctx.destination);
        s.start(t0); s.stop(t0 + 0.12);
      } catch (e) { }
    },
    dispose() {
      try {
        if (audio) {
          audio.oscs.forEach((o) => { try { o.stop(); } catch (e) { } });
          try { audio.noise.stop(); } catch (e) { }
          try { audio.master.disconnect(); } catch (e) { }
        }
      } catch (e) { }
      pls.forEach((p) => { try { p.l.intensity = p.base; } catch (e) { } });
    },
  };
}

// ============================================================
// ENEMY SPEC — procedural creature specs (pure, no THREE)
// Maps an enemy (world + name + boss flag) to a creature archetype,
// palette, scale, and part counts. Deterministic from the name hash so a
// given enemy always looks the same. makeCreature() (ui_16b) consumes this.
// ============================================================

function creatureHash(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// world accent colors (match WORLDS palette)
const CREATURE_PALETTE = {
  1: 0xF5B14C, 2: 0xA3E635, 3: 0x22D3EE, 4: 0xFB923C, 5: 0xA78BFA, 6: 0xFB7185, 7: 0xFACC15,
};

// silhouette archetype per world (minion vs boss)
const WORLD_ARCH = {
  1: { min: 'floater', boss: 'serpent' },  // number systems — imps / the wyrm
  2: { min: 'biped', boss: 'biped' },       // gates — hounds / the golem
  3: { min: 'obelisk', boss: 'obelisk' },   // modules — shades / the hierarch
  4: { min: 'serpent', boss: 'biped' },     // combinational — serpents / the colossus
  5: { min: 'floater', boss: 'obelisk' },   // clock — phantoms / the tyrant
  6: { min: 'floater', boss: 'floater' },   // fsm — wisps / the state engine
  7: { min: 'obelisk', boss: 'obelisk' },   // tapeout — sentinels / silicon prime
};

function creatureSpec(world, name, boss) {
  const w = CREATURE_PALETTE[world] ? world : 1;
  const a = WORLD_ARCH[w];
  const arch = boss ? a.boss : a.min;
  const hsh = creatureHash(name + '|' + w + '|' + (boss ? 'B' : 'm'));
  const accent = CREATURE_PALETTE[w];
  const sc = boss ? 1.9 : (0.85 + (hsh % 40) / 100); // minion 0.85..1.24
  const segs = arch === 'serpent' ? (boss ? 9 : 4 + (hsh % 3)) : 0;
  const shards = arch === 'floater' ? (boss ? 5 : 1 + (hsh % 3)) : 0;
  const rings = arch === 'obelisk' ? (boss ? 3 : 1) : 0;
  return { world: w, arch, boss: !!boss, accent, sc, segs, shards, rings, seed: hsh };
}

// ============================================================
// ENEMY MESH — procedural creature build + animation (THREE r128)
// makeCreature: roughened organic minions. makeWyrmBoss (Phase 10): a giant
// articulated serpent — tapered slithering spine, fanged opening jaw, horns,
// glowing eyes/throat, dorsal spikes — that rears and tracks the player.
// updateCreature routes the wyrm to updateWyrm. Eyes/core use coreMat so the
// clear-recolor still drives "core goes cold". r128-safe. Never run headless.
// ============================================================

function makeWyrmBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent;
  const skin = matStd(0x16110f, { roughness: 0.86, metalness: 0.26 });
  const scaleMat = matStd(0x2a1d12, { roughness: 0.7, metalness: 0.34 });
  const teeth = matStd(0xd8cbb0, { roughness: 0.45, metalness: 0.08 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });

  const N = 24;
  const segGroup = new THREE.Group(); g.add(segGroup);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const r = (1.35 * (1 - u) + 0.28);                 // thick neck -> thin tail
    const m = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(r, 1), r * 0.16, 700 + i), i % 4 === 0 ? scaleMat : skin);
    m.scale.z = 1.25;
    m.castShadow = true; segGroup.add(m);
    if (i > 1 && i % 2 === 0) {                          // dorsal spikes
      const sp = new THREE.Mesh(roughen(new THREE.ConeGeometry(r * 0.42, r * 1.5, 5), r * 0.08, 760 + i), scaleMat);
      sp.position.y = r * 0.95; sp.rotation.x = -0.15; m.add(sp);
    }
    segs.push({ m, u, r });
  }

  // ---- head ----
  const head = new THREE.Group(); g.add(head);
  const skull = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1.5, 1), 0.2, 901), skin);
  skull.scale.set(0.95, 0.82, 1.5); head.add(skull);                 // long snout
  const tR = 0.16, tH = 0.7;
  for (let k = 0; k < 9; k++) {                                       // upper fangs
    const a = (k / 8 - 0.5) * 2.4;
    const up = new THREE.Mesh(new THREE.ConeGeometry(tR, tH, 5), teeth);
    up.position.set(Math.sin(a) * 0.95, -0.5, 1.55 + Math.cos(a) * 0.5); up.rotation.x = Math.PI; head.add(up);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.55, 0.2); head.add(jaw);
  const jawMesh = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1.15, 1), 0.16, 902), skin);
  jawMesh.scale.set(0.82, 0.5, 1.35); jawMesh.position.set(0, -0.1, 0.55); jaw.add(jawMesh);
  for (let k = 0; k < 9; k++) {                                       // lower fangs
    const a = (k / 8 - 0.5) * 2.4;
    const lo = new THREE.Mesh(new THREE.ConeGeometry(tR, tH, 5), teeth);
    lo.position.set(Math.sin(a) * 0.85, 0.15, 1.35 + Math.cos(a) * 0.45); jaw.add(lo);
  }
  [-1, 1].forEach(s => {                                              // swept horns
    const h1 = new THREE.Mesh(roughen(new THREE.ConeGeometry(0.32, 2.1, 6), 0.06, 910 + s), teeth);
    h1.position.set(s * 0.7, 0.95, -0.3); h1.rotation.set(-0.8, 0, s * 0.35); head.add(h1);
    const h2 = new THREE.Mesh(roughen(new THREE.ConeGeometry(0.22, 1.3, 6), 0.05, 920 + s), teeth);
    h2.position.set(s * 1.05, 0.45, 0.2); h2.rotation.set(-0.2, 0, s * 0.9); head.add(h2);
  });
  [-1, 1].forEach(s => {                                              // eyes + brow ridges
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), core);
    eye.position.set(s * 0.62, 0.32, 0.95); head.add(eye);
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), skin);
    brow.position.set(s * 0.62, 0.66, 0.85); brow.rotation.set(-1.45, 0, s * 0.2); head.add(brow);
  });
  const maw = new THREE.PointLight(P, 1.4, 11, 2.0); maw.position.set(0, -0.15, 1.0); head.add(maw);
  const mawCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), core); mawCore.position.set(0, -0.2, 0.7); mawCore.scale.set(0.7, 0.5, 0.7); head.add(mawCore);

  g.scale.set(1.5, 1.5, 1.5);   // fill the tall arena
  g.userData = { wyrm: true, segs, head, jaw, core, phase: (spec.seed % 628) / 100, dead: false, N, span: 11, headHeight: 5.4, sc: spec.sc };
  return g;
}

function updateWyrm(group, t, opts) {
  const u = group.userData;
  if (!u || !u.wyrm) return;
  const dt = (opts && opts.dt) || 0.016;
  if (opts && opts.dist != null) {
    const want = Math.atan2(opts.dx, opts.dz);
    let cur = group.rotation.y, d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    group.rotation.y = cur + d * Math.min(1, dt * 1.6);
  }
  const dead = u.dead;
  const aggro = !dead && opts && opts.dist != null && opts.dist < 14;
  u.phase += dt * (aggro ? 1.7 : 1.0) * (1 + ((u.enrage || 1) - 1) * 0.4);
  const ph = u.phase, H = dead ? 0.7 : u.headHeight, span = u.span;
  for (let i = 0; i < u.segs.length; i++) {
    const s = u.segs[i], p = s.u;
    const rear = H * Math.pow(Math.max(0, 1 - p * 1.7), 1.7);
    const ripple = dead ? 0 : Math.sin(p * 5.2 - ph * 2.4) * (0.3 + p * 0.8);
    const sway = dead ? Math.sin(p * 3) * 0.6 : Math.sin(p * 3.8 - ph * 2.1) * (0.5 + p * 2.4);
    s.m.position.set(sway, Math.max(s.r * 0.45, rear + ripple), -p * span - (dead ? 0 : Math.sin(p * 2.6 - ph * 1.6) * 0.4));
    s.m.rotation.y = Math.cos(p * 3.8 - ph * 2.1) * 0.35;
    s.m.rotation.z = Math.sin(p * 4 - ph * 2.2) * 0.18;
  }
  const h0 = u.segs[0].m.position;
  u.head.position.set(h0.x * 0.6, h0.y + 0.5, h0.z + 1.6);
  u.head.rotation.x = -0.4 + Math.sin(ph * 1.3) * 0.08 + (aggro ? -0.18 : 0);
  u.head.rotation.y = Math.sin(ph * 0.9) * 0.12;
  u.head.rotation.z = Math.sin(ph * 1.05) * 0.06;
  u.jaw.rotation.x = dead ? 0.05 : (aggro ? 0.4 + Math.abs(Math.sin(ph * 3.6)) * 0.6 : 0.14 + Math.abs(Math.sin(ph * 1.2)) * 0.13);
  if (dead) group.rotation.z = Math.min(1.1, (group.rotation.z || 0) + dt * 0.7);
  else group.rotation.z += (0 - group.rotation.z) * Math.min(1, dt * 3);
}

// ---- bespoke boss forms (Phase 12): biped / obelisk / floater, built on the
// generic updateCreature animation skeleton (body + anim hooks), per-world signatures.
function _bossMk(par, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; }

function makeBipedBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7, colossus = spec.world === 4;
  const skin = matStd(0x0d1118, { roughness: 0.85, metalness: 0.42 });
  const plate = matStd(0x161d28, { roughness: 0.58, metalness: 0.56 });
  const acc = matStd(P, { roughness: 0.4, metalness: 0.5, emissive: P, emissiveIntensity: 0.4 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk;
  // legs + feet (wide, heavy)
  [-1, 1].forEach(s => {
    mk(g, roughen(new THREE.CylinderGeometry(0.4 * sc, 0.54 * sc, 1.95 * sc, 8), 0.08 * sc, sd + s + 1), plate, s * 0.64 * sc, 0.98 * sc, 0);
    mk(g, roughen(new THREE.BoxGeometry(0.74 * sc, 0.42 * sc, 1.05 * sc), 0.06 * sc, sd + s + 5), plate, s * 0.64 * sc, 0.2 * sc, 0.16 * sc);
  });
  // torso
  const torso = mk(body, roughen(new THREE.DodecahedronGeometry(1.5 * sc, 0), 0.2 * sc, sd + 11), plate, 0, 2.95 * sc, 0);
  torso.scale.set(1.18, 1.3, 0.95);
  mk(body, new THREE.IcosahedronGeometry(0.52 * sc, 0), core, 0, 3.0 * sc, 0.88 * sc); // chest core
  const halo = new THREE.PointLight(P, 1.3, 9 * sc, 2); halo.position.set(0, 3.0 * sc, 0.88 * sc); body.add(halo);
  // shoulders + pauldron spikes
  [-1, 1].forEach(s => {
    mk(body, roughen(new THREE.IcosahedronGeometry(0.72 * sc, 0), 0.14 * sc, sd + 20 + s), plate, s * 1.55 * sc, 3.75 * sc, 0);
    const sp = mk(body, new THREE.ConeGeometry(0.26 * sc, 1.0 * sc, 5), acc, s * 1.68 * sc, 4.25 * sc, 0); sp.rotation.z = s * 0.5;
  });
  // arms + fists (colossus: a second, lower pair)
  (colossus ? [{ y: 3.45, len: 2.1 }, { y: 2.5, len: 1.8 }] : [{ y: 3.45, len: 2.1 }]).forEach(ap => [-1, 1].forEach(s => {
    const arm = mk(body, roughen(new THREE.CylinderGeometry(0.27 * sc, 0.36 * sc, ap.len * sc, 7), 0.06 * sc, sd + 30 + s + Math.round(ap.y)), skin, s * 1.78 * sc, ap.y * sc, 0); arm.rotation.z = s * 0.16;
    mk(body, roughen(new THREE.BoxGeometry(0.64 * sc, 0.64 * sc, 0.64 * sc), 0.08 * sc, sd + 40 + s + Math.round(ap.y)), plate, s * 2.05 * sc, (ap.y - ap.len * 0.55) * sc, 0);
  }));
  // head + eye visor
  const head = mk(body, roughen(new THREE.IcosahedronGeometry(0.62 * sc, 1), 0.1 * sc, sd + 50), plate, 0, 4.2 * sc, 0.05 * sc);
  head.scale.set(0.92, 1.0, 1.05);
  for (let k = -1; k <= 1; k++) mk(body, new THREE.BoxGeometry(0.17 * sc, 0.1 * sc, 0.08 * sc), core, k * 0.23 * sc, 4.24 * sc, 0.52 * sc);
  if (colossus) { [-1, 1].forEach(s => { const h = mk(body, new THREE.ConeGeometry(0.18 * sc, 1.15 * sc, 6), plate, s * 0.42 * sc, 4.78 * sc, 0); h.rotation.set(-0.3, 0, s * 0.42); }); }
  else { mk(body, roughen(new THREE.BoxGeometry(1.05 * sc, 0.42 * sc, 0.95 * sc), 0.1 * sc, sd + 60), plate, 0, 4.78 * sc, 0); }
  body.userData.bobY = 0.05 * sc;
  g.userData = { body, core, anim: { arch: 'biped', head }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeObeliskBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7, W = spec.world;
  const stone = matStd(0x10141d, { roughness: 0.7, metalness: 0.5 });
  const acc = matStd(P, { roughness: 0.35, metalness: 0.55, emissive: P, emissiveIntensity: 0.45 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk;
  const trunk = mk(body, roughen(new THREE.CylinderGeometry(0.72 * sc, 1.15 * sc, 5.0 * sc, 6), 0.12 * sc, sd + 1), stone, 0, 2.7 * sc, 0);
  trunk.rotation.y = 0.4;
  mk(body, new THREE.BoxGeometry(0.2 * sc, 3.3 * sc, 0.2 * sc), core, 0, 2.8 * sc, 0.98 * sc); // core seam
  mk(body, new THREE.IcosahedronGeometry(0.56 * sc, 0), core, 0, 3.1 * sc, 0);
  const halo = new THREE.PointLight(P, 1.4, 12 * sc, 2); halo.position.set(0, 3.1 * sc, 0); body.add(halo);
  const ringHolder = new THREE.Group(); ringHolder.position.set(0, 3.1 * sc, 0); body.add(ringHolder);
  const rl = [];
  for (let i = 0; i < 3; i++) { const tr = new THREE.Mesh(new THREE.TorusGeometry((1.45 + 0.55 * i) * sc, 0.08 * sc, 8, 30), acc); tr.rotation.x = Math.PI / 2 + i * 0.5; ringHolder.add(tr); rl.push(tr); }
  mk(body, roughen(new THREE.ConeGeometry(0.72 * sc, 1.5 * sc, 6), 0.1 * sc, sd + 9), acc, 0, 5.5 * sc, 0); // apex
  if (W === 3) { // hierarch — orbiting module-blocks
    for (let i = 0; i < 3; i++) mk(ringHolder, roughen(new THREE.BoxGeometry(0.52 * sc, 0.52 * sc, 0.52 * sc), 0.06 * sc, sd + 20 + i), stone, Math.cos(i * 2.1) * 1.95 * sc, 0, Math.sin(i * 2.1) * 1.95 * sc);
  } else if (W === 5) { // tyrant — clock face + hands
    const face = mk(body, new THREE.CylinderGeometry(1.15 * sc, 1.15 * sc, 0.14 * sc, 24), stone, 0, 4.0 * sc, 0.9 * sc); face.rotation.x = Math.PI / 2;
    mk(body, new THREE.IcosahedronGeometry(0.13 * sc, 0), core, 0, 4.0 * sc, 1.0 * sc);
    const hh = mk(body, new THREE.BoxGeometry(0.09 * sc, 0.72 * sc, 0.05 * sc), acc, 0, 4.3 * sc, 1.0 * sc);
    const mh = mk(body, new THREE.BoxGeometry(0.07 * sc, 1.0 * sc, 0.05 * sc), acc, 0.4 * sc, 4.1 * sc, 1.0 * sc); mh.rotation.z = 1.15;
  } else if (W === 7) { // silicon prime — chip-die crown with traces
    mk(body, new THREE.BoxGeometry(1.85 * sc, 0.2 * sc, 1.85 * sc), stone, 0, 5.7 * sc, 0);
    for (let i = -1; i <= 1; i++) { mk(body, new THREE.BoxGeometry(1.6 * sc, 0.06 * sc, 0.08 * sc), core, 0, 5.82 * sc, i * 0.52 * sc); mk(body, new THREE.BoxGeometry(0.08 * sc, 0.06 * sc, 1.6 * sc), core, i * 0.52 * sc, 5.82 * sc, 0); }
  }
  body.userData.bobY = 0.05 * sc;
  g.userData = { body, core, anim: { arch: 'obelisk', rings: rl, ringHolder }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeFloaterBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7;
  const shell = matStd(0x0e131c, { roughness: 0.6, metalness: 0.55 });
  const acc = matStd(P, { roughness: 0.35, metalness: 0.5, emissive: P, emissiveIntensity: 0.5 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk, cy = 2.05 * sc;
  mk(body, new THREE.IcosahedronGeometry(0.98 * sc, 1), core, 0, cy, 0); // brain core
  const halo = new THREE.PointLight(P, 1.6, 13 * sc, 2); halo.position.set(0, cy, 0); body.add(halo);
  const s1 = mk(body, roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.18 * sc, sd + 1), shell, 0, cy + 0.72 * sc, 0); s1.scale.set(1, 0.55, 1);
  const s2 = mk(body, roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.18 * sc, sd + 2), shell, 0, cy - 0.72 * sc, 0); s2.scale.set(1, 0.55, 1);
  const ring = new THREE.Group(); ring.position.set(0, cy, 0); body.add(ring);
  const sl = []; const Nn = 6;
  for (let i = 0; i < Nn; i++) { const ang = i / Nn * Math.PI * 2; sl.push(mk(ring, roughen(new THREE.OctahedronGeometry(0.42 * sc, 0), 0.06 * sc, sd + 10 + i), acc, Math.cos(ang) * 2.35 * sc, Math.sin(i * 1.7) * 0.4 * sc, Math.sin(ang) * 2.35 * sc)); }
  body.userData.bobY = 0.18 * sc;
  g.userData = { body, core, anim: { arch: 'floater', ring, shards: sl, float: true }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeCreature(spec, coreMat) {
  if (spec.boss && spec.arch === 'serpent') return makeWyrmBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'biped') return makeBipedBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'obelisk') return makeObeliskBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'floater') return makeFloaterBoss(spec, coreMat);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const P = spec.accent;
  const sc = spec.sc;
  const matBody = matStd(0x0c1016, { roughness: 0.82, metalness: 0.32 });
  const matAcc = matStd(P, { roughness: 0.45, metalness: 0.5, emissive: P, emissiveIntensity: 0.32 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const anim = { arch: spec.arch };
  let _si = (spec.seed >>> 0) || 11;
  const rg = (geo, amt) => { _si = (_si * 1664525 + 1013904223) >>> 0; return roughen(geo, amt, _si); };

  const mesh = (parent, geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  if (spec.arch === 'biped') {
    mesh(g, rg(new THREE.CylinderGeometry(0.26 * sc, 0.3 * sc, 1.35 * sc, 7), 0.06 * sc), matBody, -0.42 * sc, 0.68 * sc, 0);
    mesh(g, rg(new THREE.CylinderGeometry(0.26 * sc, 0.3 * sc, 1.35 * sc, 7), 0.06 * sc), matBody, 0.42 * sc, 0.68 * sc, 0);
    const torso = mesh(body, rg(new THREE.DodecahedronGeometry(0.95 * sc, 0), 0.16 * sc), matBody, 0, 2.05 * sc, 0);
    torso.scale.set(0.92, 1.25, 0.78);
    mesh(body, rg(new THREE.CylinderGeometry(0.2 * sc, 0.24 * sc, 1.5 * sc, 6), 0.06 * sc), matBody, -1.0 * sc, 2.1 * sc, 0);
    mesh(body, rg(new THREE.CylinderGeometry(0.2 * sc, 0.24 * sc, 1.5 * sc, 6), 0.06 * sc), matBody, 1.0 * sc, 2.1 * sc, 0);
    const head = mesh(body, rg(new THREE.IcosahedronGeometry(0.55 * sc, 1), 0.1 * sc), matBody, 0, 3.25 * sc, 0);
    mesh(body, new THREE.IcosahedronGeometry(0.16 * sc, 0), core, -0.18 * sc, 3.28 * sc, 0.42 * sc);
    mesh(body, new THREE.IcosahedronGeometry(0.16 * sc, 0), core, 0.18 * sc, 3.28 * sc, 0.42 * sc);
    mesh(body, new THREE.OctahedronGeometry(0.32 * sc, 0), core, 0, 2.2 * sc, 0.5 * sc);
    anim.head = head;
    body.userData.bobY = 0.06 * sc;
  } else if (spec.arch === 'serpent') {
    const seglist = [];
    for (let i = 0; i < spec.segs; i++) {
      const r = Math.max(0.18, (0.64 - 0.036 * i) * sc);
      const yy = (1.0 + Math.sin(i * 0.6) * 0.5) * sc;
      const zz = (-i * 0.92) * sc;
      const s = mesh(body, rg(new THREE.IcosahedronGeometry(r, 1), r * 0.28), i === 0 ? matAcc : matBody, 0, yy, zz);
      seglist.push({ m: s, y0: yy, i });
    }
    const head = mesh(body, rg(new THREE.ConeGeometry(0.52 * sc, 1.05 * sc, 7), 0.07 * sc), matBody, 0, 1.05 * sc, 0.85 * sc);
    head.rotation.x = Math.PI / 2;
    mesh(body, new THREE.IcosahedronGeometry(0.18 * sc, 0), core, 0.2 * sc, 1.18 * sc, 1.05 * sc);
    mesh(body, new THREE.IcosahedronGeometry(0.18 * sc, 0), core, -0.2 * sc, 1.18 * sc, 1.05 * sc);
    anim.segs = seglist; anim.head = head;
    body.userData.bobY = 0.05 * sc;
  } else if (spec.arch === 'floater') {
    const bodyMesh = mesh(body, rg(new THREE.IcosahedronGeometry(0.82 * sc, 1), 0.16 * sc), matBody, 0, 1.5 * sc, 0);
    mesh(body, new THREE.IcosahedronGeometry(0.3 * sc, 0), core, 0, 1.55 * sc, 0.72 * sc);
    const ring = new THREE.Group(); ring.position.set(0, 1.5 * sc, 0); body.add(ring);
    const sl = [];
    for (let i = 0; i < spec.shards; i++) {
      const ang = i / Math.max(1, spec.shards) * Math.PI * 2;
      sl.push(mesh(ring, rg(new THREE.OctahedronGeometry(0.3 * sc, 0), 0.05 * sc), matAcc, Math.cos(ang) * 1.4 * sc, 0, Math.sin(ang) * 1.4 * sc));
    }
    anim.ring = ring; anim.shards = sl; anim.bodyMesh = bodyMesh; anim.float = true;
    body.userData.bobY = 0.16 * sc;
  } else { // obelisk
    const trunk = mesh(body, rg(new THREE.OctahedronGeometry(0.92 * sc, 1), 0.12 * sc), matBody, 0, 1.5 * sc, 0);
    trunk.scale.y = 2.2;
    mesh(body, new THREE.IcosahedronGeometry(0.3 * sc, 0), core, 0, 2.0 * sc, 0.55 * sc);
    mesh(body, rg(new THREE.ConeGeometry(0.55 * sc, 0.9 * sc, 5), 0.08 * sc), matAcc, 0, 3.5 * sc, 0);
    const ringHolder = new THREE.Group(); ringHolder.position.set(0, 2.0 * sc, 0); body.add(ringHolder);
    const rl = [];
    for (let i = 0; i < spec.rings; i++) {
      const tr = new THREE.Mesh(new THREE.TorusGeometry((1.0 + 0.5 * i) * sc, 0.06 * sc, 8, 28), matAcc);
      tr.rotation.x = Math.PI / 2 + i * 0.4;
      ringHolder.add(tr); rl.push(tr);
    }
    anim.rings = rl; anim.ringHolder = ringHolder;
    body.userData.bobY = 0.07 * sc;
  }

  g.userData = { body, core, anim, phase: (spec.seed % 628) / 100, dead: false, sc, boss: spec.boss };
  return g;
}

function updateCreature(group, t, opts) {
  if (group.userData && group.userData.wyrm) { updateWyrm(group, t, opts); return; }
  const u = group.userData;
  if (!u || !u.body) return;
  const body = u.body, a = u.anim;
  const dt = (opts && opts.dt) || 0.016;

  if (opts && opts.dist != null && opts.dist < 16) {
    const want = Math.atan2(opts.dx, opts.dz);
    let cur = group.rotation.y, d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    group.rotation.y = cur + d * Math.min(1, dt * 3);
  }

  if (u.dead) {
    body.rotation.x += (0.7 - body.rotation.x) * Math.min(1, dt * 4);
    body.position.y += (-0.5 * u.sc - body.position.y) * Math.min(1, dt * 4);
    return;
  }

  const ph = u.phase;
  const by = body.userData.bobY || 0.06;
  const aggro = opts && opts.dist != null && opts.dist < 10;
  const sp = (aggro ? 1.8 : 1) * (1 + ((u.enrage || 1) - 1) * 0.4);
  body.position.y = Math.sin(t * 1.6 * sp + ph) * by;
  body.rotation.z = Math.sin(t * 1.05 * sp + ph) * 0.04;
  body.rotation.x += ((aggro ? 0.16 : 0) - body.rotation.x) * Math.min(1, dt * 4);
  if (u.hitT) { const _k = Math.max(0, 1 - (t - u.hitT) / 0.3); if (_k > 0) { body.rotation.x -= _k * 0.5; body.position.y -= _k * 0.3 * u.sc; } }
  if (a.float) body.position.y += 0.12 * u.sc + Math.sin(t * 0.9 + ph) * 0.06 * u.sc;
  if (a.ring) a.ring.rotation.y += dt * (aggro ? 1.6 : 0.7);
  if (a.shards) for (let i = 0; i < a.shards.length; i++) { a.shards[i].rotation.x += dt * 1.2; a.shards[i].rotation.y += dt * 0.9; }
  if (a.ringHolder) a.ringHolder.rotation.y += dt * (aggro ? 1.2 : 0.5);
  if (a.segs) for (let i = 0; i < a.segs.length; i++) { const s = a.segs[i]; s.m.position.y = s.y0 + Math.sin(t * 2.2 * sp + s.i * 0.5 + ph) * 0.12 * u.sc; }
  if (a.head) a.head.rotation.z = Math.sin(t * 1.3 * sp + ph) * 0.08;
}

// ============================================================
// OPEN-WORLD MODELS — valley + canyon layouts (pure, testable)
// valleyModel (world 2): open basin you cross, gated golem grounds at the far end.
// canyonModel (world 4): a winding S-shaped ravine, gated colossus mesa at the end.
// Both return the SAME shape as dungeonModel + { biome, gateX, gateW } so the
// generic DungeonScreen / progress / gate logic all work unchanged. Reuses
// mineWalls (perimeter colliders + openings where rects connect) and mkBox.
// ============================================================

// ============================================================
// PROGRESSION OVERHAUL — stations, learning order, next-beacon
// ============================================================
// Interleave lessons with the challenges that use them: each field note is
// followed by its share of the world's regular challenges. This sequence IS
// the learning order, and station numbers everywhere refer to it.
function stationSequence(regular, lessonIds) {
  const lids = lessonIds || [];
  if (!lids.length) return regular.map(f => ({ kind: 'fight', f }));
  const G = lids.length, F = regular.length, base = Math.floor(F / G), extra = F % G;
  const seq = []; let fi = 0;
  for (let g = 0; g < G; g++) {
    seq.push({ kind: 'book', lid: lids[g] });
    const take = base + (g < extra ? 1 : 0);
    for (let k = 0; k < take; k++, fi++) seq.push({ kind: 'fight', f: regular[fi] });
  }
  return seq;
}
// Order free-placed spots by how far along the world's path they sit.
function sortByPathProgress(spots, path) {
  if (!path || path.length < 2) return spots.slice();
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const prog = (p) => {
    let best = 1e9, arc = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      let t = L2 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
      if (d < best) { best = d; arc = cum[i] + Math.sqrt(L2) * t; }
    }
    return arc;
  };
  return spots.slice().sort((a, b) => prog(a) - prog(b));
}
// First station (by number) the player hasn't finished — notes read, fights won.
function nextStationOf(model, save) {
  const d = activeDone(save), lr = save.lessons || {};
  const st = model.interactables.filter(i => i.ord).sort((a, b) => a.ord - b.ord);
  for (const it of st) {
    if (it.kind === 'book' ? !lr[it.lid] : !d[it.id]) return it;
  }
  return null;
}
// A tall, unmistakable "come here next" marker, repositioned as you progress.
function makeNextBeacon(scene, acc, tall) {
  const g = new THREE.Group();
  const h = tall ? 12 : 4.4;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, h, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  pillar.position.y = h / 2; g.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 26), new THREE.MeshBasicMaterial({ color: acc }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  const lbl = mineLabelSprite('▼ NEXT', '#FFFFFF', 0.8);
  lbl.position.y = tall ? 12.9 : 4.95; g.add(lbl);
  const lt = new THREE.PointLight(0xffffff, 0.9, 20, 2); lt.position.y = 2.6; g.add(lt);
  (scene.userData.anims = scene.userData.anims || []).push((t) => { ring.rotation.z = t * 1.5; pillar.material.opacity = 0.72 + 0.22 * Math.sin(t * 3.2); lbl.position.y = (tall ? 12.9 : 4.95) + Math.sin(t * 2.1) * 0.16; });
  g.visible = false;
  scene.add(g);
  return g;
}

function openModel(w, fights, lessonIds, layout) {
  const cfg = DUNGEON_CFG[w];
  const { walls, bounds } = mineWalls(layout.rects);
  const gateCollider = mkBox(layout.gateX, layout.gateZ, layout.gateW, 1.8, 'gate');

  const boss = dungeonBossFight(fights);
  const regular = fights.filter(f => f !== boss);
  // Stations in learning order along the route: each field note, then the
  // challenges that use it. Spots are walked in path order, so station #1 is
  // the first thing you meet and the boss is the last.
  const seq = stationSequence(regular, lessonIds);
  const sc = sortByPathProgress(layout.scatter, layout.path);

  const interactables = [];
  seq.forEach((s, i) => {
    const p = sc[i % sc.length], ord = i + 1;
    if (s.kind === 'book') interactables.push({ id: 'book_' + s.lid, kind: 'book', lid: s.lid, ord, x: p.x, z: p.z, r: 2.4, target: { name: 'note', id: s.lid } });
    else interactables.push({ id: s.f.id, kind: 'fight', boss: false, ord, x: p.x, z: p.z, r: 3.4, target: { name: s.f.kind, id: s.f.id }, xp: s.f.xp, title: s.f.title });
  });
  interactables.push({ id: boss.id, kind: 'fight', boss: true, ord: seq.length + 1, x: layout.boss.x, z: layout.boss.z, r: 3.4, target: { name: boss.kind, id: boss.id }, xp: boss.xp, title: boss.title });
  interactables.push({ id: 'lift', kind: 'exit', x: layout.lift.x, z: layout.lift.z, r: 2.6, target: { name: 'surface' } });

  return {
    world: w, rects: layout.rects, colliders: walls, gateCollider,
    collidersClosed: walls.concat([gateCollider]),
    interactables, bounds, path: layout.path,
    spawn: layout.spawn,
    gateZ: layout.gateZ, gateX: layout.gateX, gateW: layout.gateW,
    theme: cfg.theme, zone: cfg.zone, bossZone: cfg.bossZone,
    regularIds: regular.map(f => f.id), bossId: boss.id,
    biome: layout.biome,
  };
}

function valleyModel(w, fights, lessonIds) {
  return openModel(w, fights, lessonIds, {
    biome: 'valley',
    rects: [
      { x1: -62, z1: -100, x2: 62, z2: 0, zone: DUNGEON_CFG[w].zone },        // massive basin (124 x 100)
      { x1: -20, z1: -142, x2: 20, z2: -100, zone: DUNGEON_CFG[w].bossZone },  // golem grounds, deep north
    ],
    spawn: { x: 0, z: -8, yaw: 0 },
    lift: { x: 0, z: -3 },
    gateZ: -100, gateX: 0, gateW: 42,
    boss: { x: 0, z: -122 },
    path: [{ x: 0, z: -8 }, { x: 0, z: -52 }, { x: 0, z: -98 }, { x: 0, z: -120 }],
    scatter: [
      { x: -44, z: -22 }, { x: 46, z: -24 }, { x: -52, z: -54 }, { x: 50, z: -56 },
      { x: -26, z: -42 }, { x: 26, z: -40 }, { x: 0, z: -30 }, { x: -48, z: -84 },
      { x: 46, z: -86 }, { x: -8, z: -74 }, { x: 30, z: -80 }, { x: -28, z: -90 },
    ],
  });
}

function canyonModel(w, fights, lessonIds) {
  const Z = DUNGEON_CFG[w].zone, BZ = DUNGEON_CFG[w].bossZone;
  const S = 1.7, sc = (n) => 2 * Math.round(n * S / 2); // even-snapped: keeps rect edges off raster centers
  const baseRects = [
    { x1: -8, z1: -14, x2: 8, z2: 0, zone: Z },      // A entry (south)
    { x1: -26, z1: -26, x2: 8, z2: -14, zone: Z },   // B turn left
    { x1: -26, z1: -50, x2: -10, z2: -26, zone: Z },  // C climb
    { x1: -26, z1: -62, x2: 24, z2: -50, zone: Z },   // D cross right
    { x1: 6, z1: -86, x2: 24, z2: -62, zone: BZ },    // E colossus mesa
  ];
  const baseScatter = [
    { x: 0, z: -9 }, { x: -20, z: -20 }, { x: -2, z: -20 }, { x: -18, z: -32 },
    { x: -18, z: -44 }, { x: -18, z: -56 }, { x: 8, z: -56 }, { x: 20, z: -56 },
    { x: -10, z: -19 }, { x: -22, z: -46 }, { x: 0, z: -56 }, { x: 12, z: -56 },
    { x: -8, z: -56 }, { x: -14, z: -38 }, { x: 6, z: -23 },
  ];
  const basePath = [
    { x: 0, z: -7 }, { x: -9, z: -20 }, { x: -18, z: -38 }, { x: -1, z: -56 }, { x: 15, z: -74 },
  ];
  return openModel(w, fights, lessonIds, {
    biome: 'canyon',
    rects: baseRects.map(r => ({ x1: sc(r.x1), z1: sc(r.z1), x2: sc(r.x2), z2: sc(r.z2), zone: r.zone })),
    spawn: { x: 0, z: sc(-7), yaw: 0 },
    lift: { x: 0, z: sc(-3) },
    gateZ: sc(-62), gateX: 25, gateW: 32,
    boss: { x: sc(15), z: sc(-74) },
    scatter: baseScatter.map(s => ({ x: sc(s.x), z: sc(s.z) })),
    path: basePath.map(p => ({ x: sc(p.x), z: sc(p.z) })),
  });
}

// ============================================================
// OPEN-WORLD RENDERERS — valley + canyon biomes (THREE r128)
// buildValley / buildCanyon: sky dome + terrain + cliffs-from-colliders +
// set-pieces, then the shared buildDungeonNodes + an outdoor lightScene.
// Visual only — all gameplay (layout/collision/gate) comes from the model,
// which is BFS-verified by validate.js. Never runs headless (fallback path).
// ============================================================

function skyDome(scene, topHex, horHex, cx, cz, radius) {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
  const g = cv.getContext('2d');
  const top = '#' + topHex.toString(16).padStart(6, '0');
  const hor = '#' + horHex.toString(16).padStart(6, '0');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(0.5, top); grad.addColorStop(0.84, hor); grad.addColorStop(1, hor);
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.position.set(cx, 0, cz); scene.add(dome);
  return dome;
}

// tall barriers along every model collider — the enclosing cliffs/mesas
function cliffRun(scene, model, mat, height, jitter, seed) {
  const rng = mulberry32(seed);
  model.colliders.forEach((wl, i) => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const h = height + (rng() - 0.5) * jitter;
    const g = roughen(new THREE.BoxGeometry(sx + 0.7, h, sz + 0.7, 3, 2, 3), Math.min(1.1, (sx + sz) * 0.04 + 0.3), (seed + i * 7) >>> 0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((wl.minX + wl.maxX) / 2, h / 2 - 0.5, (wl.minZ + wl.maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  });
}

function valleyMountains(scene, cx, cz, seed) {
  const rng = mulberry32(seed >>> 0);
  const rock = matStd(0x1e2c12, { roughness: 1.0, metalness: 0.04 });
  const rockFar = matStd(0x16240e, { roughness: 1.0, metalness: 0.02 });
  const snow = matStd(0x83906c, { roughness: 0.92, metalness: 0.04 });
  const ringPeaks = (R, count, hMin, hMax, mat, capped) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.2;
      const rr = R * (0.84 + rng() * 0.32);
      const h = hMin + rng() * (hMax - hMin);
      const bw = h * (0.5 + rng() * 0.32);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const peak = new THREE.Mesh(roughen(new THREE.ConeGeometry(bw, h, 5 + (i % 3), 1), bw * 0.18, (seed + i * 13) >>> 0), mat);
      peak.position.set(x, h / 2 - 2.5, z); peak.rotation.y = rng() * Math.PI; scene.add(peak);
      if (capped && h > hMax * 0.66) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.34, h * 0.26, 5, 1), snow);
        cap.position.set(x, h - h * 0.13 - 2.5, z); scene.add(cap);
      }
    }
  };
  ringPeaks(96, 22, 28, 54, rock, true);       // near range — rises right behind the valley cliffs
  ringPeaks(150, 18, 50, 90, rockFar, false);   // far range — taller, darker, hazing into the distance
}

// A glowing floor trail tracing the route spawn -> objective, with pylons that grow
// toward the goal and a tall beacon at the destination. Unambiguous "go this way".
function buildPathTrail(scene, path, acc, openSky) {
  if (!path || path.length < 2) return;
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const coreMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.85 });
  (scene.userData.anims = scene.userData.anims || []).push((t) => { coreMat.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4)); });
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const ang = Math.atan2(dx, dz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, len), ribbonMat);
    seg.position.set((a.x + b.x) / 2, 0.08, (a.z + b.z) / 2); seg.rotation.y = ang; scene.add(seg);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, len), coreMat);
    core.position.set((a.x + b.x) / 2, 0.1, (a.z + b.z) / 2); core.rotation.y = ang; scene.add(core);
  }
  path.forEach((p, i) => {
    if (i === 0) return;
    const isEnd = i === path.length - 1;
    const h = isEnd ? (openSky ? 20 : 5) : (openSky ? 3 + (i / path.length) * 7 : 3.2);
    const r = isEnd ? 0.7 : 0.26;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: isEnd ? 0.92 : 0.62 }));
    pylon.position.set(p.x, h / 2, p.z); scene.add(pylon);
    const lt = new THREE.PointLight(acc, isEnd ? 1.9 : 0.55, isEnd ? 46 : 13, 2);
    lt.position.set(p.x, isEnd ? 7 : 3, p.z); scene.add(lt);
    if (isEnd) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: acc }));
      orb.position.set(p.x, h, p.z); scene.add(orb);
      scene.add(fxCone(acc, openSky ? 3.6 : 2.4, openSky ? 19 : 4.8, openSky ? 0.09 : 0.12, p.x, p.z));
    }
  });
}

function buildValley(scene, model, theme) {
  const acc = theme.accent;
  const b = model.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  scene.background = new THREE.Color(0x16240e);
  scene.fog = new THREE.FogExp2(0x1c2e12, 0.0085);
  skyDome(scene, 0x0c1606, 0x33491c, cx, cz, 360);
  scene.add(new THREE.HemisphereLight(0x3a5a1e, 0x0a1206, 0.82));
  scene.add(new THREE.AmbientLight(0x24300f, theme.ambient * 0.7));

  // grassy basin floor (extends well past the cliffs to the horizon)
  const fw = (b.maxX - b.minX) + 300, fd = (b.maxZ - b.minZ) + 300;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 0.98, metalness: 0.04 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  buildPathTrail(scene, model.path, acc, true);

  // enclosing rock walls (read as valley cliffs)
  cliffRun(scene, model, rockMaterial({ repeat: [2, 3], normal: 1.3, tint: 0x3a4a22 }), 12, 3.0, 200 + model.world);
  valleyMountains(scene, cx, cz, 700 + model.world);

  // stone arches — a grand gateway flanking the gate, plus standalone ruins
  const postMat = matStd(0x2a3a16, { roughness: 0.8, metalness: 0.2 });
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const arch = (x, z, w, h) => {
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.85), postMat); p.position.set(x + s * w / 2, h / 2, z); scene.add(p); });
    const lint = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.95, 0.95), postMat); lint.position.set(x, h - 0.1, z); scene.add(lint);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.32, 0.55), accMat); cap.position.set(x, h + 0.35, z); scene.add(cap);
  };
  arch(0, -99, 16, 9);               // grand gateway at the golem grounds entrance
  arch(-38, -34, 7, 6);
  arch(40, -56, 7, 6);
  arch(-18, -82, 6, 5.4);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  lightScene(scene, model.bounds, { ceil: false, dust: acc, glowSize: 5.0, glowOpacity: 0.78, sky: 0x3a5a1e, skyI: 0.95 });
  return api;
}

function buildCanyon(scene, model, theme) {
  const acc = theme.accent;
  const b = model.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  scene.background = new THREE.Color(0x24130a);
  scene.fog = new THREE.FogExp2(0x2c1808, 0.016);
  skyDome(scene, 0x140a04, 0x5a3416, cx, cz, 190);
  scene.add(new THREE.HemisphereLight(0x6a4420, 0x140a04, 0.6));
  scene.add(new THREE.AmbientLight(0x2e1c0c, theme.ambient * 0.7));

  const fw = (b.maxX - b.minX) + 120, fd = (b.maxZ - b.minZ) + 120;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 1.0, metalness: 0.03 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  buildPathTrail(scene, model.path, acc, true);

  // sandstone mesa walls (reuse the cave-rock texture set for canyon stone)
  const mesaMat = rockMaterial({ repeat: [3, 2], normal: 1.3, tint: 0xb0884e });
  cliffRun(scene, model, mesaMat, 13, 3.2, 300 + model.world);

  // rock spires perched on the mesa tops for a jagged skyline
  const rng = mulberry32(77 + model.world);
  model.colliders.forEach((wl, i) => {
    if (i % 2 !== 0) return;
    const mx = (wl.minX + wl.maxX) / 2, mz = (wl.minZ + wl.maxZ) / 2;
    const h = 3 + rng() * 4;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1 + rng() * 0.6, h, 6), mesaMat);
    spire.position.set(mx + (rng() - 0.5) * 1.5, 12 + h / 2, mz + (rng() - 0.5) * 1.5);
    spire.rotation.y = rng() * Math.PI;
    scene.add(spire);
  });

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  lightScene(scene, model.bounds, { ceil: false, dust: acc, glowSize: 5.2, glowOpacity: 0.8, sky: 0x8a5a28, skyI: 1.0 });
  return api;
}

// ============================================================
// REALISM TOOLKIT — materials, weathering, micro-detail (THREE r128)
// Breaks the "made of primitives" look: vertex-roughened geometry, natural rock
// stand-ins for the boxy props. Deterministic (seeded). Visual-only;
// never affects collision. Not run headless (WebGL path).
// ============================================================

// jitter every vertex of a geometry + recompute normals -> organic, craggy
function roughen(geo, amt, seed) {
  const p = geo.attributes.position;
  const S = (seed >>> 0) || 1;
  // Hash the vertex POSITION (not its index): primitives are non-indexed, so a
  // shared corner appears once per touching face. Offsetting by position means
  // those duplicates get the SAME offset and the surface stays welded (lumpy
  // rock) instead of tearing into disconnected shards.
  const off = (a, b, c, salt) => {
    let n = (S ^ salt) >>> 0;
    n = Math.imul(n ^ (Math.round(a * 16) | 0), 2654435761) >>> 0;
    n = Math.imul(n ^ (Math.round(b * 16) | 0), 2246822519) >>> 0;
    n = Math.imul(n ^ (Math.round(c * 16) | 0), 3266489917) >>> 0;
    n ^= n >>> 13; n = Math.imul(n, 3266489917) >>> 0; n ^= n >>> 16;
    return (n / 4294967295 - 0.5) * amt;
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + off(x, y, z, 1), y + off(x, y, z, 2), z + off(x, y, z, 3));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}


// natural rock the enemies stand on, replacing the clean cylinder plinth
function plinthRock(scene, x, z, sc) {
  const mat = rockMaterial({ repeat: [2, 2], normal: 1.2, tint: 0x6a6256 });
  const g = roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.4 * sc, ((x * 7 + z * 13) >>> 0) || 5);
  const m = new THREE.Mesh(g, mat);
  m.scale.y = 0.42; m.position.set(x, 0.3, z); m.rotation.y = x + z;
  m.receiveShadow = true; m.castShadow = true;
  scene.add(m);
  return m;
}

// a weathered rock cairn cradling a glowing rune-crystal, replacing the
// box pedestal + flat slab. Returns { bookMat } so the progress-dim still works.
function fieldNoteProp(scene, x, z, accentHex) {
  const rockMat = rockMaterial({ repeat: [1.6, 1.6], normal: 1.15, tint: 0x5c5346 });
  const seed = ((x * 5 + z * 9) >>> 0) || 7;
  const base = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(0.8, 1), 0.13, seed), rockMat);
  base.scale.set(1.05, 0.68, 1.05); base.position.set(x, 0.42, z); base.rotation.y = x * 0.7;
  base.castShadow = base.receiveShadow = true; scene.add(base);
  const shoulder = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(0.5, 1), 0.1, seed + 17), rockMat);
  shoulder.scale.set(1, 0.7, 1); shoulder.position.set(x + 0.45, 0.3, z - 0.2); shoulder.castShadow = true; scene.add(shoulder);

  // glowing rune-crystal: faceted icosahedron + emissive so it reads as a gem from any angle
  const bookMat = new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.15 });
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), bookMat);
  crystal.position.set(x, 1.18, z); crystal.rotation.set(0.3, x, 0.15); crystal.scale.set(0.85, 1.4, 0.85);
  crystal.castShadow = true; scene.add(crystal);
  const halo = new THREE.PointLight(accentHex, 0.6, 6.5, 2.0);
  halo.position.set(x, 1.45, z); scene.add(halo);
  return { bookMat, crystal };
}

function spawnShatter(scene, x, y, z, colorHex) {
  if (!scene || typeof THREE === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  const grp = new THREE.Group(); grp.position.set(x, y, z); scene.add(grp);
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const s = 0.18 + Math.random() * 0.34;
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(s), new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.55, roughness: 0.55, metalness: 0.35, transparent: true }));
    const a = Math.random() * Math.PI * 2;
    m.userData.v = { x: Math.cos(a) * (2 + Math.random() * 3.5), y: 2.4 + Math.random() * 3.2, z: Math.sin(a) * (2 + Math.random() * 3.5) };
    m.userData.spin = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 };
    grp.add(m); parts.push(m);
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7CE7A2 : 0xFFD27A, transparent: true }));
    const a = Math.random() * Math.PI * 2;
    m.userData.v = { x: Math.cos(a) * 1.6, y: 3 + Math.random() * 2.2, z: Math.sin(a) * 1.6 }; m.userData.orb = true;
    grp.add(m); parts.push(m);
  }
  const light = new THREE.PointLight(colorHex, 3.2, 16, 2); grp.add(light);
  let life = 0; const dur = 1.25;
  const step = () => {
    const d = 0.016; life += d; const k = Math.min(1, life / dur);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], v = p.userData.v;
      p.position.x += v.x * d; p.position.y += v.y * d; p.position.z += v.z * d;
      v.y -= (p.userData.orb ? 3.5 : 9) * d;
      if (p.userData.spin) { p.rotation.x += p.userData.spin.x * d; p.rotation.y += p.userData.spin.y * d; }
      if (p.material) p.material.opacity = 1 - k;
    }
    light.intensity = 3.2 * (1 - k);
    if (life < dur) requestAnimationFrame(step);
    else { scene.remove(grp); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  };
  requestAnimationFrame(step);
}

function makeViewModel(weaponId) {
  const g = new THREE.Group();
  const T = ({
    w_iron:   { shaft: 0x9aa0a8, glow: 0x223040, gi: 0.0,  len: 0.60, prongs: 0, hook: false },
    w_copper: { shaft: 0xc8823c, glow: 0xffae5c, gi: 0.20, len: 0.64, prongs: 0, hook: false },
    w_lance:  { shaft: 0xc2cad6, glow: 0x9ee6ff, gi: 0.24, len: 0.72, prongs: 0, hook: true  },
    w_kelvin: { shaft: 0xe6eff6, glow: 0x7defff, gi: 0.55, len: 0.78, prongs: 4, hook: false },
  })[weaponId] || { shaft: 0x9aa0a8, glow: 0x223040, gi: 0.0, len: 0.60, prongs: 0, hook: false };
  const metal = matStd(T.shaft, { roughness: 0.3, metalness: 0.86, emissive: T.glow, emissiveIntensity: T.gi });
  const grip = matStd(0x14181f, { roughness: 0.72, metalness: 0.5 });
  const tipMat = matStd(T.shaft, { roughness: 0.18, metalness: 0.92, emissive: T.glow, emissiveIntensity: Math.max(0.3, T.gi) });
  const mk = (geo, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); m.castShadow = false; g.add(m); return m; };
  const tipZ = 0.05 - T.len;
  mk(new THREE.CylinderGeometry(0.05, 0.058, 0.26, 8), grip, 0, 0, 0.18, Math.PI / 2, 0);          // grip (near camera)
  mk(new THREE.CylinderGeometry(0.022, 0.032, T.len, 7), metal, 0, 0, 0.05 - T.len / 2, Math.PI / 2, 0); // shaft
  if (T.prongs > 0) {
    for (let i = 0; i < T.prongs; i++) { const a = i / T.prongs * Math.PI * 2; mk(new THREE.ConeGeometry(0.012, 0.16, 5), tipMat, Math.cos(a) * 0.034, Math.sin(a) * 0.034, tipZ - 0.05, -Math.PI / 2, 0); }
    const o = new THREE.PointLight(T.glow, 0.7, 2.4, 2); o.position.set(0, 0, tipZ - 0.08); g.add(o);
  } else {
    mk(new THREE.ConeGeometry(0.032, 0.17, 6), tipMat, 0, 0, tipZ - 0.04, -Math.PI / 2, 0);          // tip
  }
  if (T.hook) mk(new THREE.TorusGeometry(0.05, 0.012, 6, 10), metal, 0, 0.052, tipZ + 0.16, 0, 0);    // salvage hook (lance)
  g.position.set(0.34, -0.30, -0.42);
  g.rotation.set(0.26, 0.5, 0.12);
  g.userData = { weaponId, bx: 0.34, by: -0.30, bz: -0.42, rx: 0.26, rz: 0.12 };
  return g;
}

function updateViewModel(vm, now, moving, jabT) {
  const u = vm.userData; if (!u) return;
  const jk = Math.max(0, 1 - (now - jabT) / 240);
  const bobk = moving ? 1 : 0.35;
  vm.position.x = u.bx + Math.sin(now / 540) * 0.010 * bobk;
  vm.position.y = u.by + Math.sin(now / 300) * 0.013 * bobk - jk * 0.05;
  vm.position.z = u.bz - jk * 0.22;
  vm.rotation.x = u.rx - jk * 0.6;
  vm.rotation.z = u.rz + Math.sin(now / 820) * 0.02 * bobk;
}

// ============================================================
// BIT MINES MODEL (pure, testable)
// ============================================================

const MINE_CELL = 2;

function mineWalkRects() {
  return [
    { x1: -10, z1: 58, x2: 10, z2: 74, zone: 'ENTRANCE GALLERY' },
    { x1: -4, z1: -52, x2: 4, z2: 60, zone: 'MAIN SHAFT' },
    // west galleries (b1, b3, b5) + spurs
    { x1: -34, z1: 38, x2: -18, z2: 52, zone: 'WEST GALLERIES' },
    { x1: -18, z1: 43, x2: -4, z2: 48, zone: 'WEST GALLERIES' },
    { x1: -34, z1: 6, x2: -18, z2: 20, zone: 'WEST GALLERIES' },
    { x1: -18, z1: 11, x2: -4, z2: 16, zone: 'WEST GALLERIES' },
    { x1: -34, z1: -28, x2: -18, z2: -14, zone: 'WEST GALLERIES' },
    { x1: -18, z1: -23, x2: -4, z2: -18, zone: 'WEST GALLERIES' },
    // east galleries (b2, b4) + spurs
    { x1: 18, z1: 30, x2: 34, z2: 44, zone: 'EAST GALLERIES' },
    { x1: 4, z1: 35, x2: 18, z2: 40, zone: 'EAST GALLERIES' },
    { x1: 18, z1: -4, x2: 34, z2: 10, zone: 'EAST GALLERIES' },
    { x1: 4, z1: 1, x2: 18, z2: 6, zone: 'EAST GALLERIES' },
    // gate corridor + boss arena
    { x1: -4, z1: -62, x2: 4, z2: -52, zone: 'THE DEEP GATE' },
    { x1: -26, z1: -108, x2: 26, z2: -62, zone: 'WYRM HOLLOW' },
  ];
}

function mineWalls(rects) {
  // rasterize to cells, emit run-merged wall boxes on walkable/non-walkable edges
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  rects.forEach(r => { minX = Math.min(minX, r.x1); maxX = Math.max(maxX, r.x2); minZ = Math.min(minZ, r.z1); maxZ = Math.max(maxZ, r.z2); });
  const cs = MINE_CELL;
  const nx = Math.round((maxX - minX) / cs), nz = Math.round((maxZ - minZ) / cs);
  const walk = (ix, iz) => {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
    const cx = minX + (ix + 0.5) * cs, cz = minZ + (iz + 0.5) * cs;
    return rects.some(r => cx > r.x1 && cx < r.x2 && cz > r.z1 && cz < r.z2);
  };
  const T = 1.4, H = [];
  // horizontal walls (along x) at z-lines: key by (iz-line, side) -> runs over ix
  for (let iz = 0; iz <= nz; iz++) {
    let runStart = -1;
    for (let ix = 0; ix <= nx; ix++) {
      const edge = ix < nx && (walk(ix, iz - 1) !== walk(ix, iz));
      if (edge && runStart < 0) runStart = ix;
      if (!edge && runStart >= 0) {
        const x1 = minX + runStart * cs, x2 = minX + ix * cs, zl = minZ + iz * cs;
        H.push(mkBox((x1 + x2) / 2, zl, x2 - x1 + T, T, 'wall'));
        runStart = -1;
      }
    }
  }
  for (let ix = 0; ix <= nx; ix++) {
    let runStart = -1;
    for (let iz = 0; iz <= nz; iz++) {
      const edge = iz < nz && (walk(ix - 1, iz) !== walk(ix, iz));
      if (edge && runStart < 0) runStart = iz;
      if (!edge && runStart >= 0) {
        const z1 = minZ + runStart * cs, z2 = minZ + iz * cs, xl = minX + ix * cs;
        H.push(mkBox(xl, (z1 + z2) / 2, T, z2 - z1 + T, 'wall'));
        runStart = -1;
      }
    }
  }
  return { walls: H, bounds: { minX, maxX, minZ, maxZ } };
}

const MINE_FIGHTS = [
  { id: 'b1', x: -26, z: 45 }, { id: 'b2', x: 26, z: 37 },
  { id: 'b3', x: -26, z: 13 }, { id: 'b4', x: 26, z: 3 },
  { id: 'b5', x: -26, z: -21 }, { id: 'b6', x: 0, z: -84, boss: true },
];
const MINE_BOOK_SPOTS = [
  { x: 2.5, z: 54 }, { x: -30, z: 49 }, { x: 30, z: 7 },
  { x: -2.5, z: -34 }, { x: 22, z: 33 }, { x: -30, z: -25 },
];

function mineModel(lessonIds) {
  const lids = lessonIds || [];
  const rects = mineWalkRects();
  const { walls, bounds } = mineWalls(rects);
  const gateCollider = mkBox(0, -57, 8.6, 1.8, 'gate');
  const interactables = [];
  // learning order: each field note followed by the drills that use it
  const seqM = stationSequence(MINE_FIGHTS.filter(f => !f.boss).map(f => ({ id: f.id })), lids);
  const ordOf = {}; seqM.forEach((s, i) => { ordOf[s.kind === 'book' ? 'book_' + s.lid : s.f.id] = i + 1; });
  MINE_FIGHTS.forEach(f => {
    interactables.push({ id: f.id, kind: 'fight', boss: !!f.boss, ord: f.boss ? seqM.length + 1 : ordOf[f.id], x: f.x, z: f.z, r: 3.4, target: { name: 'gauntlet', id: f.id } });
  });
  const bs = MINE_BOOK_SPOTS.slice().sort((a, b) => b.z - a.z);
  lids.forEach((lid, i) => {
    const s = bs[i % bs.length];
    interactables.push({ id: 'book_' + lid, kind: 'book', lid, ord: ordOf['book_' + lid], x: s.x, z: s.z, r: 2.4, target: { name: 'note', id: lid } });
  });
  interactables.push({ id: 'lift', kind: 'exit', x: 0, z: 71, r: 2.6, target: { name: 'surface' } });
  const lanterns = [
    { x: 0, z: 64 }, { x: 3.4, z: 44 }, { x: -3.4, z: 24 }, { x: 3.4, z: 8 },
    { x: -3.4, z: -10 }, { x: 0, z: -40 }, { x: -26, z: 45 }, { x: 26, z: 37 },
  ];
  const beams = [50, 30, 12, -6, -28, -46].map(z => ({ x: 0, z }));
  return {
    rects, colliders: walls, gateCollider,
    collidersClosed: walls.concat([gateCollider]),
    interactables, lanterns, beams, bounds,
    spawn: { x: 0, z: 68, yaw: 0 },
    gateZ: -57,
    path: [{ x: 0, z: 64 }, { x: 0, z: 40 }, { x: 0, z: 10 }, { x: 0, z: -20 }, { x: 0, z: -46 }, { x: 0, z: -57 }, { x: 0, z: -80 }],
  };
}

function mineGateOpen(save) {
  const d = activeDone(save);
  return ['b1', 'b2', 'b3', 'b4', 'b5'].every(id => !!d[id]);
}

function mineZoneAt(rects, x, z) {
  const r = rects.find(r => x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2);
  return r ? r.zone : null;
}

// ============================================================
// BIT MINES SCREEN — renderer + walkable world
// ============================================================

function mineLabelSprite(text, color, scale) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = '600 34px "Segoe UI", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  cv.width = w; cv.height = 64;
  const c2 = cv.getContext('2d');
  c2.fillStyle = 'rgba(8,12,18,0.78)';
  c2.fillRect(0, 0, w, 64);
  c2.strokeStyle = color; c2.globalAlpha = 0.6; c2.strokeRect(1, 1, w - 2, 62); c2.globalAlpha = 1;
  c2.font = '600 34px "Segoe UI", sans-serif';
  c2.fillStyle = color; c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const s = scale || 1;
  sp.scale.set((w / 64) * 1.6 * s, 1.6 * s, 1);
  return sp;
}

function buildMineWorld(scene, model) {
  scene.background = new THREE.Color(0x0a0604);
  scene.fog = new THREE.FogExp2(0x0a0604, 0.045);
  scene.add(new THREE.AmbientLight(0x3a2c1a, 0.62));
  const hemi = new THREE.HemisphereLight(0x32281a, 0x0a0604, 0.4);
  scene.add(hemi);

  const pad = 8;
  const b = model.bounds;
  const floorMat = rockMaterial({ repeat: [11, 11], normal: 1.0, tint: 0x8a7858, disp: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2, 100, 100), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  scene.add(floor);
  buildPathTrail(scene, model.path, 0xf5b14c);
  const zSplit = -62;
  const ceilMat = rockMaterial({ repeat: [9, 9], normal: 1.2, tint: 0x554636 });
  const mkCeil = (z1, z2, y, amp, segs) => {
    const w = b.maxX - b.minX + pad * 2, cxx = (b.minX + b.maxX) / 2, czz = (z1 + z2) / 2;
    const cg = new THREE.PlaneGeometry(w, z2 - z1, segs, segs);
    cg.rotateX(Math.PI / 2); cg.translate(cxx, y, czz);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i); let dy = rockNoise(x + 7, 3, z + 7) * amp - amp * 0.4; dy = Math.max(-amp * 1.6, Math.min(amp * 0.7, dy)); cp.setY(i, cp.getY(i) + dy); }
    cp.needsUpdate = true; cg.computeVertexNormals();
    const m = new THREE.Mesh(cg, ceilMat); m.material.side = THREE.DoubleSide; scene.add(m);
  };
  mkCeil(zSplit, b.maxZ + pad, 5.4, 1.05, 70);   // low ceiling: shaft + galleries
  mkCeil(b.minZ - pad, zSplit, 16.5, 2.4, 48);   // tall vault over the wyrm hollow

  const wallSmall = rockMaterial({ repeat: [1.6, 1.4], normal: 1.45 });
  const wallMed = rockMaterial({ repeat: [4, 1.6], normal: 1.45 });
  const wallLong = rockMaterial({ repeat: [10, 1.8], normal: 1.45 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ, L = Math.max(sx, sz);
    const mat = L > 40 ? wallLong : (L > 14 ? wallMed : wallSmall);
    const cx = (wl.minX + wl.maxX) / 2, cz = (wl.minZ + wl.maxZ) / 2;
    const H = cz < zSplit + 1 ? 16.5 : 5.4;       // wyrm-hollow walls rise into a tall cavern
    const m = rockWall(sx, H, sz, mat, cx, cz);
    m.position.set(cx, H / 2, cz);
    scene.add(m);
  });
  // lintel sealing the gap above the gate opening (low shaft -> tall arena)
  const lintel = rockWall(10, 12, 1.6, wallSmall, 0, zSplit);
  lintel.position.set(0, 10.4, zSplit);
  scene.add(lintel);

  // ore veins (seeded)
  const rng = mulberry32(1337);
  const cyan = new THREE.MeshBasicMaterial({ color: 0x7defff });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffc76b });
  for (let i = 0; i < 26; i++) {
    const wl = model.colliders[Math.floor(rng() * model.colliders.length)];
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const v = new THREE.Mesh(new THREE.BoxGeometry(Math.min(sx, 0.7) + 0.5, 0.5 + rng() * 0.7, Math.min(sz, 0.7) + 0.5), rng() < 0.6 ? cyan : amber);
    v.position.set(wl.minX + rng() * sx, 0.7 + rng() * 2.6, wl.minZ + rng() * sz);
    v.rotation.y = rng() * Math.PI;
    scene.add(v);
  }

  // support beams across the shaft
  const wood = matStd(0x4a3520, { roughness: 0.95 });
  model.beams.forEach(bm => {
    [-3.7, 3.7].forEach(x => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 4.9, 0.36), wood);
      post.position.set(bm.x + x, 2.45, bm.z);
      scene.add(post);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.34, 0.4), wood);
    bar.position.set(bm.x, 4.75, bm.z);
    scene.add(bar);
  });

  // lanterns
  model.lanterns.forEach(L => {
    const pt = new THREE.PointLight(0xffb066, 1.05, 17, 1.6);
    pt.position.set(L.x, 3.6, L.z);
    scene.add(pt);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.32), new THREE.MeshBasicMaterial({ color: 0xffc98a }));
    bulb.position.set(L.x, 3.6, L.z);
    scene.add(bulb);
  });

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };

  // enemy totems
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
    const g = GAUNTLETS.find(x => x.id === it.id);
    const sc = it.boss ? 1.7 : 1;
    plinthRock(scene, it.x, it.z, sc);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6b62 });
    const creature = makeCreature(creatureSpec(1, en.name, it.boss), beaconMat);
    creature.position.set(it.x, 0.5, it.z);
    scene.add(creature);
    const fl = new THREE.PointLight(it.boss ? 0xfacc15 : 0xff6b62, it.boss ? 0.9 : 0.6, 15, 2.0);
    fl.position.set(it.x, 3.2 * sc, it.z);
    scene.add(fl);
    scene.add(fxCone(it.boss ? 0xfacc15 : 0xff6b62, it.boss ? 3.2 : 2.0, 5.1, it.boss ? 0.1 : 0.06, it.x, it.z));
    const nl = mineLabelSprite((it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name, it.boss ? '#FFE27A' : '#FF8B82', it.boss ? 0.44 : 0.34);
    nl.position.set(it.x, it.boss ? 9.5 : 2.9 * sc + 0.5, it.z);
    scene.add(nl);
    api.totems[it.id] = { beaconMat, creature };
    api.creatures.push({ grp: creature, it });
  });

  // field-note books
  model.interactables.filter(i => i.kind === 'book').forEach(it => {
    const { bookMat } = fieldNoteProp(scene, it.x, it.z, 0x7defff);
    const lbl = mineLabelSprite((it.ord ? '#' + it.ord + ' · ' : '') + 'FIELD NOTE', '#7DEFFF', 0.62);
    lbl.position.set(it.x, 2.5, it.z);
    scene.add(lbl);
    scene.add(fxCone(0x7defff, 1.6, 5.1, 0.055, it.x, it.z));
    api.books[it.lid] = { bookMat };
  });

  // boss gate bars
  const gate = new THREE.Group();
  const barMat = matStd(0x3a4a63, { roughness: 0.4, metalness: 0.8 });
  for (let x = -3.2; x <= 3.2; x += 1.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 0.3), barMat);
    bar.position.set(x, 2.6, model.gateZ);
    gate.add(bar);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 0.42), barMat);
  cross.position.set(0, 4.7, model.gateZ);
  gate.add(cross);
  scene.add(gate);
  api.gateGrp = gate;
  const gl = mineLabelSprite('THE DEEP GATE', '#FF8B82', 0.85);
  gl.position.set(0, 6.1, model.gateZ + 0.2);
  scene.add(gl);

  // surface lift
  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 4.6), new THREE.MeshBasicMaterial({ color: 0x155e6b }));
  padM.position.set(lift.x, 0.09, lift.z);
  scene.add(padM);
  const ll = mineLabelSprite('SURFACE LIFT', '#7DEFFF', 0.8);
  ll.position.set(lift.x, 3.1, lift.z);
  scene.add(ll);
  api.nextGrp = makeNextBeacon(scene, 0xf5b14c, false);

  caveDressing(scene, model);
  lightScene(scene, model.bounds, { ceil: true, dust: 0x6a5030, glowSize: 4.8, glowOpacity: 0.8 });

  return api;
}

function applyMineProgress(api, model, save) {
  const d = activeDone(save);
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const t = api.totems[it.id];
    if (!t) return;
    t.beaconMat.color.setHex(d[it.id] ? 0x2ea56a : it.boss ? 0xfacc15 : 0xff6b62);
    if (t.creature) t.creature.userData.dead = !!d[it.id];
  });
  const lr = save.lessons || {};
  Object.keys(api.books).forEach(lid => {
    api.books[lid].bookMat.color.setHex(lr[lid] ? 0x3a5a66 : 0x7defff);
  });
  if (api.gateGrp) api.gateGrp.visible = !mineGateOpen(save);
  if (api.nextGrp) {
    const nx = nextStationOf(model, save);
    if (nx) { api.nextGrp.visible = true; api.nextGrp.position.set(nx.x, 0, nx.z); }
    else api.nextGrp.visible = false;
  }
}

function MineScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('heavy_press'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState('ENTRANCE GALLERY');
  const [showHelp, setShowHelp] = useState(false);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefM = useRef(save); saveRefM.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const lessonIds = (LESSONS[1] || []).map(l => l.id);

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'mine' || sc.name === 'world') { setOverlay(null); return; }
    setOverlay(sc);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = mineModel(lessonIds);
      const api = buildMineWorld(scene, model);

      // headlamp
      const lamp = new THREE.SpotLight(0xffe7c0, 2.3, 44, 0.52, 0.5, 1.3);
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 48; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      ambRef.current = createAmbience(scene, 'mine');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.03 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'ENTRANCE GALLERY', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !mineGateOpen(saveRefM.current)) return 'SEALED — clear the five outer galleries';
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyM') { try { musicCycleTrack(1); } catch (e) { } }
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyMineProgress(api, model, saveRefM.current);
      let last = performance.now();
      let _aim = null, _flash = null, _hp = null, _hpTex = null, _lastBar = -1, _prevE = null, _prevP = null, _punchT = -9e9, _flashT = -9e9, _shakeT = -9e9, _vigT = -9e9, _prevOver = null, _prevPhase = 1;
      const drawHpBar = (tex, frac, tele) => {
        const cv = tex.userData.cv, x = cv.getContext('2d'); x.clearRect(0, 0, 256, 64);
        x.fillStyle = 'rgba(8,10,14,0.82)'; x.fillRect(8, 22, 240, 20);
        x.fillStyle = '#FF5252'; x.fillRect(10, 24, 236 * frac, 16);
        if (tele > 0.02) { x.fillStyle = 'rgba(255,205,80,' + (0.35 + 0.5 * tele) + ')'; x.fillRect(10, 45, 236 * Math.min(1, tele), 6); }
        x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.strokeRect(8, 22, 240, 20);
        tex.needsUpdate = true;
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 11.5 : 7.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = mineGateOpen(saveRefM.current) ? model.colliders : model.collidersClosed;
          const res = resolveCollisions(nx, nz, 0.55, cols);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id + '|' + (lockedTest(it) || '') : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else {
              const lock = lockedTest(it);
              let text;
              if (lock) text = lock;
              else if (it.kind === 'fight') {
                const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
                const g = GAUNTLETS.find(x => x.id === it.id);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (g ? ' · ' + g.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefM.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = (LESSONS[1] || []).find(l => l.id === it.lid);
                text = (isTouch ? '⏎ ' : '[E] ') + 'READ — ' + (it.ord ? '#' + it.ord + ' · ' : '') + (L ? L.title : 'field note');
              } else text = (isTouch ? '⏎ ' : '[E] ') + 'MENU — back to the main menu';
              setPrompt({ text, locked: !!lock });
            }
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        if (frame % 30 === 0) applyMineProgress(api, model, saveRefM.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        camera.position.set(player.x, 1.7, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _tot = _ov && _ov.name === 'gauntlet' && api && api.totems ? api.totems[_ov.id] : null;
        if (_tot && _tot.creature) {
          const _cr = _tot.creature;
          if (!_aim) _aim = new THREE.PerspectiveCamera();
          if (!_flash) { _flash = new THREE.PointLight(0xfff1c0, 0, 20, 2.0); scene.add(_flash); }
          if (!_hp) {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
            _hpTex = new THREE.CanvasTexture(cv); _hpTex.userData = { cv };
            _hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _hpTex, transparent: true, depthTest: false }));
            _hp.scale.set(7, 1.75, 1); scene.add(_hp);
          }
          _aim.position.copy(camera.position); _aim.lookAt(_cr.position.x, _cr.position.y + 2.6, _cr.position.z);
          camera.quaternion.slerp(_aim.quaternion, Math.min(1, dt * 5));
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_tot.creature.userData && _tot.creature.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0xFFB066); AudioFX.win(); }
            _prevE = _cfx.ehp; _prevP = _cfx.php; _prevOver = _cfx.over;
          }
          const pk = Math.max(0, 1 - (now - _punchT) / 220);
          camera.fov = 74 - 7 * pk; camera.updateProjectionMatrix();
          _flash.position.set(_cr.position.x, _cr.position.y + 2.2, _cr.position.z);
          _flash.intensity = 2.8 * Math.max(0, 1 - (now - _flashT) / 170);
          const sk = Math.max(0, 1 - (now - _shakeT) / 320);
          if (sk > 0) { camera.position.x += (Math.random() - 0.5) * 0.55 * sk; camera.position.y += (Math.random() - 0.5) * 0.45 * sk; }
          if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.7 * Math.max(0, 1 - (now - _vigT) / 380));
        } else {
          camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
          if (_hp) _hp.visible = false;
          if (_flash) _flash.intensity = 0;
          if (camera.fov !== 74) { camera.fov = 74; camera.updateProjectionMatrix(); }
          if (vignetteRef.current && vignetteRef.current.style.opacity !== '0') vignetteRef.current.style.opacity = '0';
        }
        lamp.position.set(player.x, 1.78, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefM.current.gear && saveRefM.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) {
        try { renderer.dispose(); } catch (e) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        try { renderer.domElement && renderer.domElement.remove(); } catch (e) { }
      }
    };
  }, []); // eslint-disable-line

  // ---------- overlay router ----------
  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, 1, 30, overlay.id === 'b6', 'engineer', false);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = (LESSONS[1] || []).find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 8 }}>recovered field note · the bit mines</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>{L.title}</h2>
            <div className="lessonbody" style={{ fontSize: 13.5, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
            {L.code && <pre className="codeblock" style={{ marginTop: 12 }}>{L.code}</pre>}
            {LESSON_DEPTH[L.id] && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1B2433' }}>
                <div className="eyebrow" style={{ marginBottom: 7, color: '#6FB7C9' }}>going deeper</div>
                <div style={{ fontSize: 13, color: '#A7B6C8' }}><Paragraphs text={LESSON_DEPTH[L.id]} /></div>
              </div>
            )}
            <button className="btn primary sm" style={{ marginTop: 14 }}
              onClick={() => { AudioFX.good(); if (!read) cb.onLessonRead(overlay.id); }}>
              {read ? 'logged ✓' : 'log it to the manual'}
            </button>
          </div>
        </div>
      ) : <div style={{ marginTop: 20, color: '#76849A' }}>The pages have rotted away.</div>;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'gauntlet' ? 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)' : 'rgba(3,5,9,0.93)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: overlay.name === 'note' ? '#9FB2C9' : '#FF8B82', letterSpacing: '0.14em' }}>{overlay.name === 'note' ? '✦ ' : '⚔ '}{label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#FFC76B', fontVariantNumeric: 'tabular-nums' }}><Coins size={13} /> {save.scrap || 0}</span>
            {overlay.name !== 'note' && <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(v => !v); }}><BookOpen size={12} /> field notes</button>}
            <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(false); setOverlay(null); }}>
              {overlay.name === 'note' ? 'close' : 'flee'} <X size={12} />
            </button>
          </div>
          {body}
        </div>
        {notesOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,5,9,0.97)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — THE BIT MINES</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[1] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the mine to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    const model = mineModel(lessonIds);
    const gateOpen = mineGateOpen(save);
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the mine in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.kind === 'fight').map(it => {
              const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
              const g = GAUNTLETS.find(x => x.id === it.id);
              const sealed = it.boss && !gateOpen;
              const done = !!activeDone(save)[it.id];
              return (
                <button key={it.id} className="card" disabled={sealed}
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                  onClick={() => openOverlay({ ...it.target })}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>
                    {en.name}{done ? ' ✓' : ''}
                  </span>
                  <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the outer galleries' : (g ? g.title : it.id)}</div>
                </button>
              );
            })}
            {(LESSONS[1] || []).map(L => (
              <button key={L.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => openOverlay({ name: 'note', id: L.id })}>
                <span style={{ fontSize: 13, color: '#7DEFFF' }}>FIELD NOTE — {L.title}{save.lessons && save.lessons[L.id] ? ' ✓' : ''}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#04050A' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FFC76B" />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FFC76B', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FFB066' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A2014', borderRadius: 8, background: 'rgba(10,8,4,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FFC76B' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,8,4,0.88)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#7A6310'), color: prompt.locked ? '#FF8B82' : '#FFC76B', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FFC76B', marginBottom: 8 }}>shaft access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. The wyrm sleeps at the bottom of the shaft — clear the five galleries to unseal its gate.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
    </div>
  );
}

// ============================================================
// ARCADE HUB MODEL (pure, testable) — reuses mineWalls()
// ============================================================

function arcadeModel() {
  const rects = [
    { x1: -22, z1: -22, x2: 22, z2: 26, zone: 'THE ARCADE' },
    { x1: -4, z1: 26, x2: 4, z2: 32, zone: 'ARCADE LANDING' },
  ];
  const { walls, bounds } = mineWalls(rects);
  const cabs = [
    { id: 'a_training', x: -14, z: -18, target: { name: 'training' }, label: 'TRAINING GROUNDS', accent: '#7DEFFF' },
    { id: 'a_blitz', x: 0, z: -18, target: { name: 'blitz' }, label: 'BINARY BLITZ', accent: '#FF7DF0' },
    { id: 'a_bugs', x: 14, z: -18, target: { name: 'bugs' }, label: 'BUG BOUNTY', accent: '#FFC76B' },
    { id: 'a_ach', x: -18, z: -2, target: { name: 'ach' }, label: 'SERVICE RECORD', accent: '#A3E635' },
    { id: 'a_saves', x: -18, z: 10, target: { name: 'profiles' }, label: 'SAVE TERMINAL', accent: '#7DEFFF' },
    { id: 'a_manual', x: 18, z: -2, target: { name: 'manual' }, label: 'FIELD MANUAL', accent: '#9FB4FF' },
    { id: 'a_shop', x: 18, z: 10, target: { name: 'shop' }, label: 'SCRAP EXCHANGE', accent: '#FFE27A' },
  ];
  const interactables = cabs.map(c => ({ ...c, kind: 'arcade', r: 3.0 }));
  interactables.push({ id: 'lift', kind: 'exit', x: 0, z: 29, r: 2.6, target: { name: 'menu' }, label: 'MAIN MENU', accent: '#FF8B82' });
  return { rects, colliders: walls, interactables, bounds, spawn: { x: 0, z: 20, yaw: 0 } };
}

// ============================================================
// MAIN MENU + ARCADE SCREEN
// ============================================================

function MainMenu({ save, go, onSettings, onNewGame }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const [confirmNew, setConfirmNew] = useState(false);
  const mapNodes = useMemo(() => { const P = [[180, 820], [430, 720], [250, 540], [560, 470], [360, 300], [680, 250], [520, 110]]; return WORLDS.map((w, i) => ({ id: w.id, color: w.color, name: w.name, x: P[i][0], y: P[i][1] })); }, []);
  const tracePath = useMemo(() => mapNodes.map((n, i) => (i ? 'L' : 'M') + n.x + ',' + n.y).join(' '), [mapNodes]);
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53 + 7) % 100,
    delay: ((i * 0.37) % 4).toFixed(2),
    dur: (3.4 + (i % 5) * 0.6).toFixed(2),
    ch: (i * 7) % 3 === 0 ? '1' : '0',
    size: 11 + (i % 3) * 3,
  })), []);
  const ri = rankIndex(save.xp);
  return (
    <div className="mm-root">
      <style>{`
        .mm-root{position:fixed;inset:0;z-index:30;overflow:hidden;background:radial-gradient(120% 90% at 50% -10%,#0c1430 0%,#070912 55%,#04060c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
        .mm-grid{position:absolute;left:-30%;right:-30%;bottom:-12%;height:58%;background-image:linear-gradient(rgba(34,211,238,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.15) 1px,transparent 1px);background-size:46px 46px;transform:perspective(420px) rotateX(62deg);transform-origin:50% 100%;animation:mm-pan 7s linear infinite;-webkit-mask-image:linear-gradient(to top,#000 8%,transparent 78%);mask-image:linear-gradient(to top,#000 8%,transparent 78%)}
        @keyframes mm-pan{from{background-position:0 0}to{background-position:0 46px}}
        .mm-bit{position:absolute;top:-8%;color:rgba(125,239,255,.28);font-family:ui-monospace,monospace;animation:mm-fall linear infinite;pointer-events:none}
        @keyframes mm-fall{to{transform:translateY(116vh)}}
        .mm-map{position:absolute;inset:0;width:100%;height:100%;z-index:1;opacity:.55;pointer-events:none}
        .mm-trace{stroke-dasharray:9 13;animation:mm-flow 4s linear infinite}
        @keyframes mm-flow{to{stroke-dashoffset:-44}}
        .mm-node{animation:mm-pulse 3.2s ease-in-out infinite}
        @keyframes mm-pulse{0%,100%{stroke-opacity:.22}50%{stroke-opacity:.6}}
        .mm-glow{text-shadow:0 0 24px rgba(34,211,238,.55),0 0 60px rgba(34,211,238,.22)}
        .mm-btn{display:flex;align-items:center;gap:13px;width:330px;max-width:84vw;padding:13px 18px;border-radius:9px;border:1px solid #233247;background:rgba(13,18,28,.78);color:#D7E0EA;font:inherit;cursor:pointer;text-align:left;transition:border-color .15s,background .15s,transform .05s,box-shadow .15s}
        .mm-btn:hover{border-color:#22D3EE;background:rgba(16,26,38,.92);box-shadow:0 0 22px rgba(34,211,238,.16)}
        .mm-btn:active{transform:translateY(1px)}
        .mm-btn.start{border-color:#155E6B;background:rgba(12,44,51,.85)}
        .mm-btn.start:hover{border-color:#22D3EE;box-shadow:0 0 30px rgba(34,211,238,.28)}
        .mm-ico{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:8px;background:rgba(34,211,238,.10);flex:none}
      `}</style>
      <div className="mm-grid" />
      <svg className="mm-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x="78" y="64" width="844" height="872" rx="28" fill="none" stroke="rgba(34,211,238,.12)" strokeWidth="2" />
        <rect x="120" y="106" width="760" height="788" rx="18" fill="none" stroke="rgba(34,211,238,.055)" strokeWidth="1.5" />
        <line x1="78" y1="500" x2="48" y2="500" stroke="rgba(34,211,238,.10)" strokeWidth="2" />
        <line x1="922" y1="500" x2="952" y2="500" stroke="rgba(34,211,238,.10)" strokeWidth="2" />
        <path d={tracePath} fill="none" stroke="rgba(125,239,255,.20)" strokeWidth="3" className="mm-trace" />
        {mapNodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="17" fill={n.color} fillOpacity=".10" />
            <circle cx={n.x} cy={n.y} r="23" fill="none" stroke={n.color} strokeOpacity=".5" strokeWidth="2" className="mm-node" />
            <circle cx={n.x} cy={n.y} r="6" fill={n.color} fillOpacity=".85" />
            <text x={n.x} y={n.y - 32} fill={n.color} fillOpacity=".62" fontSize="19" fontFamily="ui-monospace, monospace" textAnchor="middle">{n.id < 10 ? '0' + n.id : '' + n.id}</text>
            <text x={n.x} y={n.y + 40} fill="rgba(159,178,200,.5)" fontSize="13" fontFamily="ui-monospace, monospace" textAnchor="middle">{n.name}</text>
          </g>
        ))}
      </svg>
      {bits.map((b, i) => (
        <span key={i} className="mm-bit" style={{ left: b.left + '%', fontSize: b.size, animationDelay: b.delay + 's', animationDuration: b.dur + 's' }}>{b.ch}</span>
      ))}

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginBottom: 26 }}>
        <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 10 }}>fab dojo-n4 · rev a</div>
        <div className="mm-glow" style={{ fontSize: 'clamp(44px,11vw,84px)', fontWeight: 700, letterSpacing: '.12em', color: '#E8F1FA', lineHeight: 1 }}>
          TAPEOUT<span className="cursorblink" style={{ color: '#7DEFFF' }}>_</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, letterSpacing: '.34em', textTransform: 'uppercase', color: '#76849A' }}>the verilog dojo</div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <button className="mm-btn start" onClick={() => { AudioFX.click(); go({ name: 'campus' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(34,211,238,.16)' }}><Play size={17} color="#7DEFFF" fill="#7DEFFF" /></span>
          <span><div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.04em', color: '#7DEFFF' }}>CONTINUE</div><div style={{ fontSize: 11, color: '#76849A' }}>resume · walk the fab · Lv {levelFromXp(save.xp || 0)} · ⛁ {save.scrap || 0}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" style={confirmNew ? { borderColor: '#B14A52' } : undefined} onClick={() => { if (confirmNew) { AudioFX.click(); onNewGame(); } else { AudioFX.bad(); setConfirmNew(true); setTimeout(() => setConfirmNew(false), 3200); } }}>
          <span className="mm-ico" style={{ background: 'rgba(255,226,122,.12)' }}><Sparkles size={16} color={confirmNew ? '#FF8B82' : '#FFE27A'} /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600, color: confirmNew ? '#FF8B82' : '#D7E0EA' }}>{confirmNew ? 'TAP AGAIN — ERASE SAVE' : 'NEW GAME'}</div><div style={{ fontSize: 11, color: '#76849A' }}>{confirmNew ? 'this wipes all progress on this slot' : 'wipe the wafer & start from the Bit Mines'}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'arcade' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(255,125,240,.12)' }}><Gamepad2 size={17} color="#FF7DF0" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>ARCADE</div><div style={{ fontSize: 11, color: '#76849A' }}>training, blitz, bug bounty &amp; the kit</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'drill' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(125,239,255,.12)' }}><RotateCcw size={16} color="#7DEFFF" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>SPACED REVIEW</div><div style={{ fontSize: 11, color: '#76849A' }}>{(() => { const d = dueTopics(save.skill, todayNum()).length; return d ? `${d} concept${d > 1 ? 's' : ''} due for recall` : 'keep cleared concepts sharp'; })()}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'tapeout' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(250,204,21,.12)' }}><Cpu size={16} color="#FACC15" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>TAPEOUT BAY</div><div style={{ fontSize: 11, color: '#76849A' }}>{(() => { const n = CODE_CHALLENGES.filter(c => save.done[c.id]).length; return n ? `export ${n} signed-off module${n > 1 ? 's' : ''} as RTL` : 'export your modules to real Verilog'; })()}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'shop' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(255,199,107,.12)' }}><Coins size={16} color="#FFC76B" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>SCRAP EXCHANGE</div><div style={{ fontSize: 11, color: '#76849A' }}>trade scrap for gear &amp; boosts</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" style={{ width: 330, maxWidth: '84vw' }} onClick={() => { AudioFX.click(); onSettings(); }}>
          <span className="mm-ico" style={{ background: 'rgba(118,132,154,.12)' }}><Settings size={15} color="#9FB4C8" /></span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>SETTINGS</span>
        </button>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 26, fontSize: 11.5, color: '#5A6A80', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#7DEFFF', letterSpacing: '.12em' }}>{RANKS[ri][0].toUpperCase()}</span>
        <span>Lv {levelFromXp(save.xp || 0)}</span>
        <span style={{ color: '#FFC76B' }}>⛁ {save.scrap || 0}</span>
        <span>{save.xp} XP</span>
        {save.ngplus && <span style={{ color: '#FFE27A', letterSpacing: '.1em' }}>NG+</span>}
      </div>
    </div>
  );
}

function TapeoutBay({ save, go }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const cleared = CODE_CHALLENGES.filter(c => save.done[c.id]);
  const isCap = (id) => id === 'chip1';
  const [selId, setSelId] = useState(() => cleared.some(c => isCap(c.id)) ? 'chip1' : (cleared.length ? cleared[cleared.length - 1].id : null));
  const [tab, setTab] = useState('module');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [selId, tab]);
  const ch = selId ? CODE_CHALLENGES.find(c => c.id === selId) : null;
  const out = useMemo(() => ch ? exportRTL(ch) : null, [selId]);
  const text = out ? (tab === 'testbench' ? out.testbench : tab === 'wrapper' ? out.wrapper : out.module) : '';
  const fname = out ? (tab === 'testbench' ? 'tb_' + out.name + '.v' : tab === 'wrapper' ? 'tt_um_' + out.name + '.v' : out.name + '.v') : '';
  const tabs = [['module', 'module'], ['testbench', 'testbench'], ['wrapper', 'TT wrapper']];
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 16px 60px' }}>
      <button className="lnk" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}><ChevronLeft size={14} /> menu</button>
      <div className="eyebrow" style={{ color: '#FACC15', marginTop: 14 }}>tapeout bay</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.02em', margin: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}><Cpu size={22} style={{ color: '#FACC15' }} /> Silicon Export</div>
      <div style={{ fontSize: 13, color: '#8A98AC', lineHeight: 1.5, marginBottom: 18, maxWidth: 600 }}>
        Every module you've signed off is real, synthesizable Verilog. Pull the source, a self-checking testbench, and a Tiny&nbsp;Tapeout-style top wrapper, then drop them into <code>iverilog</code> or EDA&nbsp;Playground to watch your logic run outside the dojo. The golden values baked into each testbench come straight from the dojo's reference simulation.
      </div>
      {cleared.length === 0 ? (
        <div className="card" style={{ padding: '18px', color: '#8A98AC', fontSize: 13, lineHeight: 1.55 }}>
          No modules signed off yet. Clear a <span style={{ color: '#7DEFFF' }}>code challenge</span> — the trials with a live Verilog editor — and its RTL unlocks here for export.
        </div>
      ) : (
        <>
          <div className="eyebrow" style={{ marginBottom: 9 }}>{cleared.length} module{cleared.length > 1 ? 's' : ''} ready</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {cleared.map(c => {
              const sel = c.id === selId, cap = isCap(c.id);
              return (
                <button key={c.id} onClick={() => { AudioFX.click(); setSelId(c.id); }}
                  style={{ padding: '7px 12px', borderRadius: 7, cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + (sel ? (cap ? '#FACC15' : '#22D3EE') : '#233247'), background: sel ? (cap ? 'rgba(250,204,21,.12)' : 'rgba(34,211,238,.10)') : 'rgba(13,18,28,.7)', color: sel ? (cap ? '#FACC15' : '#7DEFFF') : '#9FB0C4' }}>
                  {cap && <Medal size={13} />}{c.iface.name}
                </button>
              );
            })}
          </div>
          {isCap(selId) && <div style={{ fontSize: 12, color: '#FACC15', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}><Star size={13} /> The capstone — a clocked accumulator-ALU. This is the one you tape out.</div>}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#D7E0EA', marginBottom: 3 }}>{ch ? ch.title : ''}</div>
          <div style={{ fontSize: 12, color: '#76849A', marginBottom: 12, lineHeight: 1.5 }}>{ch ? ch.brief : ''}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => { AudioFX.click(); setTab(k); }} style={{ padding: '7px 13px', borderRadius: '7px 7px 0 0', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600, borderBottom: 'none', border: '1px solid ' + (tab === k ? '#2A3A4E' : 'transparent'), background: tab === k ? 'rgba(18,26,38,.95)' : 'transparent', color: tab === k ? '#D7E0EA' : '#76849A' }}>{label}</button>
            ))}
          </div>
          <div style={{ border: '1px solid #2A3A4E', borderRadius: '0 8px 8px 8px', background: 'rgba(10,14,22,.92)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Terminal size={13} style={{ color: '#5A6B80', flexShrink: 0 }} />
              <code style={{ fontSize: 11.5, color: '#7DEFFF' }}>{fname}</code>
              <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); AudioFX.good(); } catch (e) { } }} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 600, border: '1px solid #2A3A4E', background: copied ? 'rgba(46,165,106,.16)' : 'rgba(20,28,40,.9)', color: copied ? '#5FD89B' : '#9FB0C4', display: 'flex', alignItems: 'center', gap: 5 }}>{copied ? <><Check size={12} /> copied</> : 'copy'}</button>
            </div>
            <textarea readOnly value={text} spellCheck={false} style={{ width: '100%', height: 300, resize: 'vertical', boxSizing: 'border-box', background: 'rgba(6,9,14,.9)', color: '#C8D4E0', border: '1px solid #1B2737', borderRadius: 6, padding: 11, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre', overflow: 'auto' }} />
          </div>
          <div style={{ fontSize: 11.5, color: '#5A6B80', marginTop: 12, lineHeight: 1.6 }}>
            <span style={{ color: '#8A98AC' }}>Run it:</span> save the module and testbench, then <code style={{ color: '#9FB0C4' }}>iverilog -o sim {out ? out.name : ''}.v tb_{out ? out.name : ''}.v && vvp sim</code>. The wrapper <code style={{ color: '#9FB0C4' }}>tt_um_{out ? out.name : ''}</code> is the submission top for a Tiny&nbsp;Tapeout tile.
          </div>
        </>
      )}
    </div>
  );
}

function DrillScreen({ save, go, onReview }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const today = todayNum();
  const skill = save.skill || {};
  const due = dueTopics(skill, today);
  const pickFor = (tp) => {
    const cands = ALL_CHALLENGES.filter(c => TOPIC_OF[c.id] === tp && save.done[c.id]);
    if (!cands.length) return null;
    return cands[Math.abs(hashStr(tp + ':' + today)) % cands.length]; // stable within a day, varies across days
  };
  const items = due.map(tp => { const ch = pickFor(tp); if (!ch) return null; const t = TOPIC_LIST.find(x => x.id === tp); return { tp, label: t ? t.label : tp, ch, rec: skill[tp] }; }).filter(Boolean);
  const seen = TOPIC_LIST.filter(t => skill[t.id] && skill[t.id].seen);
  const future = seen.map(t => skill[t.id].dueDay || 0).filter(d => d > today);
  const nextDay = future.length ? Math.min(...future) : null;
  const weakest = seen.length ? seen.slice().sort((a, b) => conceptMastery(skill[a.id]) - conceptMastery(skill[b.id]))[0] : null;
  const weakCh = weakest ? pickFor(weakest.id) : null;
  const colP = ['#1D2632', '#FFC76B', '#7FB2E8', '#2EA56A'];

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '26px 16px 60px' }}>
      <button className="lnk" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}><ChevronLeft size={14} /> menu</button>
      <div className="eyebrow" style={{ color: '#7DEFFF', marginTop: 14 }}>spaced review</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.02em', margin: '4px 0 6px' }}>Recall Lab</div>
      <div style={{ fontSize: 13, color: '#8A98AC', lineHeight: 1.5, marginBottom: 20, maxWidth: 540 }}>
        Concepts you've cleared resurface here on a spreading schedule. Re-derive each one to push it into long-term memory — a clean recall lengthens the interval, a miss brings it back sooner.
      </div>
      {items.length > 0 ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{items.length} concept{items.length > 1 ? 's' : ''} due</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map(it => {
              const lvl = masteryLevel(it.rec);
              return (
                <div key={it.tp} className="card" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: '#D7E0EA' }}>{it.label}</div>
                    <div style={{ fontSize: 11.5, color: '#76849A', marginTop: 2 }}>recall via <span style={{ color: '#9FB4C8' }}>{it.ch.title}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 16, height: 6, borderRadius: 3, background: i < lvl ? colP[lvl] : '#161E28' }} />)}</div>
                  <button className="btn sm primary" onClick={() => { AudioFX.click(); onReview(it.ch.id, it.ch.kind); }}>review <ChevronRight size={12} /></button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          {seen.length ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#2EA56A', marginBottom: 6 }}>All caught up.</div>
              <div style={{ fontSize: 12.5, color: '#8A98AC', marginBottom: weakCh ? 18 : 0 }}>
                Nothing is due for recall right now{nextDay != null && isFinite(nextDay) ? ` — next review in ${nextDay - today} day${nextDay - today === 1 ? '' : 's'}` : ''}. Clear more challenges to widen the rotation.
              </div>
              {weakCh && <button className="btn sm" onClick={() => { AudioFX.click(); onReview(weakCh.id, weakCh.kind); }}>drill weakest anyway · {TOPIC_LIST.find(t => t.id === weakest.id).label} <ChevronRight size={12} /></button>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#D7E0EA', marginBottom: 6 }}>No schedule yet.</div>
              <div style={{ fontSize: 12.5, color: '#8A98AC' }}>Clear challenges out in the worlds and they'll start showing up here for spaced review.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function buildArcadeWorld(scene, model) {
  scene.background = new THREE.Color(0x06060f);
  scene.fog = new THREE.FogExp2(0x06060f, 0.022);
  scene.add(new THREE.AmbientLight(0x404a66, 0.7));
  scene.add(new THREE.HemisphereLight(0x222a44, 0x0a0810, 0.5));

  const b = model.bounds, pad = 6;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + pad * 2;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2), matStd(0x0b0b16, { roughness: 0.6, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  const grid = new THREE.GridHelper(span, 28, 0x22d3ee, 0x163848);
  grid.position.set(cx, 0.02, cz); scene.add(grid);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2), matStd(0x07070f, { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, 5, cz); scene.add(ceil);

  const wallMat = matStd(0x14101e, { roughness: 0.7, metalness: 0.25 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 5, sz), wallMat);
    m.position.set((wl.minX + wl.maxX) / 2, 2.5, (wl.minZ + wl.maxZ) / 2);
    scene.add(m);
  });
  const neon = [0xff7df0, 0x22d3ee, 0xa3e635, 0xffc76b];
  model.colliders.filter(w => (w.maxX - w.minX) > 6 || (w.maxZ - w.minZ) > 6).slice(0, 8).forEach((wl, i) => {
    const sx = Math.max(0.3, wl.maxX - wl.minX), sz = Math.max(0.3, wl.maxZ - wl.minZ);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.96, 0.14, sz * 0.96), new THREE.MeshBasicMaterial({ color: neon[i % neon.length] }));
    strip.position.set((wl.minX + wl.maxX) / 2, 4.6, (wl.minZ + wl.maxZ) / 2);
    scene.add(strip);
  });

  const api = { cabinets: {}, spin: null };
  model.interactables.filter(i => i.kind === 'arcade').forEach(it => {
    const col = new THREE.Color(it.accent);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.7, 1.1), matStd(0x0c0c16, { roughness: 0.5, metalness: 0.5 }));
    body.position.set(it.x, 1.35, it.z); scene.add(body);
    const screenMat = new THREE.MeshBasicMaterial({ color: col });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.8), screenMat);
    const faceZ = it.z < model.spawn.z ? 1 : -1;
    scr.position.set(it.x, 1.9, it.z + 0.58 * faceZ);
    if (faceZ < 0) scr.rotation.y = Math.PI;
    scene.add(scr);
    const lt = new THREE.PointLight(col.getHex(), 0.85, 12, 1.8);
    lt.position.set(it.x, 2.7, it.z); scene.add(lt);
    const lbl = mineLabelSprite(it.label, '#' + col.getHexString(), 0.78);
    lbl.position.set(it.x, 3.6, it.z); scene.add(lbl);
    api.cabinets[it.id] = { screenMat, light: lt };
  });

  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 4.4), new THREE.MeshBasicMaterial({ color: 0x7a2a30 }));
  padM.position.set(lift.x, 0.09, lift.z); scene.add(padM);
  const ll = mineLabelSprite('MAIN MENU', '#FF8B82', 0.8);
  ll.position.set(lift.x, 3.0, lift.z); scene.add(ll);

  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), matStd(0x1a2230, { metalness: 0.7, roughness: 0.3 }));
  pole.position.set(0, 1.7, 0); scene.add(pole);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 12, 32), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  ring.position.set(0, 3.6, 0); scene.add(ring);
  api.spin = ring;
  lightScene(scene, model.bounds, { ceil: true, dust: 0x9a6abf, glowSize: 4.0, glowOpacity: 0.9, shadowLights: 3 });
  return api;
}

function ArcadeScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('tapeline'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState('THE ARCADE');
  const [showHelp, setShowHelp] = useState(true);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRefA = useRef(save); saveRefA.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKeyA = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'arcade') { setOverlay(null); return; }
    if (sc.name === 'menu') { setOverlay(null); go({ name: 'menu' }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []); // eslint-disable-line

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      camera.rotation.order = 'YXZ';

      const model = arcadeModel();
      const api = buildArcadeWorld(scene, model);
      const playerLight = new THREE.PointLight(0xbfe0ff, 0.7, 22, 1.5);
      scene.add(playerLight);
      ambRef.current = createAmbience(scene, 'arcade');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.05 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'THE ARCADE', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      let last = performance.now();
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        if (api.spin) { api.spin.rotation.y += dt * 0.8; api.spin.rotation.x = 0.42; }
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 11.5 : 7.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const res = resolveCollisions(nx, nz, 0.55, model.colliders);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else if (it.kind === 'exit') setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'MAIN MENU' });
            else setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'PLAY — ' + it.label });
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        playerLight.position.set(player.x, 2.6, player.z);
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) {
        try { renderer.dispose(); } catch (e) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        try { renderer.domElement && renderer.domElement.remove(); } catch (e) { }
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={save} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={save} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={save} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={save} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={save} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={save} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') { label = 'SAVE TERMINAL'; body = <ProfilesScreen save={save} activeSlot={cb.activeSlot} go={oGo} onLoadSlot={cb.onLoadSlot} onNewSlot={cb.onNewSlot} onDeleteSlot={cb.onDeleteSlot} onImport={cb.onImport} readSlot={cb.readSlot} />; }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(4,5,12,0.94)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: '#FF7DF0' }}>arcade cabinet · {label}</span>
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              step away <X size={12} />
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  if (failed) {
    const model = arcadeModel();
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>THE ARCADE</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the arcade floor. Direct cabinet links below — same modes, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.kind === 'arcade').map(it => (
              <button key={it.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', borderColor: '#273245' }}
                onClick={() => openOverlay({ ...it.target })}>
                <span style={{ fontSize: 13, fontWeight: 600, color: it.accent }}>{it.label}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#06060F' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FF7DF0" />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> main menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FF7DF0', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FF7DF0' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A1430', borderRadius: 8, background: 'rgba(10,4,12,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FF7DF0' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,4,12,0.88)', border: '1px solid #6A2A63', color: '#FF7DF0', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>arcade floor</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ plays a cabinet.'
                : 'Click to capture the mouse. WASD walks, E plays a cabinet. The lift by the entrance takes you back to the main menu.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

// ============================================================
// TRAIL DUNGEON MODELS — serpentine worlds 3/5/6/7 + DUNGEON_CFG
// One engine, themed + laid out per world. Worlds 2-7.
// ============================================================

const DUNGEON_CFG = {
  2: {
    zone: 'GATE VALLEY', bossZone: 'GOLEM GROUNDS',
    theme: { bg: 0x0a1206, fog: 0.026, floorCol: 0x10180a, gridCol: 0x3a5a1a, wallCol: 0x1c2a12, accent: 0xa3e635, ambient: 0.85, ceil: false, prop: 'arch' },
    descend: { label: 'ENTER GATE VALLEY', sub: 'Cross the valley. The gates judge every step. A golem waits at the far end.' },
  },
  3: {
    trail: { legs: 3, Lv: 48, H: 58, W: 24 }, chamberW: 40, chamberD: 34,
    zone: 'THE FOUNDRY FLOOR', bossZone: 'HIERARCH CORE',
    theme: { bg: 0x04101a, fog: 0.03, floorCol: 0x081722, gridCol: 0x155e6b, wallCol: 0x0c2630, accent: 0x22d3ee, ambient: 0.7, ceil: true, prop: 'pipe' },
    descend: { label: 'ENTER THE FOUNDRY', sub: 'Walk the foundry floor. Compile under heat. The Hierarch presides over the core.' },
  },
  4: {
    zone: 'THE CANYON', bossZone: 'COLOSSUS MESA',
    theme: { bg: 0x140a04, fog: 0.022, floorCol: 0x1c1108, gridCol: 0x7a4a1a, wallCol: 0x3a2412, accent: 0xfb923c, ambient: 0.88, ceil: false, prop: 'mesa' },
    descend: { label: 'DESCEND INTO THE CANYON', sub: 'Pick through the canyon. Pure logic, no memory. A colossus blocks the pass.' },
  },
  5: {
    trail: { legs: 4, Lv: 42, H: 48, W: 20 }, chamberW: 40, chamberD: 34,
    zone: 'THE CLOCKWORKS', bossZone: "THE TYRANT'S MOVEMENT",
    theme: { bg: 0x0c081a, fog: 0.03, floorCol: 0x140e22, gridCol: 0x5a3aa0, wallCol: 0x201838, accent: 0xa78bfa, ambient: 0.72, ceil: true, prop: 'gear' },
    descend: { label: 'CLIMB THE CLOCK TOWER', sub: 'Wind through the clockworks. Mind the rising edges. The Tyrant keeps time.' },
  },
  6: {
    trail: { legs: 2, Lv: 58, H: 70, W: 28 }, chamberW: 44, chamberD: 36,
    zone: 'FORTRESS HALLS', bossZone: 'THE THRONE STATE',
    theme: { bg: 0x12060a, fog: 0.03, floorCol: 0x1a0c10, gridCol: 0x7a2a3a, wallCol: 0x2e1820, accent: 0xfb7185, ambient: 0.76, ceil: true, prop: 'crenel' },
    descend: { label: 'STORM THE FORTRESS', sub: 'Breach the fortress halls. Every room is a state. The engine rules them all.' },
  },
  7: {
    trail: { legs: 2, Lv: 36, H: 44, W: 24 }, chamberW: 40, chamberD: 32,
    zone: 'THE TAPEOUT FLOOR', bossZone: 'THE ALTAR',
    theme: { bg: 0x12100a, fog: 0.02, floorCol: 0x1a1608, gridCol: 0x7a6310, wallCol: 0x2e2810, accent: 0xfacc15, ambient: 0.92, ceil: true, prop: 'altar' },
    descend: { label: 'WALK TO TAPEOUT', sub: 'One floor. One altar. One shot at silicon.' },
  },
};

function dungeonBossFight(fights) {
  return fights.find(f => f.boss) || fights[fights.length - 1];
}

function dungeonModel(w, fights, lessonIds) {
  if (w === 2) return valleyModel(w, fights, lessonIds);
  if (w === 4) return canyonModel(w, fights, lessonIds);
  const cfg = DUNGEON_CFG[w];
  const T = cfg.trail, W = T.W, half = W / 2;
  const chamberW = cfg.chamberW, chamberD = cfg.chamberD;

  const boss = dungeonBossFight(fights);
  const regular = fights.filter(f => f !== boss);
  const seq = stationSequence(regular, lessonIds);
  const N = seq.length;

  // Serpentine trail: vertical legs alternating between two columns, joined by
  // wide galleries. Auto-extends so N stations sit ~16u apart along the walk.
  const build = (Lv) => {
    const rects = [], pts = [{ x: 0, z: -6 }];
    let zTop = 0, xa = 0;
    for (let i = 0; i < T.legs; i++) {
      const xi = (i % 2 === 0) ? 0 : T.H;
      rects.push({ x1: xi - half, z1: zTop - Lv, x2: xi + half, z2: zTop, zone: cfg.zone });
      if (i < T.legs - 1) {
        const xn = ((i + 1) % 2 === 0) ? 0 : T.H;
        const bz2 = zTop - Lv, bz1 = bz2 - W;
        rects.push({ x1: Math.min(xi, xn) - half, z1: bz1, x2: Math.max(xi, xn) + half, z2: bz2, zone: cfg.zone });
        const bc = bz2 - W / 2;
        pts.push({ x: xi, z: bc }, { x: xn, z: bc });
        zTop = bz1;
      } else {
        zTop = zTop - Lv;
      }
      xa = xi;
    }
    const Zend = zTop;
    rects.push({ x1: xa - chamberW / 2, z1: Zend - chamberD, x2: xa + chamberW / 2, z2: Zend, zone: cfg.bossZone });
    pts.push({ x: xa, z: Zend + 5 });
    pts.push({ x: xa, z: Math.round(Zend - chamberD / 2) });
    return { rects, pts, xa, Zend };
  };
  const arcOf = (pts, upto) => { let s = 0; for (let i = 1; i <= upto; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return s; };
  let Lv = T.Lv, lay = build(Lv);
  const usable = () => arcOf(lay.pts, lay.pts.length - 2) - 24;
  const need = N * 16;
  if (usable() < need) { Lv += Math.ceil((need - usable()) / T.legs); if (Lv % 2) Lv++; lay = build(Lv); }

  const { rects, pts, xa, Zend } = lay;
  const { walls, bounds } = mineWalls(rects);
  const gateZ = Zend, gateX = xa, gateW = W + 0.6;
  const gateCollider = mkBox(gateX, gateZ, gateW, 1.8, 'gate');

  // stations at even spacing along the trail, weaving left/right of the line
  const total = arcOf(pts, pts.length - 2);
  const s0 = 15, s1 = total - 9;
  const atArc = (s) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (acc + L >= s || i === pts.length - 2) {
        const t = Math.max(0, Math.min(1, (s - acc) / (L || 1)));
        const dx = (b.x - a.x) / (L || 1), dz = (b.z - a.z) / (L || 1);
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, px: -dz, pz: dx, dx, dz };
      }
      acc += L;
    }
    return { x: pts[0].x, z: pts[0].z, px: 1, pz: 0, dx: 0, dz: -1 };
  };
  const off = Math.max(0, half - 4.8);
  const inz = (x, z) => rects.some(r => x > r.x1 + 1.1 && x < r.x2 - 1.1 && z > r.z1 + 1.1 && z < r.z2 - 1.1);
  const interactables = [];
  seq.forEach((s, i) => {
    const a = atArc(s0 + (i + 0.5) * (s1 - s0) / N);
    const sd = (i % 2 === 0 ? 1 : -1) * off;
    let x = Math.round(a.x + a.px * sd), z = Math.round(a.z + a.pz * sd);
    if (!inz(x, z)) {
      // near a turn seam — slide along the trail until solidly inside
      for (const k of [2, -2, 3, -3, 4, -4, 6, -6, 8, -8, 10, -10]) {
        const nx = Math.round(a.x + a.dx * k + a.px * sd), nz = Math.round(a.z + a.dz * k + a.pz * sd);
        if (inz(nx, nz)) { x = nx; z = nz; break; }
      }
    }
    const ord = i + 1;
    if (s.kind === 'book') interactables.push({ id: 'book_' + s.lid, kind: 'book', lid: s.lid, ord, x, z, r: 2.4, target: { name: 'note', id: s.lid } });
    else interactables.push({ id: s.f.id, kind: 'fight', boss: false, ord, x, z, r: 3.4, target: { name: s.f.kind, id: s.f.id }, xp: s.f.xp, title: s.f.title });
  });
  interactables.push({ id: boss.id, kind: 'fight', boss: true, ord: N + 1, x: xa, z: Math.round(Zend - chamberD / 2), r: 3.4, target: { name: boss.kind, id: boss.id }, xp: boss.xp, title: boss.title });
  interactables.push({ id: 'lift', kind: 'exit', x: 0, z: -3, r: 2.6, target: { name: 'surface' } });

  return {
    world: w, rects, colliders: walls, gateCollider,
    collidersClosed: walls.concat([gateCollider]),
    interactables, bounds, path: pts, trail: true,
    spawn: { x: 0, z: -8, yaw: 0 },
    gateZ, gateX, gateW, theme: cfg.theme, zone: cfg.zone, bossZone: cfg.bossZone,
    regularIds: regular.map(f => f.id), bossId: boss.id,
  };
}

function dungeonGateOpen(save, model) {
  const d = activeDone(save);
  return model.regularIds.every(id => !!d[id]);
}

// ============================================================
// DUNGEON SCREEN — renderer + walkable worlds 2-7
// ============================================================

function buildDungeonNodes(scene, model, theme, api) {
  const acc = theme.accent;
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const en = enemyFor(it.id, model.world, it.xp || 30, it.boss, 'engineer', false);
    const sc = it.boss ? 1.7 : 1;
    plinthRock(scene, it.x, it.z, sc);
    const beaconMat = new THREE.MeshBasicMaterial({ color: it.boss ? 0xfacc15 : acc });
    const creature = makeCreature(creatureSpec(model.world, en.name, it.boss), beaconMat);
    creature.position.set(it.x, 0.5, it.z); scene.add(creature);
    const lt = new THREE.PointLight(it.boss ? 0xfacc15 : acc, it.boss ? 1.0 : 0.7, 16, 1.8);
    lt.position.set(it.x, 3.6 * sc, it.z); scene.add(lt);
    scene.add(fxCone(it.boss ? 0xfacc15 : acc, it.boss ? 3.4 : 2.1, theme.ceil ? 5.1 : (it.boss ? 15 : 12), it.boss ? 0.1 : 0.06, it.x, it.z));
    const nl = mineLabelSprite((it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name, it.boss ? '#FFE27A' : '#CFE0F2', it.boss ? 0.44 : 0.34);
    nl.position.set(it.x, it.boss ? 9.5 : 2.9 * sc + 0.5, it.z);
    scene.add(nl);
    api.totems[it.id] = { beaconMat, creature };
    api.creatures.push({ grp: creature, it });
  });
  model.interactables.filter(i => i.kind === 'book').forEach(it => {
    const { bookMat } = fieldNoteProp(scene, it.x, it.z, acc);
    const lbl = mineLabelSprite((it.ord ? '#' + it.ord + ' · ' : '') + 'FIELD NOTE', '#' + acc.toString(16).padStart(6, '0'), 0.62);
    lbl.position.set(it.x, 2.5, it.z); scene.add(lbl);
    scene.add(fxCone(acc, 1.6, theme.ceil ? 5.1 : 9, 0.055, it.x, it.z));
    api.books[it.lid] = { bookMat };
  });
  const gx = model.gateX || 0, gw = model.gateW || 8;
  const gate = new THREE.Group();
  const barMat = matStd(0x3a4a63, { roughness: 0.4, metalness: 0.8 });
  for (let x = gx - gw / 2 + 0.8; x <= gx + gw / 2; x += 1.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 0.3), barMat);
    bar.position.set(x, 2.6, model.gateZ); gate.add(bar);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.2, 0.4, 0.42), new THREE.MeshBasicMaterial({ color: acc }));
  cross.position.set(gx, 4.7, model.gateZ); gate.add(cross);
  scene.add(gate); api.gateGrp = gate;
  const gl = mineLabelSprite('SEALED GATE', '#FF8B82', 0.85);
  gl.position.set(gx, 6.1, model.gateZ + 0.2); scene.add(gl);
  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 4.6), new THREE.MeshBasicMaterial({ color: 0x155e6b }));
  padM.position.set(lift.x, 0.09, lift.z); scene.add(padM);
  const ll = mineLabelSprite('SURFACE LIFT', '#7DEFFF', 0.8);
  ll.position.set(lift.x, 3.1, lift.z); scene.add(ll);
  api.nextGrp = makeNextBeacon(scene, acc, !theme.ceil);
}

// Dense themed environmental structures so worlds read as built places, not empty grids.
// Spread across the hall, clear of nodes and the path corridor. Count scales with floor area.
function scatterStructures(scene, model, theme) {
  const acc = theme.accent, b = model.bounds;
  const rng = mulberry32(900 + model.world * 7);
  const nodes = model.interactables.map(i => ({ x: i.x, z: i.z }));
  const path = model.path || [];
  const wallMat = matStd(theme.wallCol, { roughness: 0.9, metalness: 0.18 });
  const darkMat = matStd(theme.floorCol, { roughness: 1, metalness: 0.1 });
  const litMat = matStd(theme.wallCol, { roughness: 0.5, metalness: 0.5 });
  const capMat = new THREE.MeshBasicMaterial({ color: acc });
  const inHall = (x, z) => model.rects.some(r => x > r.x1 + 1.2 && x < r.x2 - 1.2 && z > r.z1 + 1.2 && z < r.z2 - 1.2);
  const nearNode = (x, z) => nodes.some(n => Math.hypot(n.x - x, n.z - z) < 5.5);
  const onPath = (x, z) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1], dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz;
      let t = L2 ? ((x - a.x) * dx + (z - a.z) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < 4.5) return true;
    }
    return false;
  };
  const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
  const target = Math.min(74, Math.round(area / 95));
  let placed = 0, tries = 0;
  while (placed < target && tries < target * 16) {
    tries++;
    const x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ);
    if (!inHall(x, z) || nearNode(x, z) || onPath(x, z)) continue;
    placed++;
    const k = rng();
    if (k < 0.34) {
      const h = 3.4 + rng() * 6;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + rng() * 0.5, 0.65 + rng() * 0.5, h, 8), wallMat);
      col.position.set(x, h / 2, z); scene.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), capMat);
      cap.position.set(x, h + 0.3, z); scene.add(cap);
    } else if (k < 0.6) {
      const h = 1 + rng() * 2.6, w = 1 + rng() * 2.2;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7 + 0.6), litMat);
      blk.position.set(x, h / 2, z); blk.rotation.y = rng() * Math.PI; scene.add(blk);
    } else if (k < 0.82) {
      const h = 1.8 + rng() * 3;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rng() * 0.5, h, 5), wallMat);
      sh.position.set(x, h / 2, z); sh.rotation.y = rng() * Math.PI; scene.add(sh);
    } else {
      const h = 0.4 + rng() * 0.9;
      const d = new THREE.Mesh(new THREE.BoxGeometry(1 + rng() * 1.6, h, 1 + rng() * 1.6), darkMat);
      d.position.set(x, h / 2, z); d.rotation.y = rng() * Math.PI; scene.add(d);
    }
  }
}

// Theme decorations that follow the trail: corner pylons at every turn, themed
// frames/pipes/gears along each stretch, a dais under the boss. Reads model.path
// so it fits any layout.
function trailProps(scene, model, theme) {
  const acc = theme.accent, pts = model.path || [];
  if (pts.length < 2) return;
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const matte = matStd(theme.wallCol, { roughness: 0.6, metalness: 0.5 });
  const W2 = ((model.gateW || 22) - 0.6) / 2;
  for (let i = 1; i < pts.length - 2; i++) {
    const p = pts[i];
    const py = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4.8, 8), matte);
    py.position.set(p.x, 2.4, p.z); scene.add(py);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), accMat);
    cap.position.set(p.x, 5.0, p.z); scene.add(cap);
  }
  const kind = theme.prop;
  for (let i = 0; i < pts.length - 2; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 14) continue;
    const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L, px = -dz, pz = dx;
    for (let s = 12; s < L - 8; s += 20) {
      const x = a.x + dx * s, z = a.z + dz * s;
      if (kind === 'pipe') {
        [-1, 1].forEach(sd => {
          const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), accMat);
          pipe.position.set(x + px * sd * (W2 - 1), 2.6, z + pz * sd * (W2 - 1)); scene.add(pipe);
        });
      } else if (kind === 'gear') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.2, 8, 26), accMat);
        ring.position.set(x + px * (W2 - 1.4), 3.3, z + pz * (W2 - 1.4)); ring.rotation.y = Math.atan2(px, pz); scene.add(ring);
      } else {
        [-1, 1].forEach(sd => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 0.7), matte);
          post.position.set(x + px * sd * (W2 - 0.9), 2.6, z + pz * sd * (W2 - 0.9)); scene.add(post);
        });
        const lint = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, (W2 - 0.9) * 2), accMat);
        lint.position.set(x, 5.1, z); lint.rotation.y = Math.atan2(px, pz); scene.add(lint);
      }
    }
  }
  const bz = model.interactables.find(i => i.boss);
  if (bz) {
    const dais = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 9), matStd(theme.wallCol, { roughness: 0.5, metalness: 0.6 }));
    dais.position.set(bz.x, 0.25, bz.z); scene.add(dais);
  }
}

function buildDungeonWorld(scene, model, theme) {
  if (model.biome === 'valley') return buildValley(scene, model, theme);
  if (model.biome === 'canyon') return buildCanyon(scene, model, theme);
  const acc = theme.accent;
  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.FogExp2(theme.bg, theme.fog);
  scene.add(new THREE.AmbientLight(0x2a3344, theme.ambient));
  scene.add(new THREE.HemisphereLight(acc, theme.bg, 0.32));

  const b = model.bounds, pad = 8;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const fw = b.maxX - b.minX + pad * 2, fd = b.maxZ - b.minZ + pad * 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 0.95, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  const grid = new THREE.GridHelper(Math.max(fw, fd), Math.round(Math.max(fw, fd) / 4), theme.gridCol, theme.gridCol);
  grid.material.transparent = true; grid.material.opacity = 0.42;
  grid.position.set(cx, 0.02, cz); scene.add(grid);
  buildPathTrail(scene, model.path, acc);
  if (theme.ceil) {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.bg, { roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, 5.4, cz); scene.add(ceil);
  }

  const wallMat = matStd(theme.wallCol, { roughness: 0.85, metalness: 0.12 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 5.6, sz), wallMat);
    m.position.set((wl.minX + wl.maxX) / 2, 2.8, (wl.minZ + wl.maxZ) / 2);
    scene.add(m);
  });

  // ---- theme props (cheap, decorative) ----
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const propMatte = matStd(theme.wallCol, { roughness: 0.6, metalness: 0.5 });
  const HD = -(b.minZ + pad); // not used directly; props placed relative to hall
  trailProps(scene, model, theme);
  scatterStructures(scene, model, theme);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };

  buildDungeonNodes(scene, model, theme, api);

  lightScene(scene, model.bounds, { ceil: theme.ceil, dust: theme.accent, glowSize: 4.4, glowOpacity: 0.8, sky: 0xcdbca0 });
  return api;
}

function applyDungeonProgress(api, model, save) {
  const d = activeDone(save);
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const t = api.totems[it.id];
    if (!t) return;
    t.beaconMat.color.setHex(d[it.id] ? 0x2ea56a : it.boss ? 0xfacc15 : (model.theme.accent));
    if (t.creature) t.creature.userData.dead = !!d[it.id];
  });
  const lr = save.lessons || {};
  Object.keys(api.books).forEach(lid => {
    api.books[lid].bookMat.color.setHex(lr[lid] ? 0x3a5a66 : model.theme.accent);
  });
  if (api.gateGrp) api.gateGrp.visible = !dungeonGateOpen(save, model);
  if (api.nextGrp) {
    const nx = nextStationOf(model, save);
    if (nx) { api.nextGrp.visible = true; api.nextGrp.position.set(nx.x, 0, nx.z); }
    else api.nextGrp.visible = false;
  }
}

function DungeonScreen({ w, save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack(trackForWorld(w)); musicSetState('explore'); } catch (e) { } }, [w]);
  const world = WORLDS.find(x => x.id === w);
  const fights = challengesOf(w);
  const lessonList = LESSONS[w] || [];
  const lessonIds = lessonList.map(L => L.id);
  const cfg = DUNGEON_CFG[w];
  const accHex = '#' + cfg.theme.accent.toString(16).padStart(6, '0');

  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState(cfg.zone);
  const [showHelp, setShowHelp] = useState(false);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefD = useRef(save); saveRefD.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const modelMemo = useMemo(() => dungeonModel(w, fights, lessonIds), [w]); // eslint-disable-line
  const activeMode = save.ngplus ? 'architect' : save.mode;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'dungeon' || sc.name === 'world' || sc.name === 'surface') { setOverlay(null); return; }
    setOverlay(sc);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = modelMemo;
      const api = buildDungeonWorld(scene, model, model.theme);
      const lamp = new THREE.SpotLight(0xfff0d8, 1.9, 42, 0.56, 0.5, 1.3);
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 46; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      const fillLight = new THREE.PointLight(model.theme.accent, 0.45, 26, 1.6);
      scene.add(fillLight);
      ambRef.current = createAmbience(scene, 'cave');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.03 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = cfg.zone, frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !dungeonGateOpen(saveRefD.current, model)) return 'SEALED — clear the ' + cfg.zone.toLowerCase();
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyM') { try { musicCycleTrack(1); } catch (e) { } }
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => { if (overlayRef.current || isTouch) return; try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { } };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => { const t = e.touches[0]; if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; } };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0]; if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const ww = mount.clientWidth || window.innerWidth, hh = mount.clientHeight || window.innerHeight;
        camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh); if (post) post.resize(ww, hh);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyDungeonProgress(api, model, saveRefD.current);
      let last = performance.now();
      let _aim = null, _flash = null, _hp = null, _hpTex = null, _lastBar = -1, _prevE = null, _prevP = null, _punchT = -9e9, _flashT = -9e9, _shakeT = -9e9, _vigT = -9e9, _prevOver = null, _prevPhase = 1;
      const drawHpBar = (tex, frac, tele) => {
        const cv = tex.userData.cv, x = cv.getContext('2d'); x.clearRect(0, 0, 256, 64);
        x.fillStyle = 'rgba(8,10,14,0.82)'; x.fillRect(8, 22, 240, 20);
        x.fillStyle = '#FF5252'; x.fillRect(10, 24, 236 * frac, 16);
        if (tele > 0.02) { x.fillStyle = 'rgba(255,205,80,' + (0.35 + 0.5 * tele) + ')'; x.fillRect(10, 45, 236 * Math.min(1, tele), 6); }
        x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.strokeRect(8, 22, 240, 20);
        tex.needsUpdate = true;
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 15 : 9.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = dungeonGateOpen(saveRefD.current, model) ? model.colliders : model.collidersClosed;
          const res = resolveCollisions(nx, nz, 0.55, cols);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id + '|' + (lockedTest(it) || '') : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else {
              const lock = lockedTest(it);
              let text;
              if (lock) text = lock;
              else if (it.kind === 'fight') {
                const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (it.title ? ' · ' + it.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefD.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = lessonList.find(l => l.id === it.lid);
                text = (isTouch ? '⏎ ' : '[E] ') + 'READ — ' + (it.ord ? '#' + it.ord + ' · ' : '') + (L ? L.title : 'field note');
              } else text = (isTouch ? '⏎ ' : '[E] ') + 'MENU — back to the main menu';
              setPrompt({ text, locked: !!lock });
            }
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        if (frame % 30 === 0) applyDungeonProgress(api, model, saveRefD.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        camera.position.set(player.x, 1.7, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _fight = _ov && (_ov.name === 'gauntlet' || _ov.name === 'truth' || _ov.name === 'code');
        const _tot = _fight && api && api.totems ? api.totems[_ov.id] : null;
        if (_tot && _tot.creature) {
          const _cr = _tot.creature;
          if (!_aim) _aim = new THREE.PerspectiveCamera();
          if (!_flash) { _flash = new THREE.PointLight(0xfff1c0, 0, 20, 2.0); scene.add(_flash); }
          if (!_hp) {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
            _hpTex = new THREE.CanvasTexture(cv); _hpTex.userData = { cv };
            _hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _hpTex, transparent: true, depthTest: false }));
            _hp.scale.set(7, 1.75, 1); scene.add(_hp);
          }
          _aim.position.copy(camera.position); _aim.lookAt(_cr.position.x, _cr.position.y + 2.6, _cr.position.z);
          camera.quaternion.slerp(_aim.quaternion, Math.min(1, dt * 5));
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_cr.userData && _cr.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0x9fe6ff); AudioFX.win(); }
            _prevE = _cfx.ehp; _prevP = _cfx.php; _prevOver = _cfx.over;
          }
          const pk = Math.max(0, 1 - (now - _punchT) / 220);
          camera.fov = 74 - 7 * pk; camera.updateProjectionMatrix();
          _flash.position.set(_cr.position.x, _cr.position.y + 2.2, _cr.position.z);
          _flash.intensity = 2.8 * Math.max(0, 1 - (now - _flashT) / 170);
          const sk = Math.max(0, 1 - (now - _shakeT) / 320);
          if (sk > 0) { camera.position.x += (Math.random() - 0.5) * 0.55 * sk; camera.position.y += (Math.random() - 0.5) * 0.45 * sk; }
          if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.7 * Math.max(0, 1 - (now - _vigT) / 380));
        } else {
          camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
          if (_hp) _hp.visible = false;
          if (_flash) _flash.intensity = 0;
          if (camera.fov !== 74) { camera.fov = 74; camera.updateProjectionMatrix(); }
          if (vignetteRef.current && vignetteRef.current.style.opacity !== '0') vignetteRef.current.style.opacity = '0';
        }
        lamp.position.set(player.x, 1.78, player.z);
        fillLight.position.set(player.x, 2.6, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefD.current.gear && saveRefD.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) { try { renderer.dispose(); } catch (e) { } try { renderer.domElement && renderer.domElement.remove(); } catch (e) { } } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
    };
  }, []); // eslint-disable-line

  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, w, 30, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'truth') {
      const en = enemyFor(overlay.id, w, 35, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <TruthScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'code') {
      const en = enemyFor(overlay.id, w, 50, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <CodeScreen key={overlay.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = lessonList.find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow" style={{ color: accHex, marginBottom: 8 }}>recovered field note · {world.name.toLowerCase()}</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>{L.title}</h2>
            <div className="lessonbody" style={{ fontSize: 13.5, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
            {L.code && <pre className="codeblock" style={{ marginTop: 12 }}>{L.code}</pre>}
            {LESSON_DEPTH[L.id] && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1B2433' }}>
                <div className="eyebrow" style={{ marginBottom: 7, color: '#6FB7C9' }}>going deeper</div>
                <div style={{ fontSize: 13, color: '#A7B6C8' }}><Paragraphs text={LESSON_DEPTH[L.id]} /></div>
              </div>
            )}
            <button className="btn primary sm" style={{ marginTop: 14 }}
              onClick={() => { AudioFX.good(); if (!read) cb.onLessonRead(overlay.id); }}>
              {read ? 'logged ✓' : 'log it to the manual'}
            </button>
          </div>
        </div>
      ) : <div style={{ marginTop: 20, color: '#76849A' }}>The pages have rotted away.</div>;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'note' ? 'rgba(3,5,9,0.93)' : 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: overlay.name === 'note' ? '#9FB2C9' : '#FF8B82', letterSpacing: '0.14em' }}>{overlay.name === 'note' ? '✦ ' : '⚔ '}{label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#FFC76B', fontVariantNumeric: 'tabular-nums' }}><Coins size={13} /> {save.scrap || 0}</span>
            {overlay.name !== 'note' && <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(v => !v); }}><BookOpen size={12} /> field notes</button>}
            <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(false); setOverlay(null); }}>
              {overlay.name === 'note' ? 'close' : 'flee'} <X size={12} />
            </button>
          </div>
          {body}
        </div>
        {notesOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,5,9,0.97)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — {(world && world.name) || ''}</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[w] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the world to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (failed) {
    const model = modelMemo;
    const gateOpen = dungeonGateOpen(save, model);
    const ordOfL = {}; model.interactables.forEach(i => { if (i.kind === 'book') ordOfL[i.lid] = i.ord; });
    const fightsOrdered = model.interactables.filter(i => i.kind === 'fight').slice().sort((a, b) => (a.ord || 99) - (b.ord || 99));
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render {world.name} in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {fightsOrdered.map(it => {
              const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
              const sealed = it.boss && !gateOpen;
              const done = !!activeDone(save)[it.id];
              return (
                <button key={it.id} className="card" disabled={sealed}
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                  onClick={() => openOverlay({ ...it.target })}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>{it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : ''}{en.name}{done ? ' ✓' : ''}</span>
                  <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the hall first' : (it.title || it.id)}</div>
                </button>
              );
            })}
            {lessonList.map(L => (
              <button key={L.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => openOverlay({ name: 'note', id: L.id })}>
                <span style={{ fontSize: 13, color: accHex }}>{ordOfL[L.id] ? '#' + ordOfL[L.id] + ' · ' : ''}FIELD NOTE — {L.title}{save.lessons && save.lessons[L.id] ? ' ✓' : ''}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#' + cfg.theme.bg.toString(16).padStart(6, '0') }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent={accHex} />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: accHex, opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px ' + accHex }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(6,8,12,0.82)', letterSpacing: '.22em', fontSize: 13, color: accHex }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(6,8,12,0.88)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#2A3344'), color: prompt.locked ? '#FF8B82' : accHex, fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: accHex, marginBottom: 8 }}>{cfg.zone.toLowerCase()} · access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. Clear the hall to unseal the gate — the boss waits beyond it.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
    </div>
  );
}

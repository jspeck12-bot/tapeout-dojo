'use strict';
// ============================================================
// Shared gate helpers.
// Internals are imported by appending an export line to a COPY of tapeout
// under .gate/src/ — the source file itself is never modified.
// src/ + content/ are copied together so relative imports resolve.
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'tapeout.jsx');
const GATE_DIR = path.join(ROOT, '.gate');
const GEN = path.join(GATE_DIR, 'src', 'tapeout.jsx');
const BUNDLE = path.join(GATE_DIR, 'bundle.cjs');

const EXPORTS = [
  'App',
  'vCompile', 'runCombTest', 'runSeqTest', 'runChallengeTest', 'exportRTL',
  'combVecs',
  'WORLDS', 'LESSONS', 'WORLD_ORDER', 'DUNGEON_CFG',
  'GAUNTLETS', 'TRUTH_CHALLENGES', 'CODE_CHALLENGES', 'REMIX',
  'ALL_CHALLENGES', 'TOPIC_OF', 'challengesOf',
  'stationSequence', 'mkBox', 'circleVsAABB', 'resolveCollisions',
  'mineWalls', 'MINE_FIGHTS', 'mineModel', 'buildMineWorld',
  'valleyModel', 'canyonModel', 'dungeonModel', 'buildDungeonWorld',
  'campusModel', 'buildCampusWorld', 'buildFabUltra',
  'arcadeModel', 'buildArcadeWorld',
  'normalizeSave', 'netlistOf', 'levelizeNetlist',
];

let _mod = null;

function copyTree(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

function prepareGateTree() {
  fs.mkdirSync(GATE_DIR, { recursive: true });
  const srcDest = path.join(GATE_DIR, 'src');
  const contentDest = path.join(GATE_DIR, 'content');
  fs.rmSync(srcDest, { recursive: true, force: true });
  fs.rmSync(contentDest, { recursive: true, force: true });
  copyTree(path.join(ROOT, 'src'), srcDest);
  copyTree(path.join(ROOT, 'content'), contentDest);
  const src = fs.readFileSync(path.join(srcDest, 'tapeout.jsx'), 'utf8');
  const exportLine = `\n\nexport { ${EXPORTS.join(', ')} };\n`;
  fs.writeFileSync(path.join(srcDest, 'tapeout.jsx'), src + exportLine);
}

function loadMod() {
  if (_mod) return _mod;
  const esbuild = require('esbuild');
  prepareGateTree();
  esbuild.buildSync({
    entryPoints: [GEN],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: BUNDLE,
    jsx: 'automatic',
    loader: { '.jsx': 'jsx' },
    packages: 'external',
    logLevel: 'silent',
    legalComments: 'none',
  });
  _mod = require(BUNDLE);
  return _mod;
}

function buildOnly() {
  loadMod();
  return fs.statSync(BUNDLE).size;
}

function grad() { return { addColorStop() {} }; }
function ctx2d(canvas) {
  const store = {
    canvas, font: '', fillStyle: '', strokeStyle: '', globalAlpha: 1,
    lineWidth: 1, textAlign: '', textBaseline: '', shadowBlur: 0,
    shadowColor: '', lineCap: '', lineJoin: '', globalCompositeOperation: '',
    miterLimit: 10, lineDashOffset: 0, imageSmoothingEnabled: true,
  };
  const fns = {
    measureText: (t) => ({ width: String(t == null ? '' : t).length * 8 }),
    createLinearGradient: grad, createRadialGradient: grad, createConicGradient: grad,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ width: w || 1, height: h || 1, data: new Uint8ClampedArray(Math.max(1, (w || 1) * (h || 1) * 4)) }),
    createImageData: (w, h) => ({ width: (w && w.width) || w || 1, height: (w && w.height) || h || 1, data: new Uint8ClampedArray(Math.max(1, (((w && w.width) || w || 1) * ((w && w.height) || h || 1)) * 4)) }),
    putImageData() {}, drawImage() {}, save() {}, restore() {}, beginPath() {},
    closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, rect() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    fillText() {}, strokeText() {}, translate() {}, rotate() {}, scale() {},
    setTransform() {}, resetTransform() {}, transform() {}, clip() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, setLineDash() {},
    getLineDash: () => [], roundRect() {},
  };
  return new Proxy(store, {
    get(t, k) { if (k in fns) return fns[k]; if (k in t) return t[k]; return () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() {
  const c = {
    width: 1, height: 1, style: {}, _ctx: null,
    getContext(type) { if (type === '2d') { return c._ctx || (c._ctx = ctx2d(c)); } return null; },
    toDataURL() { return 'data:image/png;base64,'; },
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    removeChild() {}, setAttribute() {}, remove() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: c.width, height: c.height, right: c.width, bottom: c.height }; },
  };
  return c;
}
function makeEl(tag) {
  if (String(tag).toLowerCase() === 'canvas') return makeCanvas();
  return {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [],
    appendChild() {}, removeChild() {}, setAttribute() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, getContext() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; },
  };
}
function memStorage() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? { value: m.get(k) } : null; },
    async set(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
  };
}
function deepStub() {
  const f = function () { return deepStub(); };
  return new Proxy(f, {
    get(t, k) { if (k === 'then') return undefined; if (k === Symbol.toPrimitive) return () => 0; return deepStub(); },
    set() { return true; },
    apply() { return deepStub(); },
  });
}

let _domInstalled = false;
function installDom() {
  if (_domInstalled) return;
  _domInstalled = true;
  const document = {
    createElement: makeEl,
    createElementNS: (ns, tag) => makeEl(tag),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    head: makeEl('head'),
    addEventListener() {}, removeEventListener() {},
    exitPointerLock() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, getElementById() { return null; },
    visibilityState: 'visible', hidden: false, fonts: { ready: Promise.resolve() },
  };
  const window = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    scrollTo() {},
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    storage: memStorage(),
    navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node-gate' },
    performance: { now: () => Date.now() },
    location: { href: 'http://localhost/', search: '', pathname: '/' },
    AudioContext: function () { return deepStub(); },
    webkitAudioContext: function () { return deepStub(); },
    document,
  };
  window.window = window;
  window.self = window;
  const put = (key, value) => {
    try { global[key] = value; return; } catch (e) { /* read-only */ }
    try { Object.defineProperty(global, key, { value, configurable: true, writable: true }); } catch (e) { /* leave as-is */ }
  };
  if (global.navigator) window.navigator = global.navigator;
  if (global.performance) window.performance = global.performance;
  put('window', window);
  put('self', window);
  put('document', document);
  put('navigator', window.navigator);
  put('performance', window.performance);
  put('requestAnimationFrame', window.requestAnimationFrame);
  put('cancelAnimationFrame', window.cancelAnimationFrame);
  put('AudioContext', window.AudioContext);
  put('webkitAudioContext', window.webkitAudioContext);
  put('matchMedia', window.matchMedia);
  return window;
}

module.exports = {
  ROOT, SRC, GATE_DIR, GEN, BUNDLE, EXPORTS,
  loadMod, buildOnly, installDom, makeCanvas, prepareGateTree,
};

'use strict';
// ============================================================
// Shared gate helpers — RECONSTRUCTED gate infrastructure.
//
// NOTE: The original dev/*.cjs gate scripts were never committed to this
// repository (absent from all history, tags, branches, and CI). This suite is
// a REBUILT approximation, NOT the original 309-check gate. It exercises the
// real game internals but its coverage counts are its own.
//
// Per .cursorrules: internals are imported by appending an export line to a
// COPY of the source in .gate/ — the source file itself is never modified.
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'tapeout.jsx');
const ENGINE_SRC = path.join(ROOT, 'src', 'engine', 'verilog.js');
const GATE_DIR = path.join(ROOT, '.gate');
const GATE_SRC_DIR = path.join(GATE_DIR, 'src');
const GEN = path.join(GATE_SRC_DIR, 'tapeout.gen.jsx');
const BUNDLE = path.join(GATE_DIR, 'bundle.cjs');
const ENGINE_BUNDLE = path.join(GATE_DIR, 'verilog-engine.cjs');

// Top-level game identifiers surfaced for testing. Verilog engine exports are
// loaded directly from src/engine/verilog.js and merged into loadMod() below.
const EXPORTS = [
  'App',
  'FR',
];
const REEXPORTS = [
  {
    from: './engine/debug/netlist.js',
    names: ['netlistOf', 'levelizeNetlist'],
  },
  {
    from: './engine/debug/rtl-export.js',
    names: ['exportRTL'],
  },
  {
    from: './game/content.js',
    names: [
      'combVecs', 'WORLDS', 'LESSONS', 'GAUNTLETS', 'TRUTH_CHALLENGES',
      'CODE_CHALLENGES', 'REMIX', 'TOPIC_OF',
    ],
  },
  {
    from: './telemetry/flight-recorder.js',
    names: ['BUILD_TAG'],
  },
  {
    from: './world/progression.js',
    names: ['stationSequence', 'nextStationOf'],
  },
  {
    from: './world/challenges.js',
    names: [
      'ALL_CHALLENGES', 'WORLD_ORDER', 'challengesOf', 'activeDone',
      'worldDone', 'worldUnlocked',
    ],
  },
  {
    from: './world/collision.js',
    names: ['mkBox', 'circleVsAABB', 'resolveCollisions'],
  },
  {
    from: './world/campus.js',
    names: ['campusModel', 'campusProgress'],
  },
  {
    from: './world/dungeon-config.js',
    names: ['DUNGEON_CFG'],
  },
  {
    from: './world/open-world.js',
    names: ['valleyModel', 'canyonModel'],
  },
  {
    from: './world/dungeon.js',
    names: ['dungeonGateOpen', 'dungeonModel'],
  },
  {
    from: './world/layout.js',
    names: ['MINE_CELL', 'mineWalls'],
  },
  {
    from: './world/mine.js',
    names: ['MINE_FIGHTS', 'mineGateOpen', 'mineModel'],
  },
  {
    from: './world/arcade.js',
    names: ['arcadeModel'],
  },
  {
    from: './graphics/world-builders.js',
    names: [
      'buildCampusWorld', 'buildFabUltra', 'applyCampusProgress',
      'buildMineWorld', 'applyMineProgress',
      'buildArcadeWorld',
      'buildDungeonWorld', 'applyDungeonProgress',
    ],
  },
];

let _mod = null;

function copySourceTree(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const destination = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) copySourceTree(source, destination);
    else if (entry.isFile()) fs.copyFileSync(source, destination);
  }
}

// Build a CJS bundle of the source (plus an appended export line) and require
// it. react / three / lucide-react are left external so there is exactly one
// React instance (needed for the smoke test's react-test-renderer).
function loadMod() {
  if (_mod) return _mod;
  const esbuild = require('esbuild');
  if (!fs.existsSync(GATE_DIR)) fs.mkdirSync(GATE_DIR, { recursive: true });
  fs.rmSync(GATE_SRC_DIR, { recursive: true, force: true });
  copySourceTree(path.join(ROOT, 'src'), GATE_SRC_DIR);
  const src = fs.readFileSync(SRC, 'utf8');
  const directExports = `\n\nexport { ${EXPORTS.join(', ')} };\n`;
  const moduleExports = REEXPORTS.map(({ from, names }) =>
    `export { ${names.join(', ')} } from '${from}';`,
  ).join('\n');
  const exportLine = directExports + moduleExports + '\n';
  fs.writeFileSync(GEN, src + exportLine);
  esbuild.buildSync({
    entryPoints: [ENGINE_SRC],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: ENGINE_BUNDLE,
    logLevel: 'silent',
    legalComments: 'none',
  });
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
  _mod = { ...require(BUNDLE), ...require(ENGINE_BUNDLE) };
  return _mod;
}

// Just build the bundle (used by the build stage); returns byte size.
function buildOnly() {
  loadMod();
  return fs.statSync(BUNDLE).size;
}

// ---------------- headless DOM / browser stubs ----------------
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
  // Some globals (navigator, performance) are read-only in modern Node; define
  // them defensively and fall back to whatever the runtime already provides.
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
  ROOT, SRC, ENGINE_SRC, GATE_DIR, GATE_SRC_DIR, GEN, BUNDLE, ENGINE_BUNDLE,
  EXPORTS, REEXPORTS,
  loadMod, buildOnly, installDom, makeCanvas,
};

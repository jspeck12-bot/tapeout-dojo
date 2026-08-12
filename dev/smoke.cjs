'use strict';
// ============================================================
// GATE · SMOKE (reconstructed — new coverage, not the original suite)
//
// Mounts the REAL <App/> React tree headlessly with react-test-renderer and a
// stubbed DOM (no WebGL). Proves:
//   · the app boots to the main menu (save load path resolves)
//   · core menu entries render
//   · routing into a 3D world hits the clean NO-WEBGL fallback instead of
//     throwing when a WebGL context is unavailable
// ============================================================
const shared = require('./_shared.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.children);
}
function findClickable(node, label) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const c of node) { const f = findClickable(c, label); if (f) return f; }
    return null;
  }
  const kids = node.children;
  if (kids) {
    const arr = Array.isArray(kids) ? kids : [kids];
    for (const c of arr) { const f = findClickable(c, label); if (f) return f; }
  }
  if (node.props && typeof node.props.onClick === 'function' && textOf(node).includes(label)) {
    return node.props.onClick;
  }
  return null;
}

async function mountAndFlush(TR, React, Component, props, options) {
  let root;
  TR.act(() => {
    root = TR.create(React.createElement(Component, props), options);
  });
  for (let index = 0; index < 4; index++) {
    await TR.act(async () => { await Promise.resolve(); });
  }
  return root;
}

async function run() {
  shared.installDom();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const TR = require('react-test-renderer');
  const act = TR.act;
  const m = shared.loadMod();
  let checks = 0;

  let root;
  act(() => { root = TR.create(React.createElement(m.App)); });
  // flush the async save-load effect (window.storage.get is a promise)
  for (let i = 0; i < 6; i++) { await act(async () => { await Promise.resolve(); }); } // eslint-disable-line no-await-in-loop

  const menuText = textOf(root.toJSON());
  for (const marker of ['TAPEOUT', 'NEW GAME', 'CONTINUE', 'SETTINGS']) {
    assert(menuText.includes(marker), `menu missing "${marker}"`);
    checks++;
  }

  // route into the fab campus (a 3D screen) — must fall back cleanly, not throw
  const onContinue = findClickable(root.toJSON(), 'CONTINUE');
  assert(typeof onContinue === 'function', 'could not find CONTINUE button');
  act(() => { onContinue(); });
  for (let i = 0; i < 4; i++) { await act(async () => { await Promise.resolve(); }); } // eslint-disable-line no-await-in-loop

  const screenText = textOf(root.toJSON());
  assert(screenText.includes('NO WEBGL'), 'no-WebGL fallback did not render after entering a 3D world');
  checks++;

  act(() => { root.unmount(); });
  checks++;

  const save = m.normalizeSave(null);
  const noop = () => {};
  const callbacks = new Proxy({
    activeSlot: 1,
    onVisited: noop,
    readSlot: async () => null,
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return noop;
    },
  });
  const common = {
    save,
    go: noop,
    cb: callbacks,
    gfx: { exposure: 1.2, lights: 1.2, ambient: 1, fog: 0.032, normal: 0.95, glow: 0.82, bloom: 0.9 },
    setGfx: noop,
    onSettings: noop,
  };

  // Every renderer failure path must remain a complete playable console, not
  // merely a banner that can hide a permanently broken 3D implementation.
  const fallbackCases = [
    {
      name: 'campus',
      Component: m.CampusScreen,
      props: common,
      markers: m.WORLDS.map((world) => world.name),
    },
    {
      name: 'mines',
      Component: m.MineScreen,
      props: common,
      markers: m.challengesOf(1).filter((challenge) => challenge.id !== 'b6')
        .map((challenge) => challenge.title)
        .concat(
          ['SEALED — clear the outer galleries'],
          (m.LESSONS[1] || []).map((lesson) => lesson.title),
        ),
    },
    {
      name: 'arcade',
      Component: m.ArcadeScreen,
      props: common,
      markers: m.arcadeModel().interactables
        .filter((item) => item.kind === 'arcade')
        .map((item) => item.label),
    },
    {
      name: 'dungeon-2',
      Component: m.DungeonScreen,
      props: { ...common, w: 2 },
      markers: m.challengesOf(2).slice(0, -1)
        .map((challenge) => challenge.title)
        .concat(
          ['SEALED — clear the hall first'],
          (m.LESSONS[2] || []).map((lesson) => lesson.title),
        ),
    },
  ];
  for (const testCase of fallbackCases) {
    const fallbackRoot = await mountAndFlush(TR, React, testCase.Component, testCase.props);
    const fallbackText = textOf(fallbackRoot.toJSON());
    assert(/NO WEBGL|can't render the arcade floor/.test(fallbackText),
      `${testCase.name}: renderer failure did not enter its console fallback`);
    for (const marker of testCase.markers) {
      assert(fallbackText.includes(marker),
        `${testCase.name}: fallback missing "${marker}"`);
      checks++;
    }
    act(() => { fallbackRoot.unmount(); });
    checks++;
  }

  const bayRoot = await mountAndFlush(TR, React, m.TapeoutBay, { save, go: noop });
  const bayText = textOf(bayRoot.toJSON());
  assert(bayText.includes('Silicon Export') && bayText.includes('No modules signed off yet'),
    'Tapeout Bay empty state failed to render');
  act(() => { bayRoot.unmount(); });
  checks += 2;

  // Positive path: provide a working renderer and host refs. This makes a
  // permanent throw in renderer setup fail instead of satisfying fallback-only
  // assertions.
  const THREE = require('three');
  const OriginalRenderer = THREE.WebGLRenderer;
  class StubRenderer {
    constructor() {
      this.domElement = shared.makeCanvas();
      this.shadowMap = {};
      this.renderCalls = 0;
    }
    setPixelRatio() {}
    setSize(width, height) {
      this.domElement.width = width;
      this.domElement.height = height;
    }
    render() { this.renderCalls++; }
    dispose() {}
    forceContextLoss() {}
  }
  const createNodeMock = (element) => {
    if (element.type === 'canvas') return shared.makeCanvas();
    return {
      clientWidth: 1280,
      clientHeight: 720,
      style: {},
      appendChild(child) { child.parentNode = this; },
      removeChild(child) { if (child) child.parentNode = null; },
      addEventListener() {},
      removeEventListener() {},
    };
  };
  THREE.WebGLRenderer = StubRenderer;
  window.ontouchstart = true;
  try {
    const positiveRoot = await mountAndFlush(
      TR,
      React,
      m.CampusScreen,
      { ...common, save: { ...save, campusVisited: true } },
      { createNodeMock },
    );
    const positiveText = textOf(positiveRoot.toJSON());
    assert(!positiveText.includes('NO WEBGL'),
      'working renderer still entered the no-WebGL fallback');
    assert(positiveText.includes('menu'),
      'working renderer path did not render the campus HUD');
    checks += 2;
    act(() => { positiveRoot.unmount(); });
  } finally {
    THREE.WebGLRenderer = OriginalRenderer;
    delete window.ontouchstart;
  }

  return checks;
}

module.exports = { run };

if (require.main === module) {
  run().then((n) => {
    console.log(`smoke OK · ${n} checks`);
    process.exit(0);
  }).catch((e) => {
    console.error('smoke FAIL: ' + e.message);
    process.exit(1);
  });
}

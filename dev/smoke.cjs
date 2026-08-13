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
function expectArray(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

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
  const storage = window.storage;
  storage._map.clear();
  storage._calls.length = 0;
  storage._map.set('tapeout_meta_v1', JSON.stringify({ active: 2 }));
  storage._map.set('tapeout_slot_2', JSON.stringify({ xp: 321, done: {}, lessons: {} }));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require('react');
  const TR = require('react-test-renderer');
  const act = TR.act;
  const m = shared.loadMod();
  let checks = 0;

  let root;
  assert(typeof m.default === 'function', 'shipped default entry is not a React component');
  checks++;
  act(() => { root = TR.create(React.createElement(m.default)); });
  // flush the async save-load effect (window.storage.get is a promise)
  for (let i = 0; i < 6; i++) { await act(async () => { await Promise.resolve(); }); } // eslint-disable-line no-await-in-loop

  const menuText = textOf(root.toJSON());
  for (const marker of ['TAPEOUT', 'NEW GAME', 'CONTINUE', 'FIELD NOTES ARCHIVE', 'OPERATOR HUD', 'SETTINGS']) {
    assert(menuText.includes(marker), `menu missing "${marker}"`);
    checks++;
  }
  assert(/321\s+XP/.test(menuText), 'active slot progress was not loaded into the shipped App');
  assert(storage._calls.some(([op, key]) => op === 'get' && key === 'tapeout_meta_v1'),
    'App never read active-slot metadata');
  assert(storage._calls.some(([op, key]) => op === 'get' && key === 'tapeout_slot_2'),
    'App never read the selected profile');
  assert(!storage._calls.some(([op, key]) => op === 'get' && key === 'tapeout_slot_1'),
    'App loaded the wrong profile key');
  checks += 4;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  assert(storage._calls.some(([op, key]) => op === 'set' && key === 'tapeout_slot_2'),
    'debounced persistence never wrote the active profile');
  checks++;

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

  // NEW GAME must use the same activation path as profile creation: write the
  // active slot immediately instead of leaking drafts/state until debounce.
  const newGameRoot = await mountAndFlush(TR, React, m.default, {});
  const armNewGame = findClickable(newGameRoot.toJSON(), 'NEW GAME');
  assert(typeof armNewGame === 'function', 'could not find NEW GAME button');
  act(() => { armNewGame(); });
  const confirmNewGame = findClickable(newGameRoot.toJSON(), 'TAP AGAIN');
  assert(typeof confirmNewGame === 'function', 'NEW GAME did not request confirmation');
  act(() => { confirmNewGame(); });
  for (let index = 0; index < 4; index++) {
    await act(async () => { await Promise.resolve(); });
  }
  const freshStored = JSON.parse(storage._map.get('tapeout_slot_2'));
  assert(freshStored.xp === 0, 'NEW GAME did not immediately replace the active slot');
  assert(JSON.parse(storage._map.get('tapeout_meta_v1')).active === 2,
    'NEW GAME changed or failed to persist the active slot');
  assert(textOf(newGameRoot.toJSON()).includes('DIE FLOOR · WAKE SIGNAL'),
    'NEW GAME did not enter the guided prologue');
  checks += 4;
  act(() => { newGameRoot.unmount(); });

  storage._map.clear();
  storage._calls.length = 0;
  const firstBootRoot = await mountAndFlush(TR, React, m.default, {});
  assert(textOf(firstBootRoot.toJSON()).includes('DIE FLOOR · WAKE SIGNAL'),
    'a brand-new profile did not cold-open into the prologue');
  checks++;
  act(() => { firstBootRoot.unmount(); });

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
  const mineFallbackModel = m.mineModel((m.LESSONS[1] || []).map((lesson) => lesson.id));
  const mineMarkers = mineFallbackModel.interactables
    .filter((item) => item.ord)
    .sort((left, right) => left.ord - right.ord)
    .map((item) => {
      if (item.kind === 'book') {
        return m.LESSONS[1].find((lesson) => lesson.id === item.lid).title;
      }
      if (item.boss) return 'SEALED — clear the outer galleries';
      return m.challengesOf(1).find((challenge) => challenge.id === item.id).title;
    });
  const dungeonFallbackModel = m.dungeonModel(
    2,
    m.challengesOf(2),
    (m.LESSONS[2] || []).map((lesson) => lesson.id),
  );
  const dungeonMarkers = dungeonFallbackModel.interactables
    .filter((item) => item.ord)
    .sort((left, right) => left.ord - right.ord)
    .map((item) => {
      if (item.kind === 'book') {
        return m.LESSONS[2].find((lesson) => lesson.id === item.lid).title;
      }
      if (item.boss) return 'SEALED — clear the hall first';
      return m.challengesOf(2).find((challenge) => challenge.id === item.id).title;
    });

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
      markers: mineMarkers,
      ordered: true,
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
      markers: dungeonMarkers,
      ordered: true,
    },
  ];
  for (const testCase of fallbackCases) {
    const fallbackRoot = await mountAndFlush(TR, React, testCase.Component, testCase.props);
    const fallbackText = textOf(fallbackRoot.toJSON());
    assert(/NO WEBGL|can't render the arcade floor/.test(fallbackText),
      `${testCase.name}: renderer failure did not enter its console fallback`);
    let previousMarker = -1;
    for (const marker of testCase.markers) {
      assert(fallbackText.includes(marker),
        `${testCase.name}: fallback missing "${marker}"`);
      if (testCase.ordered) {
        const markerIndex = fallbackText.indexOf(marker);
        assert(markerIndex > previousMarker,
          `${testCase.name}: fallback station "${marker}" is out of learning order`);
        previousMarker = markerIndex;
      }
      checks++;
    }
    act(() => { fallbackRoot.unmount(); });
    checks++;
  }

  const bossSave = m.normalizeSave(null);
  ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((id) => {
    bossSave.done[id] = { stars: 3, mode: 'engineer' };
  });
  const bossRoot = await mountAndFlush(TR, React, m.MineScreen, {
    ...common,
    save: bossSave,
  });
  const openBoss = findClickable(bossRoot.toJSON(), 'OVERFLOW OMEN');
  assert(typeof openBoss === 'function', 'cleared mine cannot choose its boss');
  act(() => { openBoss(); });
  assert(textOf(bossRoot.toJSON()).includes('FOG GATE CROSSED'),
    'boss choice did not show the cinematic name card');
  assert(textOf(bossRoot.toJSON()).includes('The Sign That Turned Against Itself'),
    'boss name card is missing its epithet');
  const enterFog = findClickable(bossRoot.toJSON(), 'enter the fog');
  assert(typeof enterFog === 'function', 'boss name card cannot enter combat');
  act(() => { enterFog(); });
  assert(textOf(bossRoot.toJSON()).includes('ENGAGED — OVERFLOW OMEN'),
    'fog gate did not hand off to the boss challenge');
  checks += 5;
  act(() => { bossRoot.unmount(); });

  const bayRoot = await mountAndFlush(TR, React, m.TapeoutBay, { save, go: noop });
  const bayText = textOf(bayRoot.toJSON());
  assert(bayText.includes('Silicon Export') && bayText.includes('No modules signed off yet'),
    'Tapeout Bay empty state failed to render');
  act(() => { bayRoot.unmount(); });
  checks += 2;

  const codexSave = m.normalizeSave({
    lessons: { L1a: true },
    noteRecall: { L1a: { attempts: 2, correct: 1, streak: 1 } },
  });
  const codexRoot = await mountAndFlush(TR, React, m.CodexScreen, {
    save: codexSave,
    go: noop,
    onRecall: noop,
  });
  const codexText = textOf(codexRoot.toJSON());
  for (const marker of ['CODEX', 'mastery die', 'Why binary?', '1/2 recall']) {
    assert(codexText.includes(marker), `Codex missing "${marker}"`);
    checks++;
  }
  act(() => { codexRoot.unmount(); });

  const recallResults = [];
  const noteRoot = await mountAndFlush(TR, React, m.NoteTerminal, {
    lesson: m.LESSONS[1][1],
    depth: m.LESSON_DEPTH.L1b,
    worldLabel: 'The Bit Mines',
    collected: false,
    recallRecord: null,
    onRecall: (correct) => recallResults.push(correct),
  });
  const decrypt = findClickable(noteRoot.toJSON(), 'decrypt note');
  assert(typeof decrypt === 'function', 'field-note terminal cannot be decrypted');
  act(() => { decrypt(); });
  const wrongRecall = findClickable(noteRoot.toJSON(), '2');
  const correctRecall = findClickable(noteRoot.toJSON(), '4');
  assert(typeof wrongRecall === 'function' && typeof correctRecall === 'function',
    'field-note recall answers are not interactive');
  act(() => { wrongRecall(); });
  act(() => { correctRecall(); });
  expectArray(recallResults, [false, true], 'field-note recall callback sequence');
  checks += 3;
  act(() => { noteRoot.unmount(); });

  // Direct campus console route into an unlocked dungeon. This guards the
  // fallback path used on GPU-less machines and distinguishes a locked district
  // from a broken navigation handoff.
  const unlockedSave = m.normalizeSave(null);
  for (const worldId of [1, 2]) {
    m.challengesOf(worldId).forEach((challenge) => {
      unlockedSave.done[challenge.id] = { stars: 3 };
    });
  }
  const routed = [];
  const campusRouteRoot = await mountAndFlush(TR, React, m.CampusScreen, {
    ...common,
    save: unlockedSave,
    go: (screen) => routed.push(screen),
  });
  const openFoundry = findClickable(campusRouteRoot.toJSON(), 'Module Foundry');
  assert(typeof openFoundry === 'function', 'unlocked Module Foundry console is not clickable');
  act(() => { openFoundry(); });
  for (let index = 0; index < 4; index++) {
    await act(async () => { await Promise.resolve(); });
  }
  const descendLabel = m.DUNGEON_CFG[3].descend.label;
  const descendFoundry = findClickable(campusRouteRoot.toJSON(), descendLabel);
  assert(typeof descendFoundry === 'function', `foundry console missing "${descendLabel}"`);
  act(() => { descendFoundry(); });
  assert(routed.some((screen) => screen.name === 'dungeon' && screen.w === 3),
    'campus console did not hand off to the selected dungeon');
  checks += 3;
  act(() => { campusRouteRoot.unmount(); });

  // Positive path: provide a working renderer and host refs. This makes a
  // permanent throw in renderer setup fail instead of satisfying fallback-only
  // assertions.
  const THREE = require('three');
  const OriginalRenderer = THREE.WebGLRenderer;
  let rendererInstances = 0;
  let rendererCalls = 0;
  let rendererDisposals = 0;
  let contextLosses = 0;
  class StubRenderer {
    constructor() {
      rendererInstances++;
      this.domElement = shared.makeCanvas();
      this.shadowMap = {};
      this.renderCalls = 0;
    }
    setPixelRatio() {}
    setSize(width, height) {
      this.domElement.width = width;
      this.domElement.height = height;
    }
    render() { this.renderCalls++; rendererCalls++; }
    dispose() { rendererDisposals++; }
    forceContextLoss() { contextLosses++; }
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
    const positiveCases = [
      {
        name: 'campus',
        Component: m.CampusScreen,
        props: { ...common, save: { ...save, campusVisited: true } },
        hud: 'menu',
      },
      { name: 'mines', Component: m.MineScreen, props: common, hud: 'menu' },
      { name: 'arcade', Component: m.ArcadeScreen, props: common, hud: 'main menu' },
      { name: 'dungeon-2', Component: m.DungeonScreen, props: { ...common, w: 2 }, hud: 'menu' },
    ];
    for (const positiveCase of positiveCases) {
      const instancesBefore = rendererInstances;
      const callsBefore = rendererCalls;
      const disposalsBefore = rendererDisposals;
      const lossesBefore = contextLosses;
      const pointerExitsBefore = document._exitPointerLockCalls;
      const positiveRoot = await mountAndFlush(
        TR,
        React,
        positiveCase.Component,
        positiveCase.props,
        { createNodeMock },
      );
      const positiveText = textOf(positiveRoot.toJSON());
      assert(!/NO WEBGL|can't render the arcade floor/.test(positiveText),
        `${positiveCase.name}: working renderer entered its fallback`);
      assert(positiveText.includes(positiveCase.hud),
        `${positiveCase.name}: working renderer path did not render its HUD`);
      assert(rendererInstances === instancesBefore + 1,
        `${positiveCase.name}: renderer constructor was not called exactly once`);
      assert(rendererCalls > callsBefore,
        `${positiveCase.name}: renderer never rendered a frame`);
      act(() => { positiveRoot.unmount(); });
      assert(rendererDisposals === disposalsBefore + 1,
        `${positiveCase.name}: renderer was not disposed on unmount`);
      assert(contextLosses === lossesBefore + 1,
        `${positiveCase.name}: WebGL context was not released on unmount`);
      assert(document._exitPointerLockCalls === pointerExitsBefore + 1,
        `${positiveCase.name}: pointer lock was not released on unmount`);
      checks += 7;
    }

    class FailingRenderer extends StubRenderer {
      render() {
        super.render();
        throw new Error('forced post-init renderer failure');
      }
    }
    THREE.WebGLRenderer = FailingRenderer;
    const failedDisposalsBefore = rendererDisposals;
    const failedLossesBefore = contextLosses;
    const failedPointerBefore = document._exitPointerLockCalls;
    const failedRoot = await mountAndFlush(
      TR,
      React,
      m.MineScreen,
      common,
      { createNodeMock },
    );
    assert(textOf(failedRoot.toJSON()).includes('NO WEBGL'),
      'post-init renderer failure did not enter fallback');
    assert(rendererDisposals === failedDisposalsBefore + 1,
      'post-init failure did not dispose its renderer immediately');
    assert(contextLosses === failedLossesBefore + 1,
      'post-init failure did not release its context immediately');
    assert(document._exitPointerLockCalls === failedPointerBefore + 1,
      'post-init failure did not release pointer lock immediately');
    checks += 4;
    act(() => { failedRoot.unmount(); });
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

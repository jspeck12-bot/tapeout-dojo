'use strict';
// ============================================================
// GATE · VISUAL (reconstructed — new coverage, not the original suite)
//
// Builds every 3D scene graph against REAL three.js with a stubbed DOM (no
// WebGL context / renderer). Proves each world's mesh builders run headless
// without throwing and populate a non-empty scene — catching broken geometry,
// bad material construction, and missing-symbol regressions before they reach
// the render loop.
// ============================================================
const shared = require('./_shared.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function run() {
  shared.installDom();
  const m = shared.loadMod();
  const THREE = require('three');
  let checks = 0;

  const scenes = [];

  // campus (fab) + ultra fab layer
  scenes.push(['campus', () => {
    const scene = new THREE.Scene();
    const model = m.campusModel();
    const api = m.buildCampusWorld(scene, model);
    m.buildFabUltra(scene, model, api);
    return scene;
  }]);

  // bit mines (world 1)
  scenes.push(['mines', () => {
    const scene = new THREE.Scene();
    const model = m.mineModel((m.LESSONS[1] || []).map((l) => l.id));
    m.buildMineWorld(scene, model);
    return scene;
  }]);

  // arcade hub
  scenes.push(['arcade', () => {
    const scene = new THREE.Scene();
    const model = m.arcadeModel();
    m.buildArcadeWorld(scene, model);
    return scene;
  }]);

  // dungeon worlds 2..7 (valley, foundry, canyon, clockworks, fortress, tapeout)
  for (const w of [2, 3, 4, 5, 6, 7]) {
    scenes.push(['dungeon-' + w, () => {
      const scene = new THREE.Scene();
      const lessonIds = (m.LESSONS[w] || []).map((l) => l.id);
      const model = m.dungeonModel(w, m.challengesOf(w), lessonIds);
      m.buildDungeonWorld(scene, model, model.theme);
      return scene;
    }]);
  }

  for (const [name, build] of scenes) {
    let scene;
    try {
      scene = build();
    } catch (e) {
      throw new Error(`scene "${name}" threw during build: ${e.message}`);
    }
    assert(scene && scene.isScene, `scene "${name}" did not return a THREE.Scene`);
    assert(scene.children.length > 0, `scene "${name}" is empty (no meshes added)`);
    checks++;
  }

  return { checks, scenes: scenes.length };
}

module.exports = { run };

if (require.main === module) {
  try {
    const r = run();
    console.log(`visual OK · ${r.scenes} scenes built · ${r.checks} checks`);
  } catch (e) {
    console.error('visual FAIL: ' + e.message);
    process.exit(1);
  }
}

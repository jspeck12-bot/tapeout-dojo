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
const SCENE_FLOORS = require('./fixtures/visual-golden.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function blankSave() {
  return { done: {}, doneNg: {}, lessons: {}, ngplus: false, tapeoutDone: false };
}
function finishStation(save, station) {
  if (station.kind === 'book') save.lessons[station.lid] = true;
  else save.done[station.id] = { stars: 3 };
}
function assertSceneEnvelope(name, scene) {
  const floor = SCENE_FLOORS[name];
  let total = 0, rendered = 0, lights = 0;
  scene.traverse((object) => {
    total++;
    if (object.isMesh || object.isSprite || object.isPoints) rendered++;
    if (object.isLight) lights++;
  });
  assert(scene.children.length >= floor.direct,
    `scene "${name}" direct children fell below ${floor.direct} (got ${scene.children.length})`);
  assert(total >= floor.total,
    `scene "${name}" object count fell below ${floor.total} (got ${total})`);
  assert(rendered >= floor.rendered,
    `scene "${name}" rendered object count fell below ${floor.rendered} (got ${rendered})`);
  assert(lights >= floor.lights,
    `scene "${name}" light count fell below ${floor.lights} (got ${lights})`);
}
function assertWorldApi(name, model, api) {
  const fights = model.interactables.filter((item) => item.kind === 'fight');
  const books = model.interactables.filter((item) => item.kind === 'book');
  assert(api && api.totems && api.books, `scene "${name}" returned an incomplete progress api`);
  assert(api.gateGrp, `scene "${name}" has no gate group`);
  assert(api.nextGrp, `scene "${name}" has no NEXT beacon`);
  assert(Object.keys(api.totems).length === fights.length,
    `scene "${name}" has ${Object.keys(api.totems).length} totems for ${fights.length} fights`);
  assert(Object.keys(api.books).length === books.length,
    `scene "${name}" has ${Object.keys(api.books).length} books for ${books.length} notes`);
}
function assertStationProgress(m, name, model, api, applyProgress, world) {
  const save = blankSave();
  const stations = model.interactables.filter((item) => item.ord).sort((a, b) => a.ord - b.ord);
  const fights = model.interactables.filter((item) => item.kind === 'fight');
  const books = model.interactables.filter((item) => item.kind === 'book');

  applyProgress(api, model, save);
  for (const item of fights) {
    const expected = item.boss ? 0xfacc15 : (world === 1 ? 0xff6b62 : model.theme.accent);
    assert(api.totems[item.id].beaconMat.color.getHex() === expected,
      `scene "${name}" uncleared fight ${item.id} has the wrong color`);
  }
  for (const item of books) {
    const expected = world === 1 ? 0x7defff : model.theme.accent;
    assert(api.books[item.lid].bookMat.color.getHex() === expected,
      `scene "${name}" unread note ${item.lid} has the wrong color`);
  }

  stations.forEach((station, index) => {
    const next = m.nextStationOf(model, save);
    assert(next && next.id === station.id,
      `scene "${name}" NEXT skipped station ${index + 1} (${station.id})`);
    assert(next.ord === index + 1,
      `scene "${name}" NEXT returned ord ${next.ord}, expected ${index + 1}`);
    applyProgress(api, model, save);
    assert(api.nextGrp.visible, `scene "${name}" NEXT beacon hidden at station ${station.ord}`);
    assert(api.nextGrp.position.x === station.x && api.nextGrp.position.z === station.z,
      `scene "${name}" NEXT beacon is not wired to station ${station.ord}`);
    finishStation(save, station);
  });

  applyProgress(api, model, save);
  assert(m.nextStationOf(model, save) === null, `scene "${name}" NEXT remains after completion`);
  assert(api.nextGrp.visible === false, `scene "${name}" NEXT beacon remains visible after completion`);

  for (const item of model.interactables.filter((entry) => entry.kind === 'fight')) {
    const color = api.totems[item.id].beaconMat.color.getHex();
    assert(color === 0x2ea56a, `scene "${name}" cleared fight ${item.id} did not turn green`);
  }
  for (const item of model.interactables.filter((entry) => entry.kind === 'book')) {
    assert(api.books[item.lid].bookMat.color.getHex() === 0x3a5a66,
      `scene "${name}" read note ${item.lid} did not update`);
  }

  const gateSave = blankSave();
  applyProgress(api, model, gateSave);
  assert(api.gateGrp.visible === (world !== 7),
    `scene "${name}" gate has wrong initial visibility`);
  const regularIds = world === 1
    ? m.MINE_FIGHTS.filter((fight) => !fight.boss).map((fight) => fight.id)
    : model.regularIds;
  regularIds.forEach((id) => { gateSave.done[id] = { stars: 3 }; });
  applyProgress(api, model, gateSave);
  assert(api.gateGrp.visible === false, `scene "${name}" gate stayed closed after regular clears`);
  for (const id of regularIds) {
    assert(api.totems[id].beaconMat.color.getHex() === 0x2ea56a,
      `scene "${name}" regular fight ${id} did not turn green`);
  }
  const boss = fights.find((item) => item.boss);
  assert(api.totems[boss.id].beaconMat.color.getHex() === 0xfacc15,
    `scene "${name}" uncleared boss did not remain gold`);
}

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
    return { scene, model, api, kind: 'campus' };
  }]);

  // bit mines (world 1)
  scenes.push(['mines', () => {
    const scene = new THREE.Scene();
    const model = m.mineModel((m.LESSONS[1] || []).map((l) => l.id));
    const api = m.buildMineWorld(scene, model);
    return { scene, model, api, kind: 'world', world: 1, apply: m.applyMineProgress };
  }]);

  // arcade hub
  scenes.push(['arcade', () => {
    const scene = new THREE.Scene();
    const model = m.arcadeModel();
    const api = m.buildArcadeWorld(scene, model);
    return { scene, model, api, kind: 'arcade' };
  }]);

  // dungeon worlds 2..7 (valley, foundry, canyon, clockworks, fortress, tapeout)
  for (const w of [2, 3, 4, 5, 6, 7]) {
    scenes.push(['dungeon-' + w, () => {
      const scene = new THREE.Scene();
      const lessonIds = (m.LESSONS[w] || []).map((l) => l.id);
      const model = m.dungeonModel(w, m.challengesOf(w), lessonIds);
      const api = m.buildDungeonWorld(scene, model, model.theme);
      return { scene, model, api, kind: 'world', world: w, apply: m.applyDungeonProgress };
    }]);
  }

  for (const [name, build] of scenes) {
    let result;
    try {
      result = build();
    } catch (e) {
      throw new Error(`scene "${name}" threw during build: ${e.message}`);
    }
    const { scene, model, api } = result;
    assert(scene && scene.isScene, `scene "${name}" did not return a THREE.Scene`);
    assertSceneEnvelope(name, scene);
    checks += 4;

    if (result.kind === 'world') {
      assertWorldApi(name, model, api);
      assertStationProgress(m, name, model, api, result.apply, result.world);
      checks += 9;
    } else if (result.kind === 'campus') {
      const save = blankSave();
      for (let world = 1; world <= 7; world++) {
        const progress = m.campusProgress(save);
        m.applyCampusProgress(api, model, progress);
        assert(progress.perWorld[world].unlocked,
          `campus world ${world} should be unlocked after prior clears`);
        assert(api.gates[world].collider.off,
          `campus world ${world} collider stayed closed after unlock`);
        if (world < 7) {
          assert(!progress.perWorld[world + 1].unlocked,
            `campus world ${world + 1} unlocked before world ${world} clear`);
          assert(!api.gates[world + 1].collider.off,
            `campus world ${world + 1} collider opened before unlock`);
        }
        m.challengesOf(world).forEach((challenge) => {
          save.done[challenge.id] = { stars: 3 };
        });
      }
      checks += 26;
    } else {
      assert(api && api.cabinets && api.spin, 'arcade returned an incomplete animation api');
      checks++;
    }
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

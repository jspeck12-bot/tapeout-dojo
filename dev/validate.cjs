'use strict';
// ============================================================
// GATE · LAYOUT (reconstructed — new coverage, not the original suite)
//
// Validates all 7 world layouts against the real collider geometry:
//   · containment — every station sits inside the world bounds & a walk rect
//   · dimensions — world spans are whole multiples of the 2u raster cell
//     (odd spans desync the rasterizer and can seal a world with phantom walls)
//   · station numbering — ords are a contiguous 1..K, boss is last, note count
//     matches the field notes, and the 3D fight ids match challengesOf(w) (2D)
//   · boss reachability by BFS through the true colliders:
//       gate CLOSED  ⇒ boss unreachable   (the gate really seals the world)
//       gate OPEN    ⇒ boss reachable      (no phantom wall blocks the trail)
// ============================================================
const { loadMod } = require('./_shared.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const CELL = 2;
const PLAYER_R = 0.55;

function bfsReachesBoss(m, model, colliders) {
  const b = model.bounds;
  const boss = model.interactables.find((i) => i.boss);
  const spawn = model.spawn;
  const step = 1;
  const key = (ix, iz) => ix + ',' + iz;
  const free = (x, z) => {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.off) continue;
      if (m.circleVsAABB(x, z, PLAYER_R, c)) return false;
    }
    return true;
  };
  const toIx = (x) => Math.round((x - b.minX) / step);
  const toIz = (z) => Math.round((z - b.minZ) / step);
  const atX = (ix) => b.minX + ix * step;
  const atZ = (iz) => b.minZ + iz * step;

  // snap start to the nearest free cell around spawn
  let start = null;
  for (let rad = 0; rad <= 8 && !start; rad++) {
    for (let dx = -rad; dx <= rad && !start; dx++) {
      for (let dz = -rad; dz <= rad && !start; dz++) {
        const x = spawn.x + dx, z = spawn.z + dz;
        if (free(x, z)) start = { ix: toIx(x), iz: toIz(z) };
      }
    }
  }
  if (!start) throw new Error('world ' + (model.world || 1) + ': spawn has no free cell nearby');

  const seen = new Set([key(start.ix, start.iz)]);
  const q = [start];
  let head = 0, guard = 0;
  while (head < q.length) {
    if (++guard > 4000000) throw new Error('BFS guard tripped');
    const { ix, iz } = q[head++];
    const x = atX(ix), z = atZ(iz);
    if (Math.hypot(x - boss.x, z - boss.z) <= boss.r) return true;
    const nbrs = [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]];
    for (const [nx, nz] of nbrs) {
      const k = key(nx, nz);
      if (seen.has(k)) continue;
      if (!free(atX(nx), atZ(nz))) continue;
      seen.add(k);
      q.push({ ix: nx, iz: nz });
    }
  }
  return false;
}

function checkModel(m, w, model) {
  let checks = 0;
  const b = model.bounds;

  // containment + no duplicate placement
  const seenPos = new Set();
  for (const it of model.interactables) {
    assert(it.x >= b.minX && it.x <= b.maxX && it.z >= b.minZ && it.z <= b.maxZ,
      `world ${w}: interactable ${it.id} outside bounds`);
    const inRect = model.rects.some((r) => it.x > r.x1 && it.x < r.x2 && it.z > r.z1 && it.z < r.z2);
    assert(inRect, `world ${w}: interactable ${it.id} not inside any walkable rect`);
    const pk = it.x + ':' + it.z;
    assert(!seenPos.has(pk), `world ${w}: two interactables share position ${pk}`);
    seenPos.add(pk);
    checks++;
  }

  // raster-safe dimensions
  assert((b.maxX - b.minX) % CELL === 0, `world ${w}: X span ${b.maxX - b.minX} is not a multiple of ${CELL}`);
  assert((b.maxZ - b.minZ) % CELL === 0, `world ${w}: Z span ${b.maxZ - b.minZ} is not a multiple of ${CELL}`);
  checks += 2;

  // station numbering: contiguous 1..K, boss last, note count matches lessons
  const stations = model.interactables.filter((i) => i.ord);
  const ords = stations.map((i) => i.ord).sort((a, x) => a - x);
  for (let i = 0; i < ords.length; i++) assert(ords[i] === i + 1, `world ${w}: station ords not contiguous (${ords.join(',')})`);
  const boss = model.interactables.find((i) => i.boss);
  assert(boss && boss.ord === ords.length, `world ${w}: boss is not the final station`);
  const bookCount = model.interactables.filter((i) => i.kind === 'book').length;
  const lessons = m.LESSONS[w] || [];
  assert(bookCount === lessons.length, `world ${w}: ${bookCount} note stations but ${lessons.length} field notes`);
  checks += 2;

  // 3D fights ↔ 2D content parity
  const fightIds = model.interactables.filter((i) => i.kind === 'fight').map((i) => i.id).sort();
  const contentIds = m.challengesOf(w).map((c) => c.id).sort();
  assert(JSON.stringify(fightIds) === JSON.stringify(contentIds),
    `world ${w}: 3D fights [${fightIds}] != content challengesOf [${contentIds}]`);
  checks++;

  // boss reachability — the gate really seals the world
  assert(bfsReachesBoss(m, model, model.colliders), `world ${w}: boss UNREACHABLE with gate open (phantom wall / sealed world)`);
  assert(!bfsReachesBoss(m, model, model.collidersClosed), `world ${w}: boss REACHABLE with gate closed (gate does not span the corridor)`);
  checks += 2;

  return checks;
}

function run() {
  const m = loadMod();
  let checks = 0;
  for (const world of m.WORLDS) {
    const w = world.id;
    const lessonIds = (m.LESSONS[w] || []).map((l) => l.id);
    const model = (w === 1) ? m.mineModel(lessonIds) : m.dungeonModel(w, m.challengesOf(w), lessonIds);
    if (!model.world) model.world = w;
    checks += checkModel(m, w, model);
  }
  return checks;
}

module.exports = { run };

if (require.main === module) {
  try {
    const n = run();
    console.log(`layout OK · ${n} checks · 7 worlds`);
  } catch (e) {
    console.error('layout FAIL: ' + e.message);
    process.exit(1);
  }
}

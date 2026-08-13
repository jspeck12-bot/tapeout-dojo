import { mkBox } from './collision.js';
import { activeDone } from './challenges.js';
import { mineWalkRects, mineWalls } from './layout.js';
import { stationSequence } from './progression.js';
import { withExploration } from './exploration.js';
import { withBossEncounter } from './boss-encounter.js';
import { scaleWorldModel } from './scale.js';

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
  return withExploration(withBossEncounter(scaleWorldModel({
    rects, colliders: walls, gateCollider,
    collidersClosed: walls.concat([gateCollider]),
    interactables, lanterns, beams, bounds,
    spawn: { x: 0, z: 68, yaw: 0 },
    gateZ: -57,
    path: [{ x: 0, z: 64 }, { x: 0, z: 40 }, { x: 0, z: 10 }, { x: 0, z: -20 }, { x: 0, z: -46 }, { x: 0, z: -57 }, { x: 0, z: -80 }],
  }, 1), 1), 1);
}

function mineGateOpen(save) {
  const d = activeDone(save);
  return ['b1', 'b2', 'b3', 'b4', 'b5'].every(id => !!d[id]);
}

function mineZoneAt(rects, x, z) {
  const r = rects.find(r => x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2);
  return r ? r.zone : null;
}

export { MINE_FIGHTS, MINE_BOOK_SPOTS, mineModel, mineGateOpen, mineZoneAt };

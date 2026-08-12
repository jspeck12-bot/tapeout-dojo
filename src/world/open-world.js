import { mkBox } from './collision.js';
import { DUNGEON_CFG } from './dungeon-config.js';
import { mineWalls } from './layout.js';
import { sortByPathProgress, stationSequence } from './progression.js';

function dungeonBossFight(fights) {
  return fights.find(f => f.boss) || fights[fights.length - 1];
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

export { dungeonBossFight, valleyModel, canyonModel };

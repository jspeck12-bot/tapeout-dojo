import { activeDone } from './challenges.js';
import { mkBox } from './collision.js';
import { DUNGEON_CFG } from './dungeon-config.js';
import { mineWalls } from './layout.js';
import { dungeonBossFight, valleyModel, canyonModel } from './open-world.js';
import { stationSequence } from './progression.js';
import { withExploration } from './exploration.js';
import { withBossEncounter } from './boss-encounter.js';

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

  return withExploration(withBossEncounter({
    world: w, rects, colliders: walls, gateCollider,
    collidersClosed: walls.concat([gateCollider]),
    interactables, bounds, path: pts, trail: true,
    spawn: { x: 0, z: -8, yaw: 0 },
    gateZ, gateX, gateW, theme: cfg.theme, zone: cfg.zone, bossZone: cfg.bossZone,
    regularIds: regular.map(f => f.id), bossId: boss.id,
  }, w), w);
}

function dungeonGateOpen(save, model) {
  const d = activeDone(save);
  return model.regularIds.every(id => !!d[id]);
}

export { dungeonModel, dungeonGateOpen };

import { activeDone } from './challenges.js';

const STATION_GROUPS = {
  L1a: ['b1', 'b2'],
  L1b: ['b3'],
  L1c: ['b4', 'b5'],
  L1d: [],
  L2a: ['g1', 'g2'],
  L2b: ['g3'],
  L2c: ['g4'],
  L2d: ['g5', 'g7'],
  L3a: ['m1'],
  L3b: ['m2', 'm3', 'm4'],
  L3c: ['m5', 'm7'],
  L3d: [],
  L4a: ['c1', 'c2'],
  L4b: ['c3', 'c4', 'c6', 'c11'],
  L4c: ['c5', 'c8'],
  L4d: ['c9', 'c10'],
  L5a: ['s1'],
  L5b: [],
  L5c: ['s2', 's3'],
  L5d: ['s4', 's5', 's6', 's8'],
  L6a: ['f1', 'f4'],
  L6b: ['f2'],
  L6c: [],
  L7a: [],
  L7b: [],
};

// Interleave lessons with the challenges that use them: each field note is
// followed by its share of the world's regular challenges. This sequence IS
// the learning order, and station numbers everywhere refer to it.
function stationSequence(regular, lessonIds) {
  const lids = lessonIds || [];
  if (!lids.length) return regular.map(f => ({ kind: 'fight', f }));
  const byId = new Map(regular.map((fight) => [fight.id, fight]));
  const mappedIds = lids.flatMap((id) => STATION_GROUPS[id] || []);
  if (mappedIds.length === regular.length &&
      new Set(mappedIds).size === regular.length &&
      mappedIds.every((id) => byId.has(id))) {
    const sequence = [];
    for (const lid of lids) {
      sequence.push({ kind: 'book', lid });
      for (const id of STATION_GROUPS[lid] || []) {
        sequence.push({ kind: 'fight', f: byId.get(id) });
      }
    }
    return sequence;
  }
  const G = lids.length, F = regular.length, base = Math.floor(F / G), extra = F % G;
  const seq = []; let fi = 0;
  for (let g = 0; g < G; g++) {
    seq.push({ kind: 'book', lid: lids[g] });
    const take = base + (g < extra ? 1 : 0);
    for (let k = 0; k < take; k++, fi++) seq.push({ kind: 'fight', f: regular[fi] });
  }
  return seq;
}
// Order free-placed spots by how far along the world's path they sit.
function sortByPathProgress(spots, path) {
  if (!path || path.length < 2) return spots.slice();
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const prog = (p) => {
    let best = 1e9, arc = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      let t = L2 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
      if (d < best) { best = d; arc = cum[i] + Math.sqrt(L2) * t; }
    }
    return arc;
  };
  return spots.slice().sort((a, b) => prog(a) - prog(b));
}
// First station (by number) the player hasn't finished — notes read, fights won.
function nextStationOf(model, save) {
  const d = activeDone(save), lr = save.lessons || {};
  const st = model.interactables.filter(i => i.ord).sort((a, b) => a.ord - b.ord);
  for (const it of st) {
    if (it.kind === 'book' ? !lr[it.lid] : !d[it.id]) return it;
  }
  return null;
}

export { STATION_GROUPS, stationSequence, sortByPathProgress, nextStationOf };

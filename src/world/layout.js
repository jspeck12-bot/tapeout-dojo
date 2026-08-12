import { mkBox } from './collision.js';

const MINE_CELL = 2;

function mineWalkRects() {
  return [
    { x1: -10, z1: 58, x2: 10, z2: 74, zone: 'ENTRANCE GALLERY' },
    { x1: -4, z1: -52, x2: 4, z2: 60, zone: 'MAIN SHAFT' },
    // west galleries (b1, b3, b5) + spurs
    { x1: -34, z1: 38, x2: -18, z2: 52, zone: 'WEST GALLERIES' },
    { x1: -18, z1: 43, x2: -4, z2: 48, zone: 'WEST GALLERIES' },
    { x1: -34, z1: 6, x2: -18, z2: 20, zone: 'WEST GALLERIES' },
    { x1: -18, z1: 11, x2: -4, z2: 16, zone: 'WEST GALLERIES' },
    { x1: -34, z1: -28, x2: -18, z2: -14, zone: 'WEST GALLERIES' },
    { x1: -18, z1: -23, x2: -4, z2: -18, zone: 'WEST GALLERIES' },
    // east galleries (b2, b4) + spurs
    { x1: 18, z1: 30, x2: 34, z2: 44, zone: 'EAST GALLERIES' },
    { x1: 4, z1: 35, x2: 18, z2: 40, zone: 'EAST GALLERIES' },
    { x1: 18, z1: -4, x2: 34, z2: 10, zone: 'EAST GALLERIES' },
    { x1: 4, z1: 1, x2: 18, z2: 6, zone: 'EAST GALLERIES' },
    // gate corridor + boss arena
    { x1: -4, z1: -62, x2: 4, z2: -52, zone: 'THE DEEP GATE' },
    { x1: -26, z1: -108, x2: 26, z2: -62, zone: 'WYRM HOLLOW' },
  ];
}

function mineWalls(rects) {
  // rasterize to cells, emit run-merged wall boxes on walkable/non-walkable edges
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  rects.forEach(r => { minX = Math.min(minX, r.x1); maxX = Math.max(maxX, r.x2); minZ = Math.min(minZ, r.z1); maxZ = Math.max(maxZ, r.z2); });
  const cs = MINE_CELL;
  const nx = Math.round((maxX - minX) / cs), nz = Math.round((maxZ - minZ) / cs);
  const walk = (ix, iz) => {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
    const cx = minX + (ix + 0.5) * cs, cz = minZ + (iz + 0.5) * cs;
    return rects.some(r => cx > r.x1 && cx < r.x2 && cz > r.z1 && cz < r.z2);
  };
  const T = 1.4, H = [];
  // horizontal walls (along x) at z-lines: key by (iz-line, side) -> runs over ix
  for (let iz = 0; iz <= nz; iz++) {
    let runStart = -1;
    for (let ix = 0; ix <= nx; ix++) {
      const edge = ix < nx && (walk(ix, iz - 1) !== walk(ix, iz));
      if (edge && runStart < 0) runStart = ix;
      if (!edge && runStart >= 0) {
        const x1 = minX + runStart * cs, x2 = minX + ix * cs, zl = minZ + iz * cs;
        H.push(mkBox((x1 + x2) / 2, zl, x2 - x1 + T, T, 'wall'));
        runStart = -1;
      }
    }
  }
  for (let ix = 0; ix <= nx; ix++) {
    let runStart = -1;
    for (let iz = 0; iz <= nz; iz++) {
      const edge = iz < nz && (walk(ix - 1, iz) !== walk(ix, iz));
      if (edge && runStart < 0) runStart = iz;
      if (!edge && runStart >= 0) {
        const z1 = minZ + runStart * cs, z2 = minZ + iz * cs, xl = minX + ix * cs;
        H.push(mkBox(xl, (z1 + z2) / 2, T, z2 - z1 + T, 'wall'));
        runStart = -1;
      }
    }
  }
  return { walls: H, bounds: { minX, maxX, minZ, maxZ } };
}

export { MINE_CELL, mineWalkRects, mineWalls };

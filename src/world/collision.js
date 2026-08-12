function mkBox(cx, cz, sx, sz, tag) { return { minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, tag: tag || '' }; }
function circleVsAABB(px, pz, r, b) {
  const cx = Math.max(b.minX, Math.min(px, b.maxX));
  const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) { const d = Math.sqrt(d2), push = r - d; return { x: dx / d * push, z: dz / d * push }; }
  const cands = [
    { x: (b.minX - r) - px, z: 0 }, { x: (b.maxX + r) - px, z: 0 },
    { x: 0, z: (b.minZ - r) - pz }, { x: 0, z: (b.maxZ + r) - pz },
  ];
  let best = cands[0], bd = Infinity;
  for (const c of cands) { const m = Math.abs(c.x) + Math.abs(c.z); if (m < bd) { bd = m; best = c; } }
  return best;
}
function resolveCollisions(px, pz, r, colliders) {
  let x = px, z = pz;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.off) continue;
      const p = circleVsAABB(x, z, r, b);
      if (p) { x += p.x; z += p.z; moved = true; }
    }
    if (!moved) break;
  }
  return { x, z };
}
function nearestInteractable(px, pz, items) {
  let best = null, bd = Infinity;
  for (const it of items) {
    const dx = px - it.x, dz = pz - it.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= it.r && d < bd) { bd = d; best = it; }
  }
  return best;
}

export { mkBox, circleVsAABB, resolveCollisions, nearestInteractable };

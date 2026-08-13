const WORLD_SCALE = {
  1: 1.6,
  2: 1.25,
  3: 1.45,
  4: 1.3,
  5: 1.45,
  6: 1.45,
  7: 1.6,
};

function scaleWorldModel(model, world) {
  if (model.worldScale) return model;
  const factor = WORLD_SCALE[world] || 1;
  const scalePoint = (point) => {
    if (!point) return;
    if (Number.isFinite(point.x)) point.x *= factor;
    if (Number.isFinite(point.z)) point.z *= factor;
  };
  const scaleRect = (rect) => {
    rect.x1 *= factor; rect.x2 *= factor;
    rect.z1 *= factor; rect.z2 *= factor;
  };
  const scaledColliders = new Set();
  const scaleCollider = (collider) => {
    if (!collider || scaledColliders.has(collider)) return;
    scaledColliders.add(collider);
    collider.minX *= factor; collider.maxX *= factor;
    collider.minZ *= factor; collider.maxZ *= factor;
  };

  model.rects.forEach(scaleRect);
  (model.colliders || []).forEach(scaleCollider);
  (model.collidersClosed || []).forEach(scaleCollider);
  scaleCollider(model.gateCollider);
  model.interactables.forEach((item) => {
    scalePoint(item);
    if (item.r) item.r *= Math.min(1.18, Math.sqrt(factor));
  });
  scalePoint(model.spawn);
  (model.path || []).forEach(scalePoint);
  (model.lanterns || []).forEach(scalePoint);
  (model.beams || []).forEach(scalePoint);

  if (model.bounds) {
    model.bounds.minX *= factor; model.bounds.maxX *= factor;
    model.bounds.minZ *= factor; model.bounds.maxZ *= factor;
  }
  if (Number.isFinite(model.gateX)) model.gateX *= factor;
  if (Number.isFinite(model.gateZ)) model.gateZ *= factor;
  if (Number.isFinite(model.gateW)) model.gateW *= factor;

  model.worldScale = factor;
  model.cellSize = 2 * factor;
  return model;
}

export { WORLD_SCALE, scaleWorldModel };

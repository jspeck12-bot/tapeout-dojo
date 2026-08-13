import { bossSpec } from '../game/bosses.js';

function withBossEncounter(model, world) {
  if (model.fogGate) return model;
  const boss = model.interactables.find((item) => item.boss);
  const spec = boss && bossSpec(boss.id);
  if (!boss || !spec) throw new Error(`World ${world} is missing a canonical boss encounter`);
  const gate = model.gateCollider;
  const horizontal = (gate.maxX - gate.minX) > (gate.maxZ - gate.minZ);
  const gateX = (gate.minX + gate.maxX) / 2;
  const gateZ = (gate.minZ + gate.maxZ) / 2;
  const spawnAxis = horizontal ? model.spawn.z - gateZ : model.spawn.x - gateX;
  const offset = spawnAxis >= 0 ? 2.8 : -2.8;
  const fog = {
    id: `fog_${world}`,
    kind: 'fog',
    world,
    bossId: boss.id,
    x: horizontal ? gateX : gateX + offset,
    z: horizontal ? gateZ + offset : gateZ,
    r: 3.1,
    title: spec.name,
    epithet: spec.epithet,
    target: boss.target,
  };
  model.interactables.push(fog);
  model.fogGate = fog;
  return model;
}

export { withBossEncounter };

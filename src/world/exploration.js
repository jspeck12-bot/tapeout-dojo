const WORLD_LORE = {
  1: [
    { title: '1947 · THE FIRST TRANSISTOR', body: 'Bardeen, Brattain, and Shockley demonstrated the first working transistor at Bell Labs. The first device was germanium and large enough to hold; modern chips print billions of transistor switches on one die.' },
    { title: '1959 · THE MOSFET', body: 'Mohamed Atalla and Dawon Kahng built the MOSFET, the transistor structure that made dense integrated circuits practical. Its insulated gate is why a tiny voltage can control a much larger current path.' },
  ],
  2: [
    { title: '1965 · MOORE’S OBSERVATION', body: 'Gordon Moore observed that economically useful component counts were doubling at a remarkable pace. It was an industry target, not a law of physics—and each generation demanded new materials, optics, and design methods.' },
    { title: 'BOOLEAN ALGEBRA MEETS RELAYS', body: 'Claude Shannon’s 1937 master’s thesis showed that Boolean algebra could describe switching circuits. That bridge from symbols to physical switches is the foundation beneath modern RTL synthesis.' },
  ],
  3: [
    { title: '1958 · THE INTEGRATED CIRCUIT', body: 'Jack Kilby and Robert Noyce independently developed ways to place multiple components on one substrate. Noyce’s planar approach made practical mass production possible.' },
    { title: 'WHY HIERARCHY WON', body: 'Large chips are built as modules because no engineer can reason about billions of devices at once. Hierarchy lets teams verify contracts locally, then integrate them into systems.' },
  ],
  4: [
    { title: '1994 · PENTIUM FDIV', body: 'A few missing lookup-table entries caused rare floating-point division errors in the Pentium processor. The recall cost Intel hundreds of millions of dollars and made exhaustive verification a boardroom concern.' },
    { title: 'THE CRITICAL PATH', body: 'A synchronous chip can clock only as fast as its slowest register-to-register logic path. Faster arithmetic often spends extra area to compute carries and choices in parallel.' },
  ],
  5: [
    { title: 'SETUP AND HOLD ARE PHYSICAL', body: 'A flip-flop needs data stable around its sampling edge. Violating that aperture can cause metastability: an analog indecision that digital simulation cannot model away.' },
    { title: 'CLOCK TREES', body: 'A modern clock network drives enormous capacitance while trying to reach every register at nearly the same time. Clock-tree synthesis balances delay, power, skew, and routing congestion.' },
  ],
  6: [
    { title: 'THE CONTROLLER/DATAPATH SPLIT', body: 'Processors and accelerators often separate a datapath that transforms values from a controller that sequences operations. FSMs are the compact language of that control.' },
    { title: 'THE ARIANE 5 LESSON', body: 'A reused conversion overflowed during Ariane 5’s first launch, causing both redundant inertial systems to fail identically. Redundancy does not help when duplicated logic shares the same assumption.' },
  ],
  7: [
    { title: 'WHY FABS COST BILLIONS', body: 'Leading-edge fabrication combines extreme-ultraviolet optics, atom-scale process control, ultrapure materials, and enormous facilities. Design data is cheap to copy; manufacturing precision is not.' },
    { title: 'GDSII TO SILICON', body: 'Tapeout releases the final geometric database for mask preparation and fabrication. After that handoff, a logic mistake is no longer a quick rebuild—it is physical silicon and calendar time.' },
  ],
};

const WORLD_LANDMARKS = {
  1: 'The Wyrm Cathedral',
  2: 'The Universal Monolith',
  3: 'The Foundry Stack',
  4: 'The Encoder Colossus',
  5: 'The Clock Crown',
  6: 'The State Keep',
  7: 'The Golden Wafer',
};

function featureCandidates(model) {
  const boss = model.interactables.find((item) => item.boss);
  const usable = model.rects.filter((rect) =>
    rect.zone !== model.bossZone &&
    !(boss && boss.x > rect.x1 && boss.x < rect.x2 && boss.z > rect.z1 && boss.z < rect.z2));
  const points = [];
  for (const rect of usable) {
    const width = rect.x2 - rect.x1;
    const depth = rect.z2 - rect.z1;
    const marginX = Math.min(2, width * 0.2);
    const marginZ = Math.min(2, depth * 0.2);
    for (const fx of [0.12, 0.3, 0.5, 0.7, 0.88]) {
      for (const fz of [0.12, 0.3, 0.5, 0.7, 0.88]) {
        points.push({
          x: rect.x1 + marginX + (width - marginX * 2) * fx,
          z: rect.z1 + marginZ + (depth - marginZ * 2) * fz,
        });
      }
    }
  }
  const occupied = model.interactables.concat([{ x: model.spawn.x, z: model.spawn.z }]);
  const gate = model.gateCollider;
  const gateHorizontal = gate && (gate.maxX - gate.minX) > (gate.maxZ - gate.minZ);
  const gateAxis = gateHorizontal
    ? (gate.minZ + gate.maxZ) / 2
    : gate
      ? (gate.minX + gate.maxX) / 2
      : 0;
  const spawnSide = gateHorizontal
    ? model.spawn.z - gateAxis
    : model.spawn.x - gateAxis;
  return points.filter((point, index) => {
    if (points.findIndex((other) => other.x === point.x && other.z === point.z) !== index) return false;
    if (gate) {
      const pointSide = gateHorizontal ? point.z - gateAxis : point.x - gateAxis;
      if (pointSide * spawnSide < 0) return false;
    }
    return occupied.every((item) => Math.hypot(item.x - point.x, item.z - point.z) >= 5);
  });
}

function withExploration(model, world) {
  if (model.exploration) return model;
  const candidates = featureCandidates(model);
  if (candidates.length < 6) {
    throw new Error(`World ${world} has only ${candidates.length} safe exploration feature positions`);
  }
  candidates.sort((a, b) =>
    Math.hypot(a.x - model.spawn.x, a.z - model.spawn.z) -
    Math.hypot(b.x - model.spawn.x, b.z - model.spawn.z));
  const chosen = [];
  const desired = [0, 0.28, 0.48, 0.65, 0.8, 1];
  const addCandidate = (candidate) => {
    if (!candidate || chosen.includes(candidate)) return false;
    if (chosen.some((other) => Math.hypot(other.x - candidate.x, other.z - candidate.z) < 5)) return false;
    chosen.push(candidate);
    return true;
  };
  desired.forEach((fraction) => {
    const start = Math.min(candidates.length - 1, Math.floor(fraction * (candidates.length - 1)));
    for (let offset = 0; offset < candidates.length; offset++) {
      if (addCandidate(candidates[(start + offset) % candidates.length])) break;
    }
  });
  candidates.forEach((candidate) => { if (chosen.length < 6) addCandidate(candidate); });
  if (chosen.length < 6) {
    throw new Error(`World ${world} cannot place six exploration features 5u apart`);
  }
  const lore = WORLD_LORE[world];
  const features = [
    {
      id: `grace_${world}`, kind: 'grace', world,
      x: chosen[0].x, z: chosen[0].z, r: 2.7,
      title: 'TRACE GRACE', prompt: 'SYNC CHECKPOINT',
    },
    ...lore.map((entry, index) => ({
      id: `lore_${world}_${index + 1}`, kind: 'lore', world,
      x: chosen[index + 1].x, z: chosen[index + 1].z, r: 2.5,
      title: entry.title, body: entry.body, prompt: 'READ CHIP HISTORY',
    })),
    ...[0, 1, 2].map((index) => ({
      id: `cache_${world}_${index + 1}`, kind: 'cache', world,
      x: chosen[index + 3].x, z: chosen[index + 3].z, r: 2.2,
      scrap: 12 + world * 3 + index * 4, prompt: 'RECOVER SCRAP CACHE',
    })),
  ];
  model.interactables.push(...features);
  model.exploration = {
    features,
    landmark: WORLD_LANDMARKS[world],
    elevationZones: chosen.slice(4, 6)
      .map((point, index) => ({
        x: point.x,
        z: point.z,
        radius: 4.5 + index * 1.5,
        height: 1.2 + index * 1.1,
      })),
  };
  return model;
}

function explorationState(save) {
  const state = save.exploration || {};
  return {
    graces: state.graces || {},
    lore: state.lore || {},
    caches: state.caches || {},
    discovered: state.discovered || {},
  };
}

function featureComplete(save, feature) {
  const state = explorationState(save);
  if (feature.kind === 'grace') return !!state.graces[feature.id];
  if (feature.kind === 'lore') return !!state.lore[feature.id];
  if (feature.kind === 'cache') return !!state.caches[feature.id];
  return false;
}

function elevationAt(model, x, z) {
  let elevation = 0;
  for (const zone of model.exploration?.elevationZones || []) {
    const distance = Math.hypot(x - zone.x, z - zone.z);
    if (distance >= zone.radius) continue;
    const t = 1 - distance / zone.radius;
    elevation = Math.max(elevation, zone.height * t * t * (3 - 2 * t));
  }
  return elevation;
}

export {
  WORLD_LANDMARKS,
  WORLD_LORE,
  explorationState,
  elevationAt,
  featureComplete,
  withExploration,
};

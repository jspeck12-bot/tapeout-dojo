import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { pbrMaterial, roundedBoxGeometry, finalizeWorldMaterials } from './materials.js';

const WORLD_ART = {
  0: { name: 'Fab Campus', top: 0x030713, horizon: 0x123549, key: 0x7defff, path: 0xffc76b, rim: 0x9b7dff, prop: 0x24364a, dust: 0x7defff, density: 54, surface: 'silicon', fog: 0.006, exposure: 1.08 },
  1: { name: 'Bit Mines', top: 0x050201, horizon: 0x3a1908, key: 0xffb35c, path: 0xffb35c, rim: 0x54d9ff, prop: 0x3e2e20, dust: 0xffc76b, density: 72, surface: 'wetRock', fog: 0.042, exposure: 0.98 },
  2: { name: 'Gate Valley', top: 0x07131c, horizon: 0xb87338, key: 0xffc46b, path: 0xffd58a, rim: 0x7defff, prop: 0x3a4036, dust: 0xe8d39a, density: 64, surface: 'sandstone', fog: 0.0065, exposure: 1.12 },
  3: { name: 'Module Foundry', top: 0x080303, horizon: 0x55200d, key: 0xff6b24, path: 0xff9a55, rim: 0x22d3ee, prop: 0x412720, dust: 0xff7a32, density: 76, surface: 'wornSteel', fog: 0.025, exposure: 1.02 },
  4: { name: 'Combinational Canyon', top: 0x08101a, horizon: 0x86a3b4, key: 0xffa14a, path: 0xffc47a, rim: 0x9edfff, prop: 0x5a4028, dust: 0xd7e7ed, density: 58, surface: 'sandstone', fog: 0.009, exposure: 1.13 },
  5: { name: 'Clock Tower', top: 0x02040a, horizon: 0x16253e, key: 0xd9a441, path: 0xffcf70, rim: 0x5bd9ff, prop: 0x3c3228, dust: 0xc9d7de, density: 68, surface: 'brass', fog: 0.024, exposure: 0.98 },
  6: { name: 'FSM Fortress', top: 0x050208, horizon: 0x2e1935, key: 0xe7dce9, path: 0xfb7185, rim: 0xc4b5fd, prop: 0x36323a, dust: 0xd8c9df, density: 56, surface: 'concrete', fog: 0.027, exposure: 0.94 },
  7: { name: 'TAPEOUT', top: 0x020407, horizon: 0x202930, key: 0xf6e4a6, path: 0xfacc15, rim: 0x7defff, prop: 0x46515c, dust: 0xe8e1ca, density: 42, surface: 'silicon', fog: 0.015, exposure: 0.96 },
  8: { name: 'Signal Arcade', top: 0x03020a, horizon: 0x28113a, key: 0xff7df0, path: 0x7defff, rim: 0x22d3ee, prop: 0x241a32, dust: 0xc68cff, density: 60, surface: 'paintedMetal', fog: 0.019, exposure: 1.04 },
};

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function skyMaterial(config) {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(config.top) },
      horizonColor: { value: new THREE.Color(config.horizon) },
      glowColor: { value: new THREE.Color(config.key) },
    },
    vertexShader: [
      'varying vec3 vWorld;',
      'void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld=world.xyz;',
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor;',
      'varying vec3 vWorld;',
      'void main(){ vec3 d=normalize(vWorld-cameraPosition);',
      'float h=smoothstep(-0.18,0.72,d.y);',
      'float sun=pow(max(0.0,dot(d,normalize(vec3(-0.45,0.3,-0.7)))),18.0);',
      'vec3 c=mix(horizonColor,topColor,h)+glowColor*sun*0.22;',
      'gl_FragColor=vec4(c,1.0); }',
    ].join('\n'),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

function worldCenter(model) {
  return {
    x: (model.bounds.minX + model.bounds.maxX) / 2,
    z: (model.bounds.minZ + model.bounds.maxZ) / 2,
    span: Math.max(model.bounds.maxX - model.bounds.minX, model.bounds.maxZ - model.bounds.minZ),
  };
}

function makeLandmark(world, config) {
  const group = new THREE.Group();
  const structuralSurface = world === 1 ? 'wetRock'
    : world === 2 || world === 4 ? 'sandstone'
      : world === 5 ? 'brass'
        : world === 6 ? 'concrete'
          : world === 7 || world === 0 ? 'silicon' : 'wornSteel';
  const structure = pbrMaterial(structuralSurface, config.prop, {
    roughness: world === 1 || world === 2 || world === 4 || world === 6 ? 0.82 : 0.44,
    metalness: world === 1 || world === 2 || world === 4 || world === 6 ? 0.08 : 0.72,
    emissive: config.rim,
    emissiveIntensity: 0.055,
    repeat: 2,
  });
  const trim = pbrMaterial(world === 5 ? 'brass' : 'wornSteel', world === 5 ? 0x8f6b2e : 0x607080, {
    roughness: 0.32,
    metalness: 0.82,
  });
  const light = new THREE.MeshStandardMaterial({
    color: config.key,
    emissive: config.key,
    emissiveIntensity: 3.2,
    roughness: 0.24,
    metalness: 0.28,
    toneMapped: false,
  });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z, radius = 0.18) =>
    add(roundedBoxGeometry(w, h, d, radius, 2), material, x, y, z);
  const arch = (x, z, width, height, depth = 1.2, material = structure) => {
    box(depth, height, depth, material, x - width / 2, height / 2, z, 0.12);
    box(depth, height, depth, material, x + width / 2, height / 2, z, 0.12);
    box(width + depth, depth, depth, material, x, height, z, 0.12);
  };
  const gear = (radius, tube, x, y, z, material, axis = 'z') => {
    const ring = add(new THREE.TorusGeometry(radius, tube, 10, 48), material, x, y, z);
    if (axis === 'y') ring.rotation.x = Math.PI / 2;
    else if (axis === 'x') ring.rotation.y = Math.PI / 2;
    ring.userData.spin = axis === 'y' ? 0.11 : 0.18;
    return ring;
  };

  if (world === 1) {
    for (let index = -3; index <= 3; index++) {
      const crystal = add(new THREE.OctahedronGeometry(0.9 + Math.abs(index) * 0.09, 0), index ? structure : light, index * 2.2, 4.2 + Math.abs(index) * 0.55, 0);
      crystal.scale.y = 4.1 - Math.abs(index) * 0.22;
    }
    for (let index = -2; index <= 2; index++) {
      arch(0, index * 3.4, 14 - Math.abs(index) * 0.8, 11 + Math.abs(index), 0.55, trim);
    }
  } else if (world === 2) {
    [-11, 0, 11].forEach((x, index) => {
      arch(x, index * -2.5, 8, 18 + index * 5, 2.2, structure);
      const rune = box(4.8, 0.34, 0.18, light, x, 14 + index * 4.5, 1.18 - index * 2.5, 0.08);
      rune.rotation.z = index === 1 ? 0.08 : -0.05;
    });
  } else if (world === 3) {
    [-6, 0, 6].forEach((x, index) => {
      add(new THREE.CylinderGeometry(1.4, 2.1, 20 + index * 4, 12), structure, x, 10 + index * 2, 0);
      add(new THREE.ConeGeometry(1.9, 3.2, 12), trim, x, 21.6 + index * 4, 0);
      box(2.7, 0.65, 0.5, light, x, 6 + index * 2.2, 2.05, 0.12);
    });
    box(18, 1.2, 3.4, trim, 0, 15, 0, 0.3);
    add(new THREE.CylinderGeometry(3.3, 2.7, 4, 16), light, 0, 2, 6);
  } else if (world === 4) {
    box(3.2, 16, 3.2, structure, -5, 8, 0, 0.4);
    box(3.2, 16, 3.2, structure, 5, 8, 0, 0.4);
    box(12, 10, 5.2, structure, 0, 18, 0, 0.65);
    box(20, 2.4, 2.6, structure, 0, 19.5, 0, 0.3);
    add(new THREE.IcosahedronGeometry(2.4, 1), light, 0, 23.6, 0);
    [-1, 1].forEach(side => box(1.1, 13, 1.1, trim, side * 9.3, 13.2, 0, 0.18));
  } else if (world === 5) {
    box(2.6, 25, 2.6, structure, 0, 12.5, -2.4, 0.28);
    [3.4, 5.4, 7.4].forEach((radius, index) => {
      const ring = gear(radius, index === 1 ? 0.4 : 0.28, 0, 13, 0, index === 1 ? light : trim);
      ring.rotation.set(index * 0.34, index * 0.22, index * 0.08);
      ring.userData.spin = (index % 2 ? -1 : 1) * (0.2 + index * 0.05);
    });
    const pendulum = box(0.5, 13, 0.5, trim, 0, 6.5, 1, 0.14);
    pendulum.userData.pendulum = true;
    add(new THREE.SphereGeometry(1.6, 20, 14), light, 0, 0.8, 1);
  } else if (world === 6) {
    [-6, 6].forEach(x => {
      box(4.4, 22, 4.4, structure, x, 11, 0, 0.45);
      add(new THREE.OctahedronGeometry(2.7, 0), light, x, 24.2, 0);
    });
    box(12, 10, 5.5, structure, 0, 5, 0, 0.6);
    [-1, 0, 1].forEach((offset, index) => {
      const slab = box(16 - index * 2, 1.1, 4, index === 1 ? trim : structure, 0, 10.5 + index * 3.1, offset * 2, 0.18);
      slab.userData.stateSlab = index;
    });
  } else if (world === 7) {
    const wafer = add(new THREE.CylinderGeometry(7.5, 7.5, 0.72, 64), structure, 0, 13, 0);
    wafer.rotation.z = Math.PI / 2;
    wafer.userData.wafer = true;
    gear(9.5, 0.2, 0, 13, 0, light);
    for (let index = -3; index <= 3; index++) {
      if (!index) continue;
      box(1.2, 18 - Math.abs(index) * 1.4, 1.2, structure, index * 4.1, 9, 4, 0.18);
    }
    box(20, 1.4, 7, trim, 0, 1.2, 0, 0.28);
  } else if (world === 8) {
    arch(0, 0, 18, 13, 1.5, structure);
    box(14, 3.6, 1.0, trim, 0, 10.5, 0, 0.38);
    for (let index = -4; index <= 4; index++) {
      add(new THREE.OctahedronGeometry(0.55, 0), index % 2 ? light : trim, index * 1.5, 10.5 + Math.sin(index) * 0.6, 0.8);
    }
  } else {
    const die = box(12, 1.2, 12, structure, 0, 11, 0, 0.55);
    die.rotation.set(0.25, 0.35, 0.12);
    gear(8.5, 0.2, 0, 11, 0, light);
    arch(0, 2, 22, 20, 1.8, trim);
  }
  group.userData.landmark = true;
  group.userData.identity = config.name;
  return group;
}

function addInstancedDetail(scene, model, config, world, low) {
  const count = low ? 16 : Math.min(96, Math.round(config.density * (model.worldScale || 1)));
  const geometry = world === 3 || world === 6 || world === 7 || world === 8
    ? roundedBoxGeometry(0.7, 1.8, 0.7, 0.12, 1)
    : world === 5
      ? new THREE.CylinderGeometry(0.42, 0.56, 1.8, 8)
      : new THREE.IcosahedronGeometry(0.55, 1);
  const material = pbrMaterial(config.surface, config.prop, {
    roughness: world === 3 || world === 5 || world === 7 ? 0.48 : 0.86,
    metalness: world === 3 || world === 5 || world === 7 || world === 8 ? 0.58 : 0.1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seeded(0x51c0 + world * 977);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const path = model.path || [];
  const nodes = model.interactables || [];
  const inside = (x, z) => !model.rects || model.rects.some(rect =>
    x > rect.x1 + 1.5 && x < rect.x2 - 1.5 && z > rect.z1 + 1.5 && z < rect.z2 - 1.5);
  const distanceToSegment = (x, z, a, b) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq)) : 0;
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
  };
  const clear = (x, z) => {
    if (!inside(x, z)) return false;
    if (model.spawn && Math.hypot(x - model.spawn.x, z - model.spawn.z) < 11) return false;
    if (nodes.some(node => Math.hypot(x - node.x, z - node.z) < 6.5)) return false;
    for (let index = 0; index < path.length - 1; index++) {
      if (distanceToSegment(x, z, path[index], path[index + 1]) < 5.4) return false;
    }
    return true;
  };
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 30) {
    attempts++;
    const x = model.bounds.minX + random() * (model.bounds.maxX - model.bounds.minX);
    const z = model.bounds.minZ + random() * (model.bounds.maxZ - model.bounds.minZ);
    if (!clear(x, z)) continue;
    const scale = 0.55 + random() * 1.5;
    matrix.compose(
      new THREE.Vector3(x, 0.35 * scale, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * 0.4, random() * Math.PI, random() * 0.3)),
      new THREE.Vector3(scale, scale, scale),
    );
    mesh.setMatrixAt(placed, matrix);
    color.setHex(config.prop).offsetHSL((random() - 0.5) * 0.025, (random() - 0.5) * 0.08, (random() - 0.5) * 0.16);
    mesh.setColorAt(placed, color);
    placed++;
  }
  while (placed < count) {
    matrix.makeScale(0, 0, 0);
    mesh.setMatrixAt(placed, matrix);
    placed++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = !low;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addAtmosphere(scene, model, config, world, low) {
  const count = low ? 40 : Math.min(180, Math.round(120 * (model.worldScale || 1)));
  const positions = new Float32Array(count * 3);
  const random = seeded(0xa710 + world * 313);
  for (let index = 0; index < count; index++) {
    positions[index * 3] = model.bounds.minX + random() * (model.bounds.maxX - model.bounds.minX);
    positions[index * 3 + 1] = 0.8 + random() * 14;
    positions[index * 3 + 2] = model.bounds.minZ + random() * (model.bounds.maxZ - model.bounds.minZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: config.dust,
    size: world === 3 ? 0.2 : 0.12,
    transparent: true,
    opacity: world === 7 ? 0.2 : 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = true;
  scene.add(particles);
  return particles;
}

function addLightShaft(scene, x, z, color, span) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.014,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const shaft = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(5, span * 0.08), Math.max(24, span * 0.35), 24, 1, true),
    material,
  );
  shaft.position.set(x, Math.max(12, span * 0.18), z);
  shaft.rotation.z = 0.08;
  shaft.renderOrder = 3;
  scene.add(shaft);
  return shaft;
}

function pathBasis(model) {
  const spawn = model.spawn || model.path?.[0] || { x: 0, z: 0 };
  const target = model.path?.find(point => Math.hypot(point.x - spawn.x, point.z - spawn.z) > 4)
    || model.path?.[model.path.length - 1]
    || { x: spawn.x, z: spawn.z - 1 };
  const length = Math.hypot(target.x - spawn.x, target.z - spawn.z) || 1;
  const forward = { x: (target.x - spawn.x) / length, z: (target.z - spawn.z) / length };
  return { spawn, forward, side: { x: -forward.z, z: forward.x } };
}

function emissiveMaterial(color, intensity = 2.4) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.28,
    metalness: 0.24,
    toneMapped: false,
  });
}

function addForegroundFrame(scene, model, config, world) {
  const { spawn, forward, side } = pathBasis(model);
  const distance = world === 0 ? 12 : 7;
  const width = world === 1 ? 10 : world === 7 ? 12 : 15;
  const height = world === 1 ? 5.2 : world === 7 ? 13 : 9;
  const center = {
    x: spawn.x + forward.x * distance,
    z: spawn.z + forward.z * distance,
  };
  const group = new THREE.Group();
  group.position.set(center.x, 0, center.z);
  group.rotation.y = Math.atan2(forward.x, forward.z);
  const frameSurface = world === 1 ? 'wetRock'
    : world === 2 || world === 4 ? 'sandstone'
      : world === 5 ? 'brass'
        : world === 0 || world === 7 ? 'silicon' : 'concrete';
  const frameMaterial = pbrMaterial(frameSurface, new THREE.Color(config.prop).multiplyScalar(0.52), {
    roughness: world === 5 || world === 7 ? 0.48 : 0.88,
    metalness: world === 5 || world === 7 || world === 0 ? 0.55 : 0.08,
    repeat: 2,
  });
  const pillarGeometry = roundedBoxGeometry(1.3, height, 1.5, 0.2, 2);
  [-1, 1].forEach(sign => {
    const pillar = new THREE.Mesh(pillarGeometry, frameMaterial);
    pillar.position.set(sign * width / 2, height / 2, 0);
    pillar.rotation.z = sign * (world === 1 ? 0.06 : 0);
    pillar.castShadow = pillar.receiveShadow = true;
    group.add(pillar);
  });
  const lintel = new THREE.Mesh(roundedBoxGeometry(width + 1.3, 1.2, 1.6, 0.2, 2), frameMaterial);
  lintel.position.y = height;
  lintel.castShadow = true;
  group.add(lintel);
  const signal = new THREE.Mesh(
    roundedBoxGeometry(width * 0.56, 0.16, 0.12, 0.05, 1),
    emissiveMaterial(config.rim, 1.8),
  );
  signal.position.set(0, height - 0.66, 0.84);
  group.add(signal);
  group.userData.foregroundFrame = true;
  group.userData.side = side;
  scene.add(group);
  return group;
}

function addPathLighting(scene, model, config, low) {
  const group = new THREE.Group();
  const path = model.path || [];
  const material = emissiveMaterial(config.path, 2.8);
  const ringGeometry = new THREE.RingGeometry(0.7, 1.12, 24);
  const lights = [];
  path.forEach((point, index) => {
    if (index === 0) return;
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, 0.055, point.z);
    ring.scale.setScalar(index === path.length - 1 ? 1.7 : 1);
    group.add(ring);
    if (!low && (index % 2 === 1 || index === path.length - 1) && lights.length < 6) {
      const light = new THREE.PointLight(config.path, index === path.length - 1 ? 2.4 : 1.15, index === path.length - 1 ? 34 : 18, 2);
      light.position.set(point.x, index === path.length - 1 ? 4.8 : 2.2, point.z);
      light.userData.motivated = true;
      scene.add(light);
      lights.push(light);
    }
  });
  group.userData.pathLighting = true;
  scene.add(group);
  return { group, lights };
}

function addInstancedColumns(scene, placements, geometry, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const matrix = new THREE.Matrix4();
  placements.forEach((placement, index) => {
    matrix.compose(
      new THREE.Vector3(placement.x, placement.y, placement.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(placement.rx || 0, placement.ry || 0, placement.rz || 0)),
      new THREE.Vector3(placement.sx || 1, placement.sy || 1, placement.sz || 1),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addWorldSetPieces(scene, model, config, world, low) {
  const group = new THREE.Group();
  const path = model.path || [];
  const dark = pbrMaterial(config.surface, new THREE.Color(config.prop).multiplyScalar(0.74), {
    roughness: world === 3 || world === 5 || world === 7 || world === 8 ? 0.46 : 0.86,
    metalness: world === 3 || world === 5 || world === 7 || world === 8 ? 0.6 : 0.08,
    repeat: 2,
  });
  const metal = pbrMaterial(world === 5 ? 'brass' : 'wornSteel', world === 5 ? 0x8d6a33 : 0x46515d, {
    roughness: 0.38,
    metalness: 0.78,
  });
  const glow = emissiveMaterial(config.key, 3);
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const end = path[path.length - 1] || { x: 0, z: 0 };

  if (world === 1) {
    const placements = [];
    for (let index = -3; index <= 3; index++) {
      placements.push({ x: end.x - 9, y: 7.5, z: end.z + index * 4.4, rz: -0.08 });
      placements.push({ x: end.x + 9, y: 7.5, z: end.z + index * 4.4, rz: 0.08 });
    }
    addInstancedColumns(scene, placements, roundedBoxGeometry(1.4, 15, 1.4, 0.24, 2), dark);
    for (let index = -2; index <= 2; index++) {
      const vein = add(new THREE.TorusGeometry(5.8 + Math.abs(index), 0.12, 8, 48, Math.PI), glow, end.x, 8 + Math.abs(index), end.z + index * 4.6);
      vein.rotation.z = Math.PI;
    }
  } else if (world === 2) {
    const placements = [];
    const { forward, side } = pathBasis(model);
    for (let index = 0; index < 6; index++) {
      const distance = 24 + index * 18;
      [-1, 1].forEach(sign => placements.push({
        x: model.spawn.x + forward.x * distance + side.x * sign * (19 + index * 2),
        y: 8 + index * 1.5,
        z: model.spawn.z + forward.z * distance + side.z * sign * (19 + index * 2),
        sy: 1 + index * 0.1,
      }));
    }
    addInstancedColumns(scene, placements, roundedBoxGeometry(3.4, 16, 3.4, 0.38, 2), dark);
  } else if (world === 3) {
    const placements = [];
    path.slice(1, -1).forEach((point, index) => {
      [-1, 1].forEach(sign => placements.push({ x: point.x + sign * 8, y: 8 + (index % 2) * 2, z: point.z, sy: 1 + (index % 2) * 0.2 }));
    });
    addInstancedColumns(scene, placements, new THREE.CylinderGeometry(1.15, 1.5, 16, 10), metal);
    path.slice(1, -1).forEach((point, index) => {
      const furnace = add(roundedBoxGeometry(5.5, 4.5, 2.2, 0.35, 2), dark, point.x + (index % 2 ? 7 : -7), 2.25, point.z + 4);
      const mouth = new THREE.Mesh(roundedBoxGeometry(3.4, 2.2, 0.15, 0.24, 2), glow);
      mouth.position.set(0, 0, 1.16);
      furnace.add(mouth);
    });
  } else if (world === 4) {
    const layers = [0, 1, 2, 3];
    layers.forEach(index => {
      const wall = add(roundedBoxGeometry(38 + index * 18, 4 + index * 2.4, 3.2, 0.6, 2), dark,
        end.x - 12 + index * 8, 2 + index * 1.2, end.z - 30 - index * 14);
      wall.material = dark;
      wall.userData.strata = index;
    });
  } else if (world === 5) {
    path.slice(1, -1).forEach((point, index) => {
      const radius = 2.5 + index % 3;
      const gear = add(new THREE.TorusGeometry(radius, 0.3, 10, 40), index % 2 ? metal : glow,
        point.x + (index % 2 ? 6 : -6), 3.6 + radius * 0.25, point.z);
      gear.rotation.y = index % 2 ? Math.PI / 2 : 0;
      gear.userData.clockGear = (index % 2 ? -1 : 1) * (0.28 + index * 0.03);
    });
  } else if (world === 6) {
    path.slice(1, -1).forEach((point, index) => {
      const slab = add(roundedBoxGeometry(9 + (index % 3) * 3, 7, 2.8, 0.28, 2), dark,
        point.x + (index % 2 ? 7 : -7), 3.5, point.z);
      slab.userData.stateArchitecture = { phase: index * 0.8, baseX: slab.position.x, baseY: slab.position.y };
    });
  } else if (world === 7) {
    const placements = [];
    path.slice(1).forEach((point, index) => {
      [-1, 1].forEach(sign => placements.push({ x: point.x + sign * 7.6, y: 6.5, z: point.z, sy: 1 + index * 0.08 }));
    });
    addInstancedColumns(scene, placements, roundedBoxGeometry(1.2, 13, 1.2, 0.2, 2), dark);
    path.slice(1).forEach(point => {
      const trace = add(roundedBoxGeometry(11, 0.1, 0.16, 0.04, 1), glow, point.x, 0.08, point.z);
      trace.rotation.y = Math.PI / 2;
    });
  } else if (world === 8) {
    const placements = [];
    for (let index = 0; index < 10; index++) {
      placements.push({ x: -18 + (index % 2) * 36, y: 2.5, z: -18 + Math.floor(index / 2) * 9 });
    }
    addInstancedColumns(scene, placements, roundedBoxGeometry(1.1, 5, 1.1, 0.16, 2), dark);
  } else {
    const placements = [];
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2;
      placements.push({ x: Math.cos(angle) * 38, y: 8, z: Math.sin(angle) * 38, ry: -angle });
    }
    addInstancedColumns(scene, placements, roundedBoxGeometry(2.2, 16, 2.2, 0.3, 2), dark);
  }

  group.userData.setPieces = true;
  scene.add(group);
  return group;
}

function addGroundMist(scene, model, config, low) {
  const center = worldCenter(model);
  const count = low ? 3 : 6;
  const group = new THREE.Group();
  for (let index = 0; index < count; index++) {
    const material = new THREE.MeshBasicMaterial({
      color: config.horizon,
      transparent: true,
      opacity: 0.018 + index * 0.004,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(center.span * (0.65 + index * 0.1), center.span * 0.55), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(center.x + (index - count / 2) * 3, 0.45 + index * 0.18, center.z - center.span * 0.08 + index * 4);
    group.add(plane);
  }
  scene.add(group);
  return group;
}

function addGoldenSky(scene, config, center) {
  const sky = new Sky();
  sky.scale.setScalar(center.span * 4 + 500);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 7.5;
  uniforms.rayleigh.value = 1.4;
  uniforms.mieCoefficient.value = 0.008;
  uniforms.mieDirectionalG.value = 0.82;
  uniforms.sunPosition.value.set(-0.62, 0.16, -0.77).normalize();
  sky.position.set(center.x, 0, center.z);
  sky.userData.goldenSky = true;
  scene.add(sky);
  return sky;
}

function buildWorldArt(scene, model, world) {
  if (scene.userData.worldArt) return scene.userData.worldArt;
  const config = WORLD_ART[world];
  if (!config) throw new Error(`Missing art direction for world ${world}`);
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const center = worldCenter(model);
  const fogColor = new THREE.Color(config.top).lerp(new THREE.Color(config.horizon), world === 2 || world === 4 ? 0.72 : 0.38);
  scene.fog = new THREE.FogExp2(fogColor, config.fog / Math.max(1, model.worldScale || 1));
  scene.background = fogColor.clone();

  let sky;
  if (world === 2) {
    sky = addGoldenSky(scene, config, center);
  } else {
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(center.span * 1.8 + 80, 32, 18),
      skyMaterial(config),
    );
    sky.position.set(center.x, 0, center.z);
    sky.frustumCulled = false;
    scene.add(sky);
  }

  const landmark = makeLandmark(world, config);
  const landmarkPoint = model.path?.[Math.max(0, model.path.length - 1)]
    || model.interactables?.find(item => item.boss)
    || { x: center.x, z: center.z };
  landmark.position.set(landmarkPoint.x, 0, landmarkPoint.z);
  scene.add(landmark);

  const frame = addForegroundFrame(scene, model, config, world);
  const pathLighting = addPathLighting(scene, model, config, low);
  const setPieces = addWorldSetPieces(scene, model, config, world, low);
  const detail = addInstancedDetail(scene, model, config, world, low);
  const atmosphere = addAtmosphere(scene, model, config, world, low);
  const mist = addGroundMist(scene, model, config, low);
  const shaft = addLightShaft(scene, landmarkPoint.x, landmarkPoint.z, config.key, center.span);
  const fillIntensity = world === 3 || world === 5 ? 0.82
    : world === 6 || world === 7 ? 0.46
      : world === 1 ? 0.56 : 0.62;
  const fill = new THREE.HemisphereLight(config.horizon, config.top, fillIntensity);
  fill.userData.lightRole = 'fill';
  scene.add(fill);

  const key = new THREE.DirectionalLight(config.key, low ? 1.2 : 2.15);
  key.position.set(center.x + center.span * 0.34, Math.max(28, center.span * 0.55), center.z + center.span * 0.18);
  key.target.position.set(center.x, 0, center.z - center.span * 0.12);
  key.userData.lightRole = 'key';
  if (!low) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const shadowSpan = Math.min(150, center.span * 0.68 + 18);
    key.shadow.camera.left = key.shadow.camera.bottom = -shadowSpan;
    key.shadow.camera.right = key.shadow.camera.top = shadowSpan;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = center.span * 2.2 + 100;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.42;
  }
  scene.add(key, key.target);

  const coolFill = new THREE.DirectionalLight(config.rim, low ? 0.28 : 0.62);
  coolFill.position.set(center.x - center.span * 0.3, Math.max(16, center.span * 0.24), center.z - center.span * 0.16);
  coolFill.target.position.set(center.x, 4, center.z);
  coolFill.userData.lightRole = 'cool-fill';
  scene.add(coolFill, coolFill.target);

  const spawnGlow = new THREE.PointLight(config.path, low ? 0.25 : fillIntensity * 0.72, Math.max(24, center.span * 0.24), 2);
  const spawn = model.spawn || center;
  spawnGlow.position.set(spawn.x, 5, spawn.z);
  spawnGlow.userData.lightRole = 'spawn-lure';
  scene.add(spawnGlow);
  const rim = new THREE.DirectionalLight(config.rim, low ? 0.62 : 1.28);
  rim.position.set(center.x - center.span * 0.25, center.span * 0.45, center.z + center.span * 0.2);
  rim.target.position.set(landmarkPoint.x, 6, landmarkPoint.z);
  rim.userData.lightRole = 'rim';
  scene.add(rim, rim.target);

  const animations = scene.userData.anims = scene.userData.anims || [];
  animations.push((time, delta) => {
    landmark.traverse(object => {
      if (object.userData.spin) object.rotation.z += object.userData.spin * delta;
      if (object.userData.pendulum) object.rotation.z = Math.sin(time * 0.92) * 0.32;
      if (object.userData.stateSlab != null) {
        const phase = object.userData.stateSlab;
        object.position.x = Math.sin(time * 0.34 + phase * 1.7) * (phase + 1) * 0.55;
      }
      if (object.userData.wafer) object.rotation.x = Math.sin(time * 0.18) * 0.08;
    });
    setPieces.traverse(object => {
      if (object.userData.clockGear) object.rotation.z += object.userData.clockGear * delta;
      if (object.userData.stateArchitecture) {
        const state = object.userData.stateArchitecture;
        object.position.y = state.baseY + Math.max(0, Math.sin(time * 0.3 + state.phase)) * 1.8;
        object.position.x = state.baseX + Math.sin(time * 0.16 + state.phase) * 0.7;
      }
    });
    atmosphere.rotation.y = time * 0.004;
    shaft.material.opacity = 0.012 + Math.sin(time * 0.7) * 0.004;
    mist.position.x = Math.sin(time * 0.035) * 3;
  });

  const materialCoverage = finalizeWorldMaterials(scene, world);
  const art = {
    world,
    name: config.name,
    palette: config,
    landmark,
    frame,
    pathLighting,
    setPieces,
    detail,
    atmosphere,
    mist,
    shaft,
    key,
    fill,
    coolFill,
    spawnGlow,
    rim,
    quality: low ? 'low' : 'high',
    materialCoverage,
    grade: {
      saturation: world === 6 ? 0.82 : world === 2 || world === 7 ? 0.94 : 1.04,
      contrast: world === 0 ? 1.08 : world === 7 ? 1.16 : 1.12,
      tint: new THREE.Color(config.horizon).lerp(new THREE.Color(0xffffff), 0.82).getHex(),
      lift: world === 1 || world === 6 ? -0.025 : 0,
      gamma: world === 2 || world === 4 ? 0.96 : 1.02,
      gain: world === 7 ? 0.94 : 1.02,
      exposure: config.exposure,
    },
  };
  scene.userData.worldArt = art;
  return art;
}

export { WORLD_ART, buildWorldArt };

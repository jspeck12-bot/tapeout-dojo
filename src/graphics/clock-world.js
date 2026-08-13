import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const CLOCK_PALETTE = {
  void: 0x08060f,
  fog: 0x140e22,
  steel: 0x3a3448,
  plate: 0x241c32,
  brass: 0xb08a4a,
  violet: 0xa78bfa,
  cyan: 0x69e7ff,
  amber: 0xffc76b,
  spill: 0xd4c4ff,
};

const HALL_H = 14.8;
const CROWN = { x: 0, z: -48 };

function gothicLabel(text, color, scale) {
  const label = mineLabelSprite(text, color, scale);
  label.material.toneMapped = false;
  label.material.depthTest = false;
  label.material.opacity = 1;
  label.renderOrder = 24;
  return label;
}

function emissiveSurface(surface, color, intensity, repeat = 2) {
  return pbrMaterial(surface, color, {
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.26,
    metalness: surface === 'silicon' ? 0.62 : 0.28,
    toneMapped: false,
    repeat,
  });
}

function addMesh(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function markSelectiveShadows(scene) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const ghost = materials.some(material => (
      material
      && (material.transparent
        || material.blending === THREE.AdditiveBlending)
    ));
    if (ghost) {
      object.castShadow = false;
      object.receiveShadow = false;
      return;
    }
    object.receiveShadow = true;
    object.castShadow = object.userData.cast === true;
  });
}

function inHall(model, x, z) {
  return model.rects.some(rect => (
    x > rect.x1 + 1.4 && x < rect.x2 - 1.4
    && z > rect.z1 + 1.4 && z < rect.z2 - 1.4
  ));
}

function buildClockLighting(scene, low) {
  const ambient = new THREE.AmbientLight(0x16101f, 0.15);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x4a3a68, 0x120814, 0.22);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(CLOCK_PALETTE.spill, low ? 0.36 : 0.56);
  key.position.set(8, 32, 6);
  key.target.position.set(CROWN.x, 8, CROWN.z);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.5;
  const cam = key.shadow.camera;
  cam.left = -28;
  cam.right = 28;
  cam.top = 36;
  cam.bottom = -16;
  cam.near = 4;
  cam.far = 90;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(CLOCK_PALETTE.violet, low ? 0.14 : 0.26);
  rim.position.set(-22, 18, -62);
  rim.target.position.set(0, 6, -28);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, fill, key, rim };
}

function buildSpawnNave(scene, model, steel, brass) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  const z = model.spawn.z - 9.6;
  [-1, 1].forEach(side => {
    const pier = addMesh(frame, roundedBoxGeometry(1.35, 8.4, 1.6, 0.14, 3), steel, side * 5.8, 4.2, z);
    pier.userData.cast = true;
    const rib = addMesh(frame, roundedBoxGeometry(0.18, 7.0, 0.18, 0.04, 2), brass, side * 5.0, 3.7, z + 0.5);
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(13.2, 0.95, 1.7, 0.12, 3), steel, 0, 8.4, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(6.8, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', CLOCK_PALETTE.violet, 1.35, 1),
    0,
    7.85,
    z + 0.65,
  );
  const title = gothicLabel('CLOCK TOWER', '#A78BFA', 0.9);
  title.position.set(0, 9.55, z + 0.3);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', CLOCK_PALETTE.violet, 0.88, 4);
  const stud = emissiveSurface('silicon', CLOCK_PALETTE.amber, 1.15, 1);
  const path = model.path || [];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const pavement = new THREE.Mesh(
      roundedBoxGeometry(3.2, 0.04, len + 0.3, 0.04, 2),
      pbrMaterial('wornSteel', 0x22182e, {
        roughness: 0.3,
        metalness: 0.68,
        emissive: 0x1a1030,
        emissiveIntensity: 0.16,
        repeat: 3,
      }),
    );
    pavement.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    pavement.rotation.y = Math.atan2(dx, dz);
    pavement.receiveShadow = true;
    group.add(pavement);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(1.05, 0.045, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.36, 0.08, 0.36, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const last = index === path.length - 1;
    const pool = new THREE.PointLight(
      last ? CLOCK_PALETTE.amber : CLOCK_PALETTE.violet,
      last ? 0.95 : 0.46,
      last ? 22 : 12,
      1.8,
    );
    pool.position.set(point.x, last ? 5.4 : 3.1, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildClockCrown(scene, brass, steel) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(CROWN.x, 0, CROWN.z);

  const ring = addMesh(
    landmark,
    new THREE.TorusGeometry(5.6, 0.42, 10, 48),
    brass,
    0,
    10.4,
    0,
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.cast = true;
  const face = addMesh(
    landmark,
    new THREE.CylinderGeometry(4.8, 4.8, 0.28, 40),
    pbrMaterial('silicon', 0x1a1428, {
      roughness: 0.22,
      metalness: 0.62,
      emissive: CLOCK_PALETTE.violet,
      emissiveIntensity: 0.35,
      repeat: 2,
    }),
    0,
    10.4,
    0,
  );
  face.rotation.x = Math.PI / 2;
  const ticks = emissiveSurface('silicon', CLOCK_PALETTE.violet, 1.4, 1);
  for (let index = 0; index < 12; index++) {
    const ang = (index / 12) * Math.PI * 2;
    const tick = addMesh(
      landmark,
      roundedBoxGeometry(index % 3 === 0 ? 0.22 : 0.12, 0.12, 0.7, 0.03, 2),
      ticks,
      Math.sin(ang) * 4.2,
      10.55,
      Math.cos(ang) * 4.2,
    );
    tick.rotation.y = ang;
  }
  const hour = addMesh(landmark, roundedBoxGeometry(0.22, 0.12, 2.4, 0.04, 2), brass, 0, 10.62, 0.9);
  hour.userData.cast = true;
  const minute = addMesh(landmark, roundedBoxGeometry(0.14, 0.1, 3.4, 0.03, 2), ticks, 0, 10.7, 1.2);
  const hub = addMesh(landmark, roundedBoxGeometry(3.6, 1.2, 3.6, 0.12, 3), steel, 0, 12.6, 0);
  hub.userData.cast = true;
  [-1, 1].forEach(side => {
    const gear = addMesh(
      landmark,
      new THREE.TorusGeometry(2.4, 0.28, 8, 28),
      brass,
      side * 7.4,
      8.4,
      1.2,
    );
    gear.userData.cast = true;
    gear.userData.spin = side;
  });
  const under = new THREE.PointLight(CLOCK_PALETTE.violet, 1.55, 36, 2);
  under.position.set(0, 9.2, 2);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);
  landmark.add(fxCone(CLOCK_PALETTE.violet, 3.4, 16, 0.045, 0, 0));
  const marquee = gothicLabel('THE CLOCK CROWN', '#A78BFA', 1.25);
  marquee.position.set(0, 14.4, 1.6);
  landmark.add(marquee);
  scene.add(landmark);
  return { landmark, hour, minute, ring, under };
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: CLOCK_PALETTE.violet,
    transparent: true,
    opacity: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(6.4, 22, 20, 1, true), material);
  shaft.position.set(CROWN.x, 12, CROWN.z);
  shaft.rotation.z = 0.05;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildShell(scene, model, steel, plate) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const fw = (bounds.maxX - bounds.minX) + 20;
  const fd = (bounds.maxZ - bounds.minZ) + 20;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('concrete', CLOCK_PALETTE.plate, {
      roughness: 0.72,
      metalness: 0.14,
      repeat: 8,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('wornSteel', CLOCK_PALETTE.steel, {
      roughness: 0.5,
      metalness: 0.72,
      repeat: 6,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, HALL_H, cz);
  scene.add(ceiling);

  const ribbon = emissiveSurface('silicon', CLOCK_PALETTE.violet, 0.5, 2);
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.4, HALL_H, sz + 0.4),
      length > 36 ? plate : steel,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, HALL_H / 2, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 14) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.18, sx * 0.9), 0.1, Math.max(0.18, sz * 0.9)),
        ribbon,
      );
      bar.position.set(mesh.position.x, 4.2, mesh.position.z);
      scene.add(bar);
    }
  });
}

function buildGears(scene, model, brass, low) {
  const path = model.path || [];
  const items = [];
  const half = 10.6;
  const step = low ? 16 : 12;
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 12) continue;
    const ux = dx / len;
    const uz = dz / len;
    const px = -uz;
    const pz = ux;
    for (let s = 8; s < len - 6; s += step) {
      [-1, 1].forEach(side => {
        const x = a.x + ux * s + px * side * half;
        const z = a.z + uz * s + pz * side * half;
        if (!inHall(model, x, z)) return;
        items.push({ x, z, y: 6.8 + (side > 0 ? 0.8 : 0), rot: Math.atan2(px * side, pz * side) });
      });
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), brass, items.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  items.forEach((item, index) => {
    quat.setFromEuler(new THREE.Euler(0, item.rot, Math.PI / 2));
    matrix.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);
  return mesh;
}

function buildPendulums(scene, model, brass) {
  const sites = [
    { x: 10.4, z: -28 },
    { x: 62, z: -75 },
    { x: 62, z: -165 },
    { x: 10.4, z: -220 },
  ];
  const rods = [];
  sites.forEach(site => {
    if (!inHall(model, site.x, site.z)) return;
    const group = new THREE.Group();
    group.position.set(site.x, HALL_H - 0.4, site.z);
    const rod = addMesh(group, new THREE.BoxGeometry(0.16, 6.4, 0.16), brass, 0, -3.2, 0);
    rod.userData.cast = true;
    const bob = addMesh(group, roundedBoxGeometry(1.1, 1.1, 0.5, 0.12, 3), brass, 0, -6.4, 0);
    bob.userData.cast = true;
    scene.add(group);
    rods.push(group);
  });
  return rods;
}

function buildDebris(scene, model, low) {
  const count = low ? 14 : 28;
  const geometry = new THREE.BoxGeometry(0.7, 0.4, 0.7);
  const material = pbrMaterial('brass', 0x6a5430, { roughness: 0.7, metalness: 0.55, repeat: 1 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x51c5);
  const matrix = new THREE.Matrix4();
  const path = model.path || [];
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const x = bounds.minX + 6 + random() * (bounds.maxX - bounds.minX - 12);
    const z = bounds.minZ + 6 + random() * (bounds.maxZ - bounds.minZ - 12);
    if (!inHall(model, x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 5.2)) continue;
    const scale = 0.6 + random() * 1.2;
    matrix.compose(
      new THREE.Vector3(x, 0.2 * scale, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, 0)),
      new THREE.Vector3(scale, scale, scale),
    );
    mesh.setMatrixAt(placed, matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);
  return mesh;
}

function buildClockWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const steel = pbrMaterial('wornSteel', CLOCK_PALETTE.steel, {
    roughness: 0.44,
    metalness: 0.74,
    repeat: 3,
  });
  const plate = pbrMaterial('wornSteel', CLOCK_PALETTE.plate, {
    roughness: 0.52,
    metalness: 0.68,
    repeat: 4,
  });
  const brass = pbrMaterial('brass', CLOCK_PALETTE.brass, {
    roughness: 0.36,
    metalness: 0.84,
    repeat: 2,
  });

  scene.background = new THREE.Color(CLOCK_PALETTE.void);
  scene.fog = new THREE.FogExp2(CLOCK_PALETTE.fog, 0.012);
  scene.userData.baseFogDensity = 0.012;

  const lighting = buildClockLighting(scene, low);
  buildShell(scene, model, steel, plate);
  const frame = buildSpawnNave(scene, model, steel, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  const monument = buildClockCrown(scene, brass, steel);
  const shaft = buildLightShaft(scene);
  buildGears(scene, model, brass, low);
  const pendulums = buildPendulums(scene, model, brass);
  const detail = buildDebris(scene, model, low);
  const atmosphere = dustField(model.bounds, CLOCK_PALETTE.violet, low ? 50 : 110);
  scene.add(atmosphere);
  const motes = dustField(
    { minX: CROWN.x - 8, maxX: CROWN.x + 8, minZ: CROWN.z - 8, maxZ: CROWN.z + 8 },
    CLOCK_PALETTE.spill,
    low ? 24 : 50,
  );
  motes.position.y = 4;
  scene.add(motes);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, false);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.hour.rotation.y = time * 0.08;
    monument.minute.rotation.y = time * 0.55;
    monument.ring.rotation.z = time * 0.12;
    monument.under.intensity = 1.35 + Math.sin(time * 1.7) * 0.25;
    shaft.material.opacity = 0.014 + Math.sin(time * 0.7) * 0.006;
    atmosphere.rotation.y = time * 0.004;
    motes.rotation.y = -time * 0.01;
    pendulums.forEach((group, index) => {
      group.rotation.z = Math.sin(time * 1.1 + index) * 0.28;
    });
    landmarkSpin(monument.landmark, time);
  });

  const art = {
    world: 5,
    name: 'Clock Tower',
    palette: CLOCK_PALETTE,
    landmark: monument.landmark,
    detail,
    atmosphere,
    shaft,
    frame,
    pathLighting,
    lighting,
    materialCoverage: materialCoverage(scene),
    quality: low ? 'low' : 'high',
    grade: {
      saturation: 0.96,
      contrast: 1.14,
      tint: 0xe8dcff,
      lift: -0.026,
      gamma: 1.04,
      gain: 0.99,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

function landmarkSpin(landmark, time) {
  landmark.children.forEach(child => {
    if (child.userData.spin) child.rotation.z = time * 0.4 * child.userData.spin;
  });
}

export {
  CLOCK_PALETTE,
  CROWN,
  buildClockWorldScene,
};

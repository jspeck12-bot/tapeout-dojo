import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const CANYON_PALETTE = {
  void: 0x0a0704,
  fog: 0x2a160c,
  stone: 0x6a4a2e,
  cliff: 0x4a321c,
  floor: 0x3a2818,
  brass: 0xb08a4a,
  steel: 0x4a4038,
  ember: 0xfb923c,
  amber: 0xffc76b,
  cyan: 0x69e7ff,
  spill: 0xffd4a0,
};

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

function colossusPos(model) {
  const boss = (model.interactables || []).find(item => item.boss);
  return {
    x: boss?.x ?? (model.gateX || 0),
    z: boss?.z ?? (model.gateZ || 0),
  };
}

function buildCanyonLighting(scene, model, low) {
  const dest = colossusPos(model);
  const ambient = new THREE.AmbientLight(0x1c120a, 0.14);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x6a4428, 0x120804, 0.24);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(CANYON_PALETTE.spill, low ? 0.4 : 0.62);
  key.position.set(18, 64, 12);
  key.target.position.set(dest.x * 0.35, 8, dest.z * 0.35);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -48;
  cam.right = 48;
  cam.top = 70;
  cam.bottom = -24;
  cam.near = 8;
  cam.far = 180;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(CANYON_PALETTE.ember, low ? 0.14 : 0.28);
  rim.position.set(dest.x + 20, 48, dest.z - 10);
  rim.target.position.set(dest.x, 18, dest.z);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, fill, key, rim };
}

function buildSpawnNave(scene, model, stone, brass) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  const z = model.spawn.z - 9.4;
  [-1, 1].forEach(side => {
    const pier = addMesh(frame, roundedBoxGeometry(1.6, 7.6, 1.8, 0.16, 3), stone, side * 6.4, 3.8, z);
    pier.userData.cast = true;
    const rib = addMesh(frame, roundedBoxGeometry(0.2, 6.4, 0.2, 0.04, 2), brass, side * 5.5, 3.3, z + 0.55);
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(14.4, 1.05, 1.9, 0.14, 3), stone, 0, 7.7, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(7.2, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', CANYON_PALETTE.ember, 1.35, 1),
    0,
    7.15,
    z + 0.7,
  );
  const title = gothicLabel('COMBINATIONAL CANYON', '#FB923C', 0.9);
  title.position.set(0, 8.85, z + 0.35);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', CANYON_PALETTE.ember, 0.9, 4);
  const stud = emissiveSurface('silicon', CANYON_PALETTE.amber, 1.2, 1);
  const path = model.path || [];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const pavement = new THREE.Mesh(
      roundedBoxGeometry(3.4, 0.04, len + 0.3, 0.04, 2),
      pbrMaterial('wetRock', 0x2a1c10, {
        roughness: 0.32,
        metalness: 0.18,
        emissive: 0x2a1408,
        emissiveIntensity: 0.16,
        repeat: 3,
      }),
    );
    pavement.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    pavement.rotation.y = Math.atan2(dx, dz);
    pavement.receiveShadow = true;
    group.add(pavement);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(1.2, 0.045, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.4, 0.08, 0.4, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const last = index === path.length - 1;
    const pool = new THREE.PointLight(
      last ? CANYON_PALETTE.amber : CANYON_PALETTE.ember,
      last ? 1.05 : 0.5,
      last ? 24 : 13,
      1.8,
    );
    pool.position.set(point.x, last ? 6.2 : 2.8, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildColossus(scene, model, stone, brass, steel) {
  const dest = colossusPos(model);
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(dest.x, 0, dest.z);

  const plinth = addMesh(landmark, roundedBoxGeometry(14, 3.2, 10, 0.22, 3), stone, 0, 1.6, 0);
  plinth.userData.cast = true;
  const legs = addMesh(landmark, roundedBoxGeometry(9.4, 22, 6.2, 0.2, 3), steel, 0, 14.2, 0);
  legs.userData.cast = true;
  const torso = addMesh(landmark, roundedBoxGeometry(16, 20, 8.4, 0.22, 3), stone, 0, 34, 0);
  torso.userData.cast = true;
  [-1, 1].forEach(side => {
    const arm = addMesh(landmark, roundedBoxGeometry(4.2, 18, 4.2, 0.16, 3), steel, side * 10.4, 32, 1.4);
    arm.userData.cast = true;
  });
  const head = addMesh(landmark, roundedBoxGeometry(8.4, 10.6, 7.2, 0.2, 3), stone, 0, 49.2, 1.2);
  head.userData.cast = true;
  const visor = addMesh(
    landmark,
    roundedBoxGeometry(6.2, 1.4, 0.3, 0.06, 2),
    emissiveSurface('silicon', CANYON_PALETTE.ember, 1.7, 1),
    0,
    49.6,
    4.9,
  );
  visor.userData.visor = true;
  addMesh(
    landmark,
    roundedBoxGeometry(10.4, 0.18, 0.18, 0.04, 2),
    emissiveSurface('silicon', CANYON_PALETTE.amber, 1.35, 1),
    0,
    44.6,
    4.4,
  );
  const halo = addMesh(
    landmark,
    new THREE.TorusGeometry(7.4, 0.28, 8, 40),
    emissiveSurface('silicon', CANYON_PALETTE.ember, 1.15, 1),
    0,
    56.4,
    0,
  );
  halo.rotation.x = Math.PI / 2;
  const under = new THREE.PointLight(CANYON_PALETTE.ember, 1.8, 72, 2);
  under.position.set(0, 28, 6);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);
  landmark.add(fxCone(CANYON_PALETTE.ember, 5.2, 36, 0.045, 0, 0));
  landmark.add(fxCone(CANYON_PALETTE.amber, 2.4, 24, 0.03, 0, 0));
  const marquee = gothicLabel('THE ENCODER COLOSSUS', '#FB923C', 1.8);
  marquee.position.set(0, 64, 2);
  landmark.add(marquee);
  addMesh(landmark, roundedBoxGeometry(6.2, 1.1, 3.4, 0.12, 3), brass, 0, 24.6, 4.2);
  scene.add(landmark);
  return { landmark, halo, under, visor };
}

function buildLightShaft(scene, model) {
  const dest = colossusPos(model);
  const material = new THREE.MeshBasicMaterial({
    color: CANYON_PALETTE.ember,
    transparent: true,
    opacity: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(16, 56, 22, 1, true), material);
  shaft.position.set(dest.x, 34, dest.z);
  shaft.rotation.z = 0.05;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildFloor(scene, model) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(
      (bounds.maxX - bounds.minX) + 180,
      (bounds.maxZ - bounds.minZ) + 180,
    ),
    pbrMaterial('wetRock', CANYON_PALETTE.floor, {
      roughness: 0.62,
      metalness: 0.06,
      repeat: 10,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

function buildCliffs(scene, model, stone) {
  const strata = emissiveSurface('silicon', CANYON_PALETTE.ember, 0.42, 2);
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const height = length > 36 ? 16 : 12;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.7, height, sz + 0.7), stone);
    mesh.position.set((wall.minX + wall.maxX) / 2, height / 2 - 0.3, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 14) {
      [0.28, 0.52, 0.76].forEach((frac, index) => {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.2, sx * 0.92), 0.12, Math.max(0.2, sz * 0.92)),
          index === 1 ? strata : stone,
        );
        bar.position.set(mesh.position.x, height * frac, mesh.position.z);
        scene.add(bar);
      });
    }
  });
}

function buildBridge(scene, model, stone, brass) {
  const group = new THREE.Group();
  group.position.set(-2.6, 0, -124.8);
  const deck = addMesh(group, roundedBoxGeometry(38, 0.28, 6.4, 0.08, 2), stone, 0, 0.2, 0);
  deck.receiveShadow = true;
  [-1, 1].forEach(side => {
    const rail = addMesh(group, new THREE.BoxGeometry(38, 0.18, 0.18), brass, 0, 1.15, side * 2.9);
    rail.userData.cast = true;
  });
  scene.add(group);
  return group;
}

function buildSpires(scene, model, stone, low) {
  const count = low ? 10 : 18;
  const geometry = new THREE.ConeGeometry(3.4, 14, 5, 1);
  const mesh = new THREE.InstancedMesh(geometry, stone, count);
  const random = mulberry32(0x4c01);
  const matrix = new THREE.Matrix4();
  let placed = 0;
  model.colliders.forEach((wall, index) => {
    if (placed >= count) return;
    if (index % 2 !== 0) return;
    const h = 0.7 + random() * 0.9;
    matrix.compose(
      new THREE.Vector3(
        (wall.minX + wall.maxX) / 2 + (random() - 0.5) * 2,
        12 + 7 * h,
        (wall.minZ + wall.maxZ) / 2 + (random() - 0.5) * 2,
      ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, (random() - 0.5) * 0.08)),
      new THREE.Vector3(0.8 + random() * 0.5, h, 0.8 + random() * 0.5),
    );
    mesh.setMatrixAt(placed, matrix);
    placed++;
  });
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);
  return mesh;
}

function buildStelae(scene, model, stone) {
  const random = mulberry32(0x2c11);
  const path = model.path || [];
  const nodes = (model.interactables || []).map(item => ({ x: item.x, z: item.z }));
  const cap = emissiveSurface('silicon', CANYON_PALETTE.ember, 0.8, 1);
  const posts = [];
  const tips = [];
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  const inHall = (x, z) => model.rects.some(rect => (
    x > rect.x1 + 1.6 && x < rect.x2 - 1.6 && z > rect.z1 + 1.6 && z < rect.z2 - 1.6
  ));
  while (placed < 28 && tries < 480) {
    tries++;
    const x = bounds.minX + 8 + random() * (bounds.maxX - bounds.minX - 16);
    const z = bounds.minZ + 8 + random() * (bounds.maxZ - bounds.minZ - 16);
    if (!inHall(x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 6.5)) continue;
    if (nodes.some(point => Math.hypot(point.x - x, point.z - z) < 5.5)) continue;
    const h = 2.4 + random() * 3.2;
    posts.push({ x, y: h / 2, z, sy: h });
    tips.push({ x, y: h + 0.12, z });
    placed++;
  }
  const matrix = new THREE.Matrix4();
  const ident = new THREE.Quaternion();
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 1, 0.42), stone, posts.length);
  posts.forEach((item, index) => {
    matrix.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      ident,
      new THREE.Vector3(1, item.sy, 1),
    );
    postMesh.setMatrixAt(index, matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.userData.cast = true;
  scene.add(postMesh);
  const tipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.14, 0.28), cap, tips.length);
  tips.forEach((item, index) => {
    matrix.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      ident,
      new THREE.Vector3(1, 1, 1),
    );
    tipMesh.setMatrixAt(index, matrix);
  });
  tipMesh.instanceMatrix.needsUpdate = true;
  scene.add(tipMesh);
}

function buildDebris(scene, model, low) {
  const count = low ? 14 : 28;
  const geometry = new THREE.BoxGeometry(0.9, 0.55, 0.9);
  const material = pbrMaterial('wetRock', CANYON_PALETTE.cliff, {
    roughness: 0.84,
    metalness: 0.05,
    repeat: 1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x71a2);
  const matrix = new THREE.Matrix4();
  const path = model.path || [];
  const bounds = model.bounds;
  const inHall = (x, z) => model.rects.some(rect => (
    x > rect.x1 + 1.4 && x < rect.x2 - 1.4 && z > rect.z1 + 1.4 && z < rect.z2 - 1.4
  ));
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 18) {
    tries++;
    const x = bounds.minX + 8 + random() * (bounds.maxX - bounds.minX - 16);
    const z = bounds.minZ + 8 + random() * (bounds.maxZ - bounds.minZ - 16);
    if (!inHall(x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 5.5)) continue;
    const scale = 0.6 + random() * 1.3;
    matrix.compose(
      new THREE.Vector3(x, 0.28 * scale, z),
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

function buildStars(scene, low) {
  const count = low ? 60 : 130;
  const pos = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 0.78);
    const r = 380;
    pos[index * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[index * 3 + 1] = r * Math.cos(ph) + 10;
    pos[index * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffe0c0,
    size: 1.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.72,
  })));
}

function buildCanyonWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const stone = pbrMaterial('wetRock', CANYON_PALETTE.stone, {
    roughness: 0.74,
    metalness: 0.05,
    repeat: 3,
  });
  const brass = pbrMaterial('brass', CANYON_PALETTE.brass, { roughness: 0.4, metalness: 0.8, repeat: 2 });
  const steel = pbrMaterial('wornSteel', CANYON_PALETTE.steel, { roughness: 0.46, metalness: 0.7, repeat: 2 });

  scene.background = new THREE.Color(CANYON_PALETTE.void);
  scene.fog = new THREE.FogExp2(CANYON_PALETTE.fog, 0.0084);
  scene.userData.baseFogDensity = 0.0084;

  const lighting = buildCanyonLighting(scene, model, low);
  buildStars(scene, low);
  buildFloor(scene, model);
  const frame = buildSpawnNave(scene, model, stone, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  buildCliffs(scene, model, stone);
  buildBridge(scene, model, stone, brass);
  buildSpires(scene, model, stone, low);
  buildStelae(scene, model, stone);
  const monument = buildColossus(scene, model, stone, brass, steel);
  const shaft = buildLightShaft(scene, model);
  const detail = buildDebris(scene, model, low);
  const atmosphere = dustField(model.bounds, CANYON_PALETTE.ember, low ? 50 : 110);
  scene.add(atmosphere);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, true);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.halo.rotation.z = time * 0.22;
    monument.under.intensity = 1.5 + Math.sin(time * 1.4) * 0.3;
    shaft.material.opacity = 0.014 + Math.sin(time * 0.65) * 0.006;
    atmosphere.rotation.y = time * 0.005;
  });

  const art = {
    world: 4,
    name: 'Combinational Canyon',
    palette: CANYON_PALETTE,
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
      saturation: 1.02,
      contrast: 1.14,
      tint: 0xffe6d0,
      lift: -0.024,
      gamma: 1.03,
      gain: 1.0,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  CANYON_PALETTE,
  buildCanyonWorldScene,
};

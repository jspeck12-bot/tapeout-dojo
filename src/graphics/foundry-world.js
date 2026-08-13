import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const FOUNDRY_PALETTE = {
  void: 0x07080c,
  fog: 0x1a120e,
  steel: 0x3a4650,
  plate: 0x2c343c,
  grime: 0x2a2622,
  brass: 0xb08a4a,
  ember: 0xff6a2a,
  heat: 0xff8c3a,
  cyan: 0x22d3ee,
  amber: 0xffc76b,
  spill: 0xffc4a0,
};

const HALL_H = 15.6;
const CATWALK_Y = 7.4;
const STACK = { x: -12.2, z: -58.0 };

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

function buildFoundryLighting(scene, model, low) {
  const ambient = new THREE.AmbientLight(0x141820, 0.14);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3a4a58, 0x1a1008, 0.22);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(FOUNDRY_PALETTE.spill, low ? 0.38 : 0.58);
  key.position.set(10, 36, 8);
  key.target.position.set(STACK.x, 6, STACK.z);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.5;
  const cam = key.shadow.camera;
  cam.left = -36;
  cam.right = 28;
  cam.top = 40;
  cam.bottom = -18;
  cam.near = 6;
  cam.far = 110;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(FOUNDRY_PALETTE.cyan, low ? 0.12 : 0.22);
  rim.position.set(-28, 22, -86);
  rim.target.position.set(0, 4, -40);
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
  const z = model.spawn.z - 10.4;
  [-1, 1].forEach(side => {
    const pier = addMesh(frame, roundedBoxGeometry(1.5, 9.2, 1.8, 0.16, 3), steel, side * 6.6, 4.6, z);
    pier.userData.cast = true;
    const rib = addMesh(frame, roundedBoxGeometry(0.2, 7.6, 0.2, 0.04, 2), brass, side * 5.7, 4.0, z + 0.55);
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(14.6, 1.05, 1.9, 0.14, 3), steel, 0, 9.15, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(7.6, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 1.35, 1),
    0,
    8.55,
    z + 0.7,
  );
  const title = gothicLabel('MODULE FOUNDRY', '#FF8C3A', 0.92);
  title.position.set(0, 10.35, z + 0.35);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', FOUNDRY_PALETTE.cyan, 0.82, 4);
  const stud = emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 1.2, 1);
  const lampGlow = emissiveSurface('silicon', FOUNDRY_PALETTE.ember, 1.55, 1);
  const steel = pbrMaterial('wornSteel', FOUNDRY_PALETTE.steel, {
    roughness: 0.4,
    metalness: 0.78,
    repeat: 2,
  });
  const path = model.path || [];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const pavement = new THREE.Mesh(
      roundedBoxGeometry(3.6, 0.04, len + 0.3, 0.04, 2),
      pbrMaterial('wornSteel', 0x243038, {
        roughness: 0.28,
        metalness: 0.7,
        emissive: 0x0a2430,
        emissiveIntensity: 0.16,
        repeat: 3,
      }),
    );
    pavement.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    pavement.rotation.y = Math.atan2(dx, dz);
    pavement.receiveShadow = true;
    group.add(pavement);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(1.15, 0.045, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.38, 0.08, 0.38, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const last = index === path.length - 1;
    const arm = new THREE.Mesh(roundedBoxGeometry(0.16, 0.16, 1.8, 0.04, 2), steel);
    arm.position.set(point.x, CATWALK_Y + 0.9, point.z);
    group.add(arm);
    const cage = new THREE.Mesh(roundedBoxGeometry(0.34, 0.42, 0.34, 0.05, 2), lampGlow);
    cage.position.set(point.x, CATWALK_Y + 0.45, point.z);
    group.add(cage);
    const pool = new THREE.PointLight(
      last ? FOUNDRY_PALETTE.amber : FOUNDRY_PALETTE.ember,
      last ? 0.9 : 0.46,
      last ? 22 : 13,
      1.8,
    );
    pool.position.set(point.x, last ? 5.2 : 3.4, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildFoundryStack(scene, brass, steel) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(STACK.x, 0, STACK.z);

  const stack = addMesh(landmark, roundedBoxGeometry(5.4, 22.4, 5.4, 0.22, 3), steel, 0, 11.2, 0);
  stack.userData.cast = true;
  [-1, 1].forEach(side => {
    const band = addMesh(
      landmark,
      roundedBoxGeometry(5.9, 0.42, 5.9, 0.08, 2),
      brass,
      0,
      6.2 + side * 4.4,
      0,
    );
    band.userData.cast = true;
  });
  const hood = addMesh(landmark, roundedBoxGeometry(8.4, 2.2, 6.2, 0.18, 3), steel, 1.6, 8.6, 2.4);
  hood.userData.cast = true;
  const maw = addMesh(
    landmark,
    roundedBoxGeometry(3.6, 3.2, 0.22, 0.06, 2),
    emissiveSurface('silicon', FOUNDRY_PALETTE.ember, 1.7, 1),
    1.6,
    4.4,
    5.35,
  );
  maw.userData.heatMaw = true;
  addMesh(
    landmark,
    roundedBoxGeometry(2.2, 0.14, 0.14, 0.04, 2),
    emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 1.4, 1),
    1.6,
    10.05,
    5.4,
  );
  const cap = addMesh(landmark, roundedBoxGeometry(4.2, 1.1, 4.2, 0.14, 3), brass, 0, 22.6, 0);
  cap.userData.cast = true;
  const halo = addMesh(
    landmark,
    new THREE.TorusGeometry(3.4, 0.18, 8, 32),
    emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 1.2, 1),
    0,
    16.4,
    0,
  );
  halo.rotation.x = Math.PI / 2;

  const under = new THREE.PointLight(FOUNDRY_PALETTE.ember, 1.55, 42, 2);
  under.position.set(1.4, 5.2, 3.2);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);
  landmark.add(fxCone(FOUNDRY_PALETTE.ember, 3.6, 18, 0.05, 1.4, 2.2));
  landmark.add(fxCone(FOUNDRY_PALETTE.amber, 1.8, 14, 0.035, 1.4, 2.2));

  const marquee = gothicLabel('THE FOUNDRY STACK', '#FF8C3A', 1.35);
  marquee.position.set(1.2, 24.2, 2.4);
  landmark.add(marquee);

  scene.add(landmark);
  return { landmark, halo, under, maw };
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: FOUNDRY_PALETTE.ember,
    transparent: true,
    opacity: 0.018,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(7.4, 28, 20, 1, true), material);
  shaft.position.set(STACK.x + 1.4, 16, STACK.z + 2);
  shaft.rotation.z = 0.06;
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
  const fw = (bounds.maxX - bounds.minX) + 24;
  const fd = (bounds.maxZ - bounds.minZ) + 24;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('concrete', FOUNDRY_PALETTE.grime, {
      roughness: 0.78,
      metalness: 0.12,
      repeat: 10,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('wornSteel', FOUNDRY_PALETTE.plate, {
      roughness: 0.55,
      metalness: 0.72,
      repeat: 8,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, HALL_H, cz);
  scene.add(ceiling);

  const heat = emissiveSurface('silicon', FOUNDRY_PALETTE.ember, 0.55, 2);
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.4, HALL_H, sz + 0.4),
      length > 40 ? plate : steel,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, HALL_H / 2, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 16) {
      const bar = new THREE.Mesh(
        roundedBoxGeometry(Math.max(0.18, sx * 0.9), 0.1, Math.max(0.18, sz * 0.9), 0.03, 2),
        heat,
      );
      bar.position.set(mesh.position.x, 3.2, mesh.position.z);
      scene.add(bar);
    }
  });
  return { ground, ceiling };
}

function buildCatwalks(scene, model, steel, brass, low) {
  const path = model.path || [];
  const postGeo = new THREE.BoxGeometry(0.16, CATWALK_Y, 0.16);
  const deckGeo = new THREE.BoxGeometry(1.9, 0.1, 3.2);
  const railGeo = new THREE.BoxGeometry(0.07, 0.07, 3.2);
  const posts = [];
  const decks = [];
  const rails = [];
  const half = 13.2;
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 8) continue;
    const ux = dx / len;
    const uz = dz / len;
    const px = -uz;
    const pz = ux;
    const step = low ? 10.4 : 8.8;
    for (let s = 4; s < len - 3; s += step) {
      const x = a.x + ux * s;
      const z = a.z + uz * s;
      [-1, 1].forEach(side => {
        const cx = x + px * side * half;
        const cz = z + pz * side * half;
        if (!inHall(model, cx, cz)) return;
        posts.push({ x: cx, z: cz, y: CATWALK_Y / 2 });
        decks.push({
          x: cx - px * side * 0.7,
          z: cz - pz * side * 0.7,
          y: CATWALK_Y,
          rot: Math.atan2(dx, dz),
        });
        rails.push({
          x: cx - px * side * 0.15,
          z: cz - pz * side * 0.15,
          y: CATWALK_Y + 0.85,
          rot: Math.atan2(dx, dz),
        });
      });
    }
  }
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const place = (geometry, material, items, yRot) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((item, index) => {
      quat.setFromEuler(new THREE.Euler(0, yRot ? item.rot : 0, 0));
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
  };
  return {
    posts: place(postGeo, steel, posts, false),
    decks: place(deckGeo, steel, decks, true),
    rails: place(railGeo, brass, rails, true),
  };
}

function buildPipeRuns(scene, model, steel, heat, low) {
  const path = model.path || [];
  const geo = new THREE.CylinderGeometry(0.22, 0.22, 4.8, 8);
  const items = [];
  const half = 14.4;
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 10) continue;
    const ux = dx / len;
    const uz = dz / len;
    const px = -uz;
    const pz = ux;
    const step = low ? 14 : 10;
    for (let s = 6; s < len - 5; s += step) {
      [-1, 1].forEach(side => {
        const x = a.x + ux * s + px * side * half;
        const z = a.z + uz * s + pz * side * half;
        if (!inHall(model, x, z)) return;
        items.push({ x, z, rot: Math.atan2(px * side, pz * side) });
      });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, steel, items.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  items.forEach((item, index) => {
    quat.setFromEuler(new THREE.Euler(Math.PI / 2, item.rot, 0));
    matrix.compose(
      new THREE.Vector3(item.x, 11.4, item.z),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);

  const bands = items.filter((_, index) => index % 3 === 0);
  if (bands.length) {
    const bandMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      heat,
      bands.length,
    );
    const ident = new THREE.Quaternion();
    bands.forEach((item, index) => {
      matrix.compose(
        new THREE.Vector3(item.x, 11.4, item.z),
        ident,
        new THREE.Vector3(1, 1, 1),
      );
      bandMesh.setMatrixAt(index, matrix);
    });
    bandMesh.instanceMatrix.needsUpdate = true;
    scene.add(bandMesh);
  }
  return mesh;
}

function buildFurnaceBays(scene, model, steel, brass) {
  const sites = [
    { x: 12.4, z: -36 },
    { x: 14.8, z: -86 },
    { x: 70.2, z: -88 },
    { x: 97.2, z: -140 },
    { x: 70.4, z: -190 },
    { x: 13.6, z: -230 },
  ];
  const heat = emissiveSurface('silicon', FOUNDRY_PALETTE.ember, 1.25, 1);
  sites.forEach(site => {
    if (!inHall(model, site.x, site.z)) return;
    const group = new THREE.Group();
    group.position.set(site.x, 0, site.z);
    const body = addMesh(group, roundedBoxGeometry(3.4, 4.6, 2.6, 0.14, 3), steel, 0, 2.3, 0);
    body.userData.cast = true;
    addMesh(group, roundedBoxGeometry(1.6, 1.4, 0.16, 0.04, 2), heat, 0, 1.7, 1.35);
    const stack = addMesh(group, roundedBoxGeometry(1.1, 3.2, 1.1, 0.1, 3), brass, 0, 6.1, 0);
    stack.userData.cast = true;
    scene.add(group);
  });
}

function buildHallPosts(scene, model, steel, brass) {
  const random = mulberry32(0x3f01);
  const path = model.path || [];
  const nodes = (model.interactables || []).map(item => ({ x: item.x, z: item.z }));
  const cap = emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 0.7, 1);
  const bounds = model.bounds;
  const posts = [];
  const tips = [];
  const embers = [];
  let placed = 0;
  let tries = 0;
  while (placed < 36 && tries < 640) {
    tries++;
    const x = bounds.minX + 8 + random() * (bounds.maxX - bounds.minX - 16);
    const z = bounds.minZ + 8 + random() * (bounds.maxZ - bounds.minZ - 16);
    if (!inHall(model, x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 6.2)) continue;
    if (nodes.some(point => Math.hypot(point.x - x, point.z - z) < 5.5)) continue;
    if (Math.hypot(x - STACK.x, z - STACK.z) < 8) continue;
    const h = 4.6 + random() * 5.4;
    posts.push({ x, y: h / 2, z, sy: h });
    tips.push({ x, y: h + 0.1, z });
    embers.push({ x, y: h + 0.28, z });
    placed++;
  }
  const matrix = new THREE.Matrix4();
  const ident = new THREE.Quaternion();
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 1, 0.38), steel, posts.length);
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
  const tipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), brass, tips.length);
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
  const emberMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), cap, embers.length);
  embers.forEach((item, index) => {
    matrix.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      ident,
      new THREE.Vector3(1, 1, 1),
    );
    emberMesh.setMatrixAt(index, matrix);
  });
  emberMesh.instanceMatrix.needsUpdate = true;
  scene.add(emberMesh);
}

function buildBeams(scene, model, steel, low) {
  const bounds = model.bounds;
  const count = low ? 14 : 20;
  const geo = new THREE.BoxGeometry(0.36, 0.36, 18);
  const mesh = new THREE.InstancedMesh(geo, steel, count);
  const random = mulberry32(0x51b0);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const x = bounds.minX + 10 + random() * (bounds.maxX - bounds.minX - 20);
    const z = bounds.minZ + 10 + random() * (bounds.maxZ - bounds.minZ - 20);
    if (!inHall(model, x, z)) continue;
    quat.setFromEuler(new THREE.Euler(0, random() > 0.5 ? 0 : Math.PI / 2, 0));
    matrix.compose(
      new THREE.Vector3(x, HALL_H - 0.4, z),
      quat,
      new THREE.Vector3(1, 1, 1),
    );
    mesh.setMatrixAt(placed, matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function buildDebris(scene, model, low) {
  const count = low ? 18 : 36;
  const geometry = roundedBoxGeometry(0.7, 0.42, 0.7, 0.06, 2);
  const material = pbrMaterial('concrete', FOUNDRY_PALETTE.grime, {
    roughness: 0.86,
    metalness: 0.08,
    repeat: 1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x61c3);
  const matrix = new THREE.Matrix4();
  const path = model.path || [];
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const x = bounds.minX + 8 + random() * (bounds.maxX - bounds.minX - 16);
    const z = bounds.minZ + 8 + random() * (bounds.maxZ - bounds.minZ - 16);
    if (!inHall(model, x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 5.5)) continue;
    const scale = 0.7 + random() * 1.3;
    matrix.compose(
      new THREE.Vector3(x, 0.22 * scale, z),
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

function buildSparks(scene, low) {
  const count = low ? 24 : 48;
  const pos = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    pos[index * 3] = STACK.x + 1.4 + (Math.random() - 0.5) * 4;
    pos[index * 3 + 1] = 2.2 + Math.random() * 8;
    pos[index * 3 + 2] = STACK.z + 3 + (Math.random() - 0.5) * 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: FOUNDRY_PALETTE.amber,
    size: 0.12,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sparks.userData.sparks = true;
  scene.add(sparks);
  return sparks;
}

function buildBossCrucible(scene, model, steel, brass) {
  const boss = (model.interactables || []).find(item => item.boss);
  if (!boss) return null;
  const group = new THREE.Group();
  group.position.set(boss.x, 0, boss.z);
  const dais = addMesh(group, roundedBoxGeometry(10.4, 0.46, 10.4, 0.12, 3), steel, 0, 0.23, 0);
  dais.userData.cast = true;
  const ring = addMesh(
    group,
    new THREE.TorusGeometry(3.6, 0.22, 8, 36),
    emissiveSurface('silicon', FOUNDRY_PALETTE.heat, 1.1, 1),
    0,
    0.55,
    0,
  );
  ring.rotation.x = Math.PI / 2;
  addMesh(group, roundedBoxGeometry(2.4, 0.2, 2.4, 0.06, 2), brass, 0, 0.42, 0);
  scene.add(group);
  return group;
}

function buildFoundryWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const steel = pbrMaterial('wornSteel', FOUNDRY_PALETTE.steel, {
    roughness: 0.42,
    metalness: 0.76,
    repeat: 3,
  });
  const plate = pbrMaterial('wornSteel', FOUNDRY_PALETTE.plate, {
    roughness: 0.5,
    metalness: 0.7,
    repeat: 4,
  });
  const brass = pbrMaterial('brass', FOUNDRY_PALETTE.brass, {
    roughness: 0.38,
    metalness: 0.82,
    repeat: 2,
  });
  const heat = emissiveSurface('silicon', FOUNDRY_PALETTE.ember, 0.9, 2);

  scene.background = new THREE.Color(FOUNDRY_PALETTE.void);
  scene.fog = new THREE.FogExp2(FOUNDRY_PALETTE.fog, 0.011);
  scene.userData.baseFogDensity = 0.011;

  const lighting = buildFoundryLighting(scene, model, low);
  buildShell(scene, model, steel, plate);
  const frame = buildSpawnNave(scene, model, steel, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  const monument = buildFoundryStack(scene, brass, steel);
  const shaft = buildLightShaft(scene);
  buildCatwalks(scene, model, steel, brass, low);
  buildPipeRuns(scene, model, steel, heat, low);
  buildFurnaceBays(scene, model, steel, brass);
  buildHallPosts(scene, model, steel, brass);
  buildBeams(scene, model, steel, low);
  buildBossCrucible(scene, model, steel, brass);
  const detail = buildDebris(scene, model, low);
  const sparks = buildSparks(scene, low);
  const atmosphere = dustField(model.bounds, FOUNDRY_PALETTE.heat, low ? 55 : 120);
  scene.add(atmosphere);
  const steam = dustField(
    { minX: STACK.x - 10, maxX: STACK.x + 12, minZ: STACK.z - 8, maxZ: STACK.z + 10 },
    FOUNDRY_PALETTE.spill,
    low ? 28 : 64,
  );
  steam.position.y = 2.4;
  scene.add(steam);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, false);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.halo.rotation.z = time * 0.35;
    monument.under.intensity = 1.35 + Math.sin(time * 2.1) * 0.28;
    shaft.material.opacity = 0.014 + Math.sin(time * 0.8) * 0.006;
    atmosphere.rotation.y = time * 0.006;
    steam.rotation.y = -time * 0.01;
    sparks.rotation.y = time * 0.4;
    sparks.position.y = Math.sin(time * 3.2) * 0.15;
  });

  const art = {
    world: 3,
    name: 'Module Foundry',
    palette: FOUNDRY_PALETTE,
    landmark: monument.landmark,
    detail,
    atmosphere,
    shaft,
    frame,
    pathLighting,
    lighting,
    sparks,
    steam,
    materialCoverage: materialCoverage(scene),
    quality: low ? 'low' : 'high',
    grade: {
      saturation: 0.98,
      contrast: 1.16,
      tint: 0xffe2d0,
      lift: -0.03,
      gamma: 1.04,
      gain: 0.98,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  FOUNDRY_PALETTE,
  STACK,
  buildFoundryWorldScene,
};

import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const TAPEOUT_PALETTE = {
  void: 0x04070c,
  fog: 0x0c141c,
  stone: 0x28323d,
  plate: 0x141c24,
  steel: 0x3a4654,
  brass: 0xb08a4a,
  gold: 0xfacc15,
  silicon: 0xc8d8e4,
  ash: 0xb8c4cc,
  spill: 0xffe9a8,
};

const HALL_H = 17.2;
// Landmark sits in the first nave sightline from spawn (layout unchanged).
const ALTAR = { x: 0, z: -48 };

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

function buildTapeoutLighting(scene, low) {
  // Quiet cathedral: one hero key on the wafer, almost no fill.
  const ambient = new THREE.AmbientLight(0x0a1218, 0.05);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x243040, 0x06080c, 0.08);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(TAPEOUT_PALETTE.spill, low ? 0.48 : 0.82);
  key.position.set(2, 46, ALTAR.z + 14);
  key.target.position.set(ALTAR.x, 6, ALTAR.z);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -22;
  cam.right = 22;
  cam.top = 36;
  cam.bottom = -16;
  cam.near = 4;
  cam.far = 90;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(TAPEOUT_PALETTE.silicon, low ? 0.08 : 0.16);
  rim.position.set(-16, 12, ALTAR.z - 20);
  rim.target.position.set(0, 4, -36);
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
  const z = model.spawn.z - 10.0;
  [-1, 1].forEach(side => {
    const pier = addMesh(
      frame,
      roundedBoxGeometry(1.8, 10.4, 2.0, 0.1, 2),
      stone,
      side * 6.8,
      5.2,
      z,
    );
    pier.userData.cast = true;
    const rib = addMesh(
      frame,
      roundedBoxGeometry(0.18, 8.6, 0.18, 0.04, 2),
      brass,
      side * 5.8,
      4.5,
      z + 0.55,
    );
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(15.2, 1.1, 1.9, 0.1, 2), stone, 0, 10.6, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(7.2, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 1.15, 1),
    0,
    9.95,
    z + 0.7,
  );
  const title = gothicLabel('TAPEOUT', '#FACC15', 0.95);
  title.position.set(0, 11.8, z + 0.3);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 0.55, 4);
  const stud = emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 0.95, 1);
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
      pbrMaterial('concrete', 0x121820, {
        roughness: 0.8,
        metalness: 0.1,
        emissive: 0x1a1608,
        emissiveIntensity: 0.12,
        repeat: 3,
      }),
    );
    pavement.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    pavement.rotation.y = Math.atan2(dx, dz);
    pavement.receiveShadow = true;
    group.add(pavement);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(0.55, 0.04, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.32, 0.07, 0.32, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const nearAltar = Math.hypot(point.x - ALTAR.x, point.z - ALTAR.z) < 14;
    const pool = new THREE.PointLight(
      TAPEOUT_PALETTE.gold,
      nearAltar ? 0.28 : 0.22,
      nearAltar ? 16 : 12,
      2.1,
    );
    pool.position.set(point.x, 3.0, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildWaferAltar(scene, stone, steel, brass) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(ALTAR.x, 0, ALTAR.z);

  // Quiet plinth — low mass, wafer reads as the hero.
  const plinth = addMesh(
    landmark,
    roundedBoxGeometry(14.4, 1.6, 10.8, 0.14, 2),
    stone,
    0,
    0.8,
    0,
  );
  plinth.userData.cast = true;

  const dais = addMesh(
    landmark,
    roundedBoxGeometry(9.2, 1.1, 7.4, 0.12, 2),
    steel,
    0,
    2.05,
    0.2,
  );
  dais.userData.cast = true;

  // Side piers frame the wafer without fighting the hero light.
  [-1, 1].forEach(side => {
    const pier = addMesh(
      landmark,
      roundedBoxGeometry(1.6, 14.8, 1.6, 0.1, 2),
      stone,
      side * 6.6,
      8.2,
      -1.2,
    );
    pier.userData.cast = true;
    const finial = addMesh(
      landmark,
      roundedBoxGeometry(0.9, 1.4, 0.9, 0.08, 2),
      brass,
      side * 6.6,
      16.2,
      -1.2,
    );
    finial.userData.cast = true;
  });

  const arch = addMesh(
    landmark,
    roundedBoxGeometry(14.8, 1.2, 1.8, 0.1, 2),
    stone,
    0,
    15.6,
    -1.2,
  );
  arch.userData.cast = true;

  // Silicon wafer — the silhouette that must read from spawn.
  const wafer = addMesh(
    landmark,
    new THREE.CylinderGeometry(3.6, 3.6, 0.18, 48),
    pbrMaterial('silicon', TAPEOUT_PALETTE.silicon, {
      roughness: 0.18,
      metalness: 0.72,
      emissive: TAPEOUT_PALETTE.gold,
      emissiveIntensity: 0.55,
      repeat: 2,
    }),
    0,
    3.0,
    1.1,
  );
  wafer.userData.cast = true;
  wafer.userData.wafer = true;

  const notch = addMesh(
    landmark,
    roundedBoxGeometry(0.55, 0.22, 0.9, 0.04, 2),
    emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 1.35, 1),
    0,
    3.05,
    4.55,
  );
  notch.userData.glow = true;

  // Die grid — thin gold traces on the wafer face.
  const dieMat = emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 0.85, 1);
  for (let i = -2; i <= 2; i++) {
    addMesh(landmark, roundedBoxGeometry(6.2, 0.02, 0.04, 0.01, 1), dieMat, 0, 3.12, 1.1 + i * 0.85);
    addMesh(landmark, roundedBoxGeometry(0.04, 0.02, 6.2, 0.01, 1), dieMat, i * 0.85, 3.12, 1.1);
  }

  // Unfogged crown beacon so FogExp2 does not erase the altar from spawn.
  const spire = addMesh(
    landmark,
    roundedBoxGeometry(0.9, 10.8, 0.9, 0.08, 2),
    emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 1.85, 1),
    0,
    21.8,
    -1.2,
  );
  spire.material.fog = false;
  spire.userData.cast = true;
  const beacon = addMesh(
    landmark,
    roundedBoxGeometry(2.4, 0.28, 2.4, 0.06, 2),
    emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 2.2, 1),
    0,
    27.6,
    -1.2,
  );
  beacon.material.fog = false;

  // ONE hero point light on the wafer — no competing monument floods.
  const hero = new THREE.PointLight(TAPEOUT_PALETTE.spill, 2.6, 38, 1.7);
  hero.position.set(0, 9.2, 2.4);
  hero.castShadow = false;
  hero.userData.lightRole = 'monument';
  hero.userData.baseIntensity = hero.intensity;
  landmark.add(hero);

  landmark.add(fxCone(TAPEOUT_PALETTE.gold, 4.2, 22, 0.04, 0, 1.6));
  const marquee = gothicLabel('THE WAFER ALTAR', '#FACC15', 1.45);
  marquee.position.set(0, 17.4, 1.8);
  landmark.add(marquee);

  scene.add(landmark);
  return { landmark, hero, wafer, beacon };
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: TAPEOUT_PALETTE.spill,
    transparent: true,
    opacity: 0.022,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(6.8, 30, 20, 1, true), material);
  shaft.position.set(ALTAR.x, 17, ALTAR.z + 1.5);
  shaft.rotation.z = 0.02;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildShell(scene, model, stone, plate) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const fw = (bounds.maxX - bounds.minX) + 22;
  const fd = (bounds.maxZ - bounds.minZ) + 22;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('concrete', TAPEOUT_PALETTE.plate, {
      roughness: 0.84,
      metalness: 0.08,
      repeat: 10,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('concrete', TAPEOUT_PALETTE.stone, {
      roughness: 0.76,
      metalness: 0.1,
      repeat: 8,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, HALL_H, cz);
  scene.add(ceiling);

  const ribbon = emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 0.28, 2);
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.5, HALL_H, sz + 0.5),
      length > 40 ? plate : stone,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, HALL_H / 2, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 16) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, sx * 0.88), 0.1, Math.max(0.2, sz * 0.88)),
        ribbon,
      );
      bar.position.set(mesh.position.x, 4.6, mesh.position.z);
      scene.add(bar);
    }
  });
}

function buildPiers(scene, model, stone, brass, low) {
  const path = model.path || [];
  const items = [];
  const half = 9.6;
  const step = low ? 20 : 16;
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 14) continue;
    const ux = dx / len;
    const uz = dz / len;
    const px = -uz;
    const pz = ux;
    for (let s = 12; s < len - 8; s += step) {
      [-1, 1].forEach(side => {
        const x = a.x + ux * s + px * side * half;
        const z = a.z + uz * s + pz * side * half;
        if (!inHall(model, x, z)) return;
        if (Math.hypot(x - ALTAR.x, z - ALTAR.z) < 14) return;
        items.push({
          x,
          z,
          y: HALL_H * 0.4,
          rot: Math.atan2(px * side, pz * side),
          brass: side > 0,
        });
      });
    }
  }
  const mesh = new THREE.InstancedMesh(
    roundedBoxGeometry(1.5, 12.8, 1.8, 0.08, 2),
    stone,
    items.length,
  );
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  items.forEach((item, index) => {
    quat.setFromEuler(new THREE.Euler(0, item.rot, 0));
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

  // Sparse brass capitals — keep brass count for the unit test without clutter.
  items.filter(item => item.brass).slice(0, low ? 4 : 8).forEach((item, index) => {
    const cap = addMesh(
      scene,
      roundedBoxGeometry(1.7, 0.35, 2.0, 0.06, 2),
      brass,
      item.x,
      HALL_H * 0.78,
      item.z,
    );
    cap.rotation.y = item.rot;
    cap.userData.cast = true;
    cap.userData.pierCap = index;
  });

  return mesh;
}

function buildBossChamberAltar(scene, model, stone, steel) {
  const boss = model.interactables.find(item => item.boss);
  if (!boss) return null;
  const group = new THREE.Group();
  group.position.set(boss.x, 0, boss.z);
  const ring = addMesh(
    group,
    new THREE.TorusGeometry(5.4, 0.22, 8, 40),
    emissiveSurface('silicon', TAPEOUT_PALETTE.gold, 0.7, 1),
    0,
    0.35,
    0,
  );
  ring.rotation.x = Math.PI / 2;
  addMesh(group, roundedBoxGeometry(8.4, 0.45, 8.4, 0.1, 2), stone, 0, 0.22, 0);
  const wafer = addMesh(
    group,
    new THREE.CylinderGeometry(2.4, 2.4, 0.14, 36),
    pbrMaterial('silicon', TAPEOUT_PALETTE.silicon, {
      roughness: 0.2,
      metalness: 0.7,
      emissive: TAPEOUT_PALETTE.gold,
      emissiveIntensity: 0.4,
      repeat: 2,
    }),
    0,
    1.1,
    0,
  );
  wafer.userData.cast = true;
  const lamp = new THREE.PointLight(TAPEOUT_PALETTE.spill, 1.1, 28, 2);
  lamp.position.set(0, 6.4, 0);
  lamp.castShadow = false;
  lamp.userData.lightRole = 'path';
  lamp.userData.baseIntensity = lamp.intensity;
  group.add(lamp);
  scene.add(group);
  return group;
}

function buildDustMotes(scene, model, low) {
  const count = low ? 10 : 18;
  const geometry = roundedBoxGeometry(0.55, 0.28, 0.55, 0.06, 2);
  const material = pbrMaterial('concrete', 0x2a343e, {
    roughness: 0.88,
    metalness: 0.08,
    repeat: 1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x7a9e);
  const matrix = new THREE.Matrix4();
  const path = model.path || [];
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 28) {
    tries++;
    const x = bounds.minX + 6 + random() * (bounds.maxX - bounds.minX - 12);
    const z = bounds.minZ + 6 + random() * (bounds.maxZ - bounds.minZ - 12);
    if (!inHall(model, x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 5.2)) continue;
    if (Math.hypot(x - ALTAR.x, z - ALTAR.z) < 12) continue;
    const scale = 0.65 + random() * 1.1;
    matrix.compose(
      new THREE.Vector3(x, 0.16 * scale, z),
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

function buildTapeoutWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const stone = pbrMaterial('concrete', TAPEOUT_PALETTE.stone, {
    roughness: 0.8,
    metalness: 0.1,
    repeat: 4,
  });
  const plate = pbrMaterial('concrete', TAPEOUT_PALETTE.plate, {
    roughness: 0.88,
    metalness: 0.06,
    repeat: 5,
  });
  const steel = pbrMaterial('wornSteel', TAPEOUT_PALETTE.steel, {
    roughness: 0.46,
    metalness: 0.74,
    repeat: 3,
  });
  const brass = pbrMaterial('brass', TAPEOUT_PALETTE.brass, {
    roughness: 0.36,
    metalness: 0.86,
    repeat: 2,
  });

  scene.background = new THREE.Color(TAPEOUT_PALETTE.void);
  // Light fog — quiet depth without eating the wafer silhouette.
  scene.fog = new THREE.FogExp2(TAPEOUT_PALETTE.fog, 0.0088);
  scene.userData.baseFogDensity = 0.0088;

  const lighting = buildTapeoutLighting(scene, low);
  buildShell(scene, model, stone, plate);
  const frame = buildSpawnNave(scene, model, stone, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  const monument = buildWaferAltar(scene, stone, steel, brass);
  const shaft = buildLightShaft(scene);
  buildPiers(scene, model, stone, brass, low);
  buildBossChamberAltar(scene, model, stone, steel);
  const detail = buildDustMotes(scene, model, low);
  const atmosphere = dustField(model.bounds, TAPEOUT_PALETTE.ash, low ? 40 : 86);
  scene.add(atmosphere);
  const motes = dustField(
    { minX: ALTAR.x - 8, maxX: ALTAR.x + 8, minZ: ALTAR.z - 6, maxZ: ALTAR.z + 8 },
    TAPEOUT_PALETTE.spill,
    low ? 18 : 36,
  );
  motes.position.y = 4.5;
  scene.add(motes);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, false);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xffe27a);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.hero.intensity = 2.4 + Math.sin(time * 0.9) * 0.22;
    monument.wafer.material.emissiveIntensity = 0.48 + Math.sin(time * 1.1) * 0.12;
    monument.beacon.material.emissiveIntensity = 2.0 + Math.sin(time * 1.6) * 0.25;
    shaft.material.opacity = 0.016 + Math.sin(time * 0.55) * 0.007;
    atmosphere.rotation.y = time * 0.0025;
    motes.rotation.y = -time * 0.006;
  });

  const art = {
    world: 7,
    name: 'TAPEOUT',
    palette: TAPEOUT_PALETTE,
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
      saturation: 0.92,
      contrast: 1.12,
      tint: 0xfff0c8,
      lift: -0.02,
      gamma: 1.04,
      gain: 0.96,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  TAPEOUT_PALETTE,
  ALTAR,
  buildTapeoutWorldScene,
};

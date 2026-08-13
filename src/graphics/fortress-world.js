import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const FORTRESS_PALETTE = {
  void: 0x0a0608,
  fog: 0x1a0c12,
  concrete: 0x2a2226,
  plate: 0x1c1418,
  steel: 0x3a3238,
  brass: 0xb08a4a,
  rose: 0xfb7185,
  ember: 0xff4d6d,
  ash: 0xc4b4b8,
  spill: 0xffc0c8,
};

const HALL_H = 18.4;
const KEEP = { x: 0, z: -68 };

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

function buildFortressLighting(scene, low) {
  // Single-source drama: one hard key, almost no fill, cold rim only.
  const ambient = new THREE.AmbientLight(0x12080c, 0.06);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3a242c, 0x080406, 0.1);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(FORTRESS_PALETTE.spill, low ? 0.42 : 0.72);
  key.position.set(4, 42, KEEP.z + 18);
  key.target.position.set(KEEP.x, 10, KEEP.z);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -26;
  cam.right = 26;
  cam.top = 40;
  cam.bottom = -20;
  cam.near = 4;
  cam.far = 96;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(FORTRESS_PALETTE.rose, low ? 0.1 : 0.2);
  rim.position.set(-18, 14, KEEP.z - 24);
  rim.target.position.set(0, 5, -40);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, fill, key, rim };
}

function buildSpawnNave(scene, model, concrete, brass) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  const z = model.spawn.z - 10.2;
  [-1, 1].forEach(side => {
    const buttress = addMesh(
      frame,
      roundedBoxGeometry(2.2, 11.2, 2.6, 0.08, 2),
      concrete,
      side * 7.4,
      5.6,
      z,
    );
    buttress.userData.cast = true;
    const rib = addMesh(
      frame,
      roundedBoxGeometry(0.22, 9.2, 0.22, 0.04, 2),
      brass,
      side * 6.2,
      4.8,
      z + 0.7,
    );
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(16.4, 1.35, 2.2, 0.1, 2), concrete, 0, 11.2, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(8.4, 0.1, 0.1, 0.03, 2),
    emissiveSurface('silicon', FORTRESS_PALETTE.rose, 1.45, 1),
    0,
    10.45,
    z + 0.85,
  );
  const title = gothicLabel('FSM FORTRESS', '#FB7185', 0.95);
  title.position.set(0, 12.5, z + 0.35);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', FORTRESS_PALETTE.rose, 0.92, 4);
  const stud = emissiveSurface('silicon', FORTRESS_PALETTE.ember, 1.2, 1);
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
      pbrMaterial('concrete', 0x1a1216, {
        roughness: 0.78,
        metalness: 0.08,
        emissive: 0x220810,
        emissiveIntensity: 0.18,
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
    const marker = new THREE.Mesh(roundedBoxGeometry(0.4, 0.08, 0.4, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const last = index === path.length - 1;
    const pool = new THREE.PointLight(
      last ? FORTRESS_PALETTE.ember : FORTRESS_PALETTE.rose,
      last ? 1.05 : 0.42,
      last ? 24 : 13,
      1.9,
    );
    pool.position.set(point.x, last ? 5.8 : 3.2, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildStateKeep(scene, concrete, steel, brass) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(KEEP.x, 0, KEEP.z);

  // Oppressive brutalist mass — reads as a tower from spawn.
  const plinth = addMesh(
    landmark,
    roundedBoxGeometry(14.4, 2.2, 10.8, 0.12, 2),
    concrete,
    0,
    1.1,
    0,
  );
  plinth.userData.cast = true;

  const shaft = addMesh(
    landmark,
    roundedBoxGeometry(9.6, 16.8, 7.2, 0.1, 2),
    concrete,
    0,
    10.4,
    -0.4,
  );
  shaft.userData.cast = true;

  const crown = addMesh(
    landmark,
    roundedBoxGeometry(12.2, 2.6, 8.8, 0.08, 2),
    steel,
    0,
    19.6,
    -0.4,
  );
  crown.userData.cast = true;

  // Crenel teeth along the crown
  for (let i = -2; i <= 2; i++) {
    const tooth = addMesh(
      landmark,
      roundedBoxGeometry(1.5, 1.8, 1.4, 0.06, 2),
      concrete,
      i * 2.2,
      21.6,
      -3.6,
    );
    tooth.userData.cast = true;
  }

  [-1, 1].forEach(side => {
    const wing = addMesh(
      landmark,
      roundedBoxGeometry(3.2, 12.4, 3.2, 0.1, 2),
      concrete,
      side * 7.8,
      7.0,
      1.2,
    );
    wing.userData.cast = true;
    const brace = addMesh(
      landmark,
      roundedBoxGeometry(0.28, 10.2, 0.28, 0.04, 2),
      brass,
      side * 6.2,
      6.4,
      2.4,
    );
    brace.userData.cast = true;
  });

  // Single hero aperture — the only bright face of the keep.
  const aperture = addMesh(
    landmark,
    roundedBoxGeometry(3.6, 7.2, 0.35, 0.08, 2),
    emissiveSurface('silicon', FORTRESS_PALETTE.rose, 1.55, 1),
    0,
    9.2,
    3.4,
  );
  aperture.userData.glow = true;

  const under = new THREE.PointLight(FORTRESS_PALETTE.rose, 1.85, 42, 2);
  under.position.set(0, 8.4, 4.2);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);

  landmark.add(fxCone(FORTRESS_PALETTE.rose, 4.2, 20, 0.05, 0, 1.2));
  const marquee = gothicLabel('THE STATE KEEP', '#FB7185', 1.3);
  marquee.position.set(0, 23.4, 2.2);
  landmark.add(marquee);

  scene.add(landmark);
  return { landmark, under, aperture };
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: FORTRESS_PALETTE.rose,
    transparent: true,
    opacity: 0.018,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(7.2, 26, 20, 1, true), material);
  shaft.position.set(KEEP.x, 14, KEEP.z + 2);
  shaft.rotation.z = 0.04;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildShell(scene, model, concrete, plate) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const fw = (bounds.maxX - bounds.minX) + 22;
  const fd = (bounds.maxZ - bounds.minZ) + 22;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('concrete', FORTRESS_PALETTE.plate, {
      roughness: 0.82,
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
    pbrMaterial('concrete', FORTRESS_PALETTE.concrete, {
      roughness: 0.74,
      metalness: 0.12,
      repeat: 8,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, HALL_H, cz);
  scene.add(ceiling);

  const ribbon = emissiveSurface('silicon', FORTRESS_PALETTE.rose, 0.42, 2);
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.5, HALL_H, sz + 0.5),
      length > 40 ? plate : concrete,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, HALL_H / 2, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 16) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, sx * 0.88), 0.12, Math.max(0.2, sz * 0.88)),
        ribbon,
      );
      bar.position.set(mesh.position.x, 5.2, mesh.position.z);
      scene.add(bar);
    }
  });
}

function buildButtresses(scene, model, concrete, low) {
  const path = model.path || [];
  const items = [];
  const half = 11.4;
  const step = low ? 18 : 14;
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
    for (let s = 10; s < len - 8; s += step) {
      [-1, 1].forEach(side => {
        const x = a.x + ux * s + px * side * half;
        const z = a.z + uz * s + pz * side * half;
        if (!inHall(model, x, z)) return;
        // Keep the spawn view clear of side clutter near the keep.
        if (Math.hypot(x - KEEP.x, z - KEEP.z) < 16) return;
        items.push({
          x,
          z,
          y: HALL_H * 0.42,
          rot: Math.atan2(px * side, pz * side),
          scaleY: 0.9 + (side > 0 ? 0.15 : 0),
        });
      });
    }
  }
  const mesh = new THREE.InstancedMesh(
    roundedBoxGeometry(1.8, 12.4, 2.4, 0.08, 2),
    concrete,
    items.length,
  );
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  items.forEach((item, index) => {
    quat.setFromEuler(new THREE.Euler(0, item.rot, 0));
    matrix.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      quat,
      new THREE.Vector3(1, item.scaleY, 1),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);
  return mesh;
}

function buildBanners(scene, model, low) {
  const sites = [
    { x: -8.4, z: -36 },
    { x: 8.4, z: -36 },
    { x: -8.4, z: -92 },
    { x: 8.4, z: -92 },
    { x: 52, z: -104 },
    { x: 92, z: -140 },
    { x: 110, z: -180 },
  ];
  const cloth = emissiveSurface('paintedMetal', FORTRESS_PALETTE.rose, 0.55, 1);
  const poles = pbrMaterial('brass', FORTRESS_PALETTE.brass, {
    roughness: 0.4,
    metalness: 0.82,
    repeat: 1,
  });
  const hanging = [];
  sites.forEach((site, index) => {
    if (low && index % 2 === 1) return;
    if (!inHall(model, site.x, site.z)) return;
    const group = new THREE.Group();
    group.position.set(site.x, HALL_H - 0.6, site.z);
    addMesh(group, new THREE.BoxGeometry(0.12, 5.8, 0.12), poles, 0, -2.9, 0);
    const banner = addMesh(group, roundedBoxGeometry(1.6, 3.4, 0.08, 0.04, 2), cloth, 0, -4.6, 0.2);
    banner.userData.sway = 0.6 + index * 0.17;
    scene.add(group);
    hanging.push(group);
  });
  return hanging;
}

function buildDebris(scene, model, low) {
  const count = low ? 12 : 24;
  const geometry = roundedBoxGeometry(0.9, 0.5, 0.9, 0.08, 2);
  const material = pbrMaterial('concrete', 0x3a2a30, {
    roughness: 0.85,
    metalness: 0.1,
    repeat: 1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x6f57);
  const matrix = new THREE.Matrix4();
  const path = model.path || [];
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 24) {
    tries++;
    const x = bounds.minX + 6 + random() * (bounds.maxX - bounds.minX - 12);
    const z = bounds.minZ + 6 + random() * (bounds.maxZ - bounds.minZ - 12);
    if (!inHall(model, x, z)) continue;
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 5.6)) continue;
    if (Math.hypot(x - KEEP.x, z - KEEP.z) < 14) continue;
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

function buildFortressWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const concrete = pbrMaterial('concrete', FORTRESS_PALETTE.concrete, {
    roughness: 0.78,
    metalness: 0.1,
    repeat: 4,
  });
  const plate = pbrMaterial('concrete', FORTRESS_PALETTE.plate, {
    roughness: 0.86,
    metalness: 0.06,
    repeat: 5,
  });
  const steel = pbrMaterial('wornSteel', FORTRESS_PALETTE.steel, {
    roughness: 0.48,
    metalness: 0.72,
    repeat: 3,
  });
  const brass = pbrMaterial('brass', FORTRESS_PALETTE.brass, {
    roughness: 0.38,
    metalness: 0.84,
    repeat: 2,
  });

  scene.background = new THREE.Color(FORTRESS_PALETTE.void);
  scene.fog = new THREE.FogExp2(FORTRESS_PALETTE.fog, 0.014);
  scene.userData.baseFogDensity = 0.014;

  const lighting = buildFortressLighting(scene, low);
  buildShell(scene, model, concrete, plate);
  const frame = buildSpawnNave(scene, model, concrete, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  const monument = buildStateKeep(scene, concrete, steel, brass);
  const shaft = buildLightShaft(scene);
  buildButtresses(scene, model, concrete, low);
  const banners = buildBanners(scene, model, low);
  const detail = buildDebris(scene, model, low);
  const atmosphere = dustField(model.bounds, FORTRESS_PALETTE.ash, low ? 48 : 100);
  scene.add(atmosphere);
  const motes = dustField(
    { minX: KEEP.x - 10, maxX: KEEP.x + 10, minZ: KEEP.z - 8, maxZ: KEEP.z + 10 },
    FORTRESS_PALETTE.rose,
    low ? 22 : 46,
  );
  motes.position.y = 5;
  scene.add(motes);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, false);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.under.intensity = 1.65 + Math.sin(time * 1.4) * 0.28;
    monument.aperture.material.emissiveIntensity = 1.35 + Math.sin(time * 1.9) * 0.25;
    shaft.material.opacity = 0.012 + Math.sin(time * 0.65) * 0.006;
    atmosphere.rotation.y = time * 0.003;
    motes.rotation.y = -time * 0.008;
    banners.forEach((group, index) => {
      group.rotation.z = Math.sin(time * 0.9 + index) * 0.08;
    });
  });

  const art = {
    world: 6,
    name: 'FSM Fortress',
    palette: FORTRESS_PALETTE,
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
      saturation: 0.94,
      contrast: 1.18,
      tint: 0xffd8dc,
      lift: -0.03,
      gamma: 1.05,
      gain: 0.98,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  FORTRESS_PALETTE,
  KEEP,
  buildFortressWorldScene,
};

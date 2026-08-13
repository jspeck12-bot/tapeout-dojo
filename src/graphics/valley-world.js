import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const VALLEY_PALETTE = {
  void: 0x050806,
  fog: 0x0c1812,
  stone: 0x3a4638,
  cliff: 0x2a3428,
  floor: 0x2c382c,
  brass: 0xb08a4a,
  steel: 0x4a5560,
  lime: 0xa3e635,
  cyan: 0x69e7ff,
  amber: 0xffc76b,
  spill: 0xd4eccc,
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

function buildValleyLighting(scene, model, low) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const ambient = new THREE.AmbientLight(0x1a2418, 0.16);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3a5a3a, 0x0a100c, 0.26);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(VALLEY_PALETTE.spill, low ? 0.4 : 0.64);
  key.position.set(cx + 36, 72, cz + 54);
  key.target.position.set(cx, 0, cz);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -70;
  cam.right = 70;
  cam.top = 90;
  cam.bottom = -40;
  cam.near = 10;
  cam.far = 220;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(VALLEY_PALETTE.lime, low ? 0.16 : 0.3);
  rim.position.set(cx - 48, 40, cz - 28);
  rim.target.position.set(cx, 2, cz);
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
  const z = model.spawn.z - 9.6;
  [-1, 1].forEach(side => {
    const pier = addMesh(frame, roundedBoxGeometry(1.8, 8.2, 2.1, 0.18, 3), stone, side * 7.1, 4.1, z);
    pier.userData.cast = true;
    const rib = addMesh(frame, roundedBoxGeometry(0.22, 7.0, 0.22, 0.04, 2), brass, side * 6.2, 3.6, z + 0.7);
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(16.2, 1.15, 2.2, 0.16, 3), stone, 0, 8.15, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(8.4, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', VALLEY_PALETTE.lime, 1.3, 1),
    0,
    7.55,
    z + 0.85,
  );
  const title = gothicLabel('GATE VALLEY', '#A3E635', 0.96);
  title.position.set(0, 9.45, z + 0.4);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', VALLEY_PALETTE.lime, 0.88, 4);
  const stud = emissiveSurface('silicon', VALLEY_PALETTE.amber, 1.15, 1);
  const path = model.path || [];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const ribbon = new THREE.Mesh(roundedBoxGeometry(1.45, 0.045, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.42, 0.08, 0.42, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const last = index === path.length - 1;
    const pool = new THREE.PointLight(
      last ? VALLEY_PALETTE.amber : VALLEY_PALETTE.lime,
      last ? 0.95 : 0.48,
      last ? 20 : 12,
      1.8,
    );
    pool.position.set(point.x, last ? 5.0 : 2.6, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildMonolith(scene, model, brass, steel) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(model.gateX || 0, 0, model.gateZ || 0);

  const slab = addMesh(landmark, roundedBoxGeometry(6.4, 22, 2.4, 0.22, 3), steel, 0, 11, 0);
  slab.userData.cast = true;
  [-1, 1].forEach(side => {
    const pier = addMesh(landmark, roundedBoxGeometry(1.7, 18, 2.8, 0.18, 3), brass, side * 4.6, 9, 0);
    pier.userData.cast = true;
  });
  const lintel = addMesh(landmark, roundedBoxGeometry(12.2, 1.4, 3.0, 0.16, 3), brass, 0, 18.6, 0);
  lintel.userData.cast = true;
  addMesh(
    landmark,
    roundedBoxGeometry(7.2, 0.12, 0.12, 0.04, 2),
    emissiveSurface('silicon', VALLEY_PALETTE.lime, 1.35, 1),
    0,
    17.85,
    1.35,
  );

  const halo = addMesh(
    landmark,
    new THREE.TorusGeometry(5.4, 0.22, 10, 48),
    emissiveSurface('silicon', VALLEY_PALETTE.lime, 1.1, 1),
    0,
    12.4,
    0,
  );
  halo.rotation.x = Math.PI / 2;
  const xor = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.14, 8, 40),
    new THREE.MeshBasicMaterial({ color: VALLEY_PALETTE.lime, transparent: true, opacity: 0.72 }),
  );
  xor.position.set(0, 12.4, 0);
  xor.rotation.y = 0.4;
  landmark.add(xor);

  const under = new THREE.PointLight(VALLEY_PALETTE.lime, 1.4, 52, 2);
  under.position.set(0, 10, 0);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);
  landmark.add(fxCone(VALLEY_PALETTE.lime, 3.4, 16, 0.05, 0, 0));
  landmark.add(fxCone(VALLEY_PALETTE.amber, 1.8, 14, 0.04, 0, 0));

  const marquee = gothicLabel('THE UNIVERSAL MONOLITH', '#A3E635', 1.35);
  marquee.position.set(0, 21.2, 0);
  landmark.add(marquee);

  scene.add(landmark);
  return { landmark, halo, xor, under };
}

function buildLightShaft(scene, model) {
  const material = new THREE.MeshBasicMaterial({
    color: VALLEY_PALETTE.lime,
    transparent: true,
    opacity: 0.016,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(12, 32, 24, 1, true), material);
  shaft.position.set(model.gateX || 0, 18, model.gateZ || 0);
  shaft.rotation.z = 0.08;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildValleyFloor(scene, model) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const fw = (bounds.maxX - bounds.minX) + 220;
  const fd = (bounds.maxZ - bounds.minZ) + 220;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fd),
    pbrMaterial('wetRock', VALLEY_PALETTE.floor, {
      roughness: 0.52,
      metalness: 0.08,
      repeat: 10,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const court = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 0.08, 40),
    pbrMaterial('silicon', 0x2a3a2e, {
      roughness: 0.28,
      metalness: 0.58,
      emissive: 0x143018,
      emissiveIntensity: 0.22,
      repeat: 3,
    }),
  );
  court.position.set(0, 0.04, (model.spawn.z + (model.gateZ || 0)) / 2);
  court.receiveShadow = true;
  scene.add(court);
  return { ground, court };
}

function buildCliffs(scene, model, stone) {
  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const height = length > 40 ? 16 : 12;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx + 0.6, height, sz + 0.6),
      stone,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, height / 2 - 0.4, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if (length > 18) {
      const bar = new THREE.Mesh(
        roundedBoxGeometry(Math.max(0.2, sx * 0.92), 0.1, Math.max(0.2, sz * 0.92), 0.03, 2),
        emissiveSurface('silicon', VALLEY_PALETTE.lime, 0.55, 2),
      );
      bar.position.set(mesh.position.x, height - 0.2, mesh.position.z);
      scene.add(bar);
    }
  });
}

function buildRuinArches(scene, model, stone, brass) {
  const scale = model.worldScale || 1;
  const sites = [
    { x: -38 * scale, z: -34 * scale, w: 7.4, h: 6.2 },
    { x: 40 * scale, z: -56 * scale, w: 7.4, h: 6.2 },
    { x: -18 * scale, z: -82 * scale, w: 6.4, h: 5.6 },
  ];
  sites.forEach(site => {
    const group = new THREE.Group();
    [-1, 1].forEach(side => {
      const pier = addMesh(
        group,
        roundedBoxGeometry(0.95, site.h, 0.95, 0.12, 3),
        stone,
        site.x + side * site.w / 2,
        site.h / 2,
        site.z,
      );
      pier.userData.cast = true;
    });
    const lint = addMesh(
      group,
      roundedBoxGeometry(site.w + 1.6, 0.9, 1.05, 0.12, 3),
      stone,
      site.x,
      site.h - 0.05,
      site.z,
    );
    lint.userData.cast = true;
    addMesh(
      group,
      roundedBoxGeometry(site.w * 0.62, 0.12, 0.18, 0.04, 2),
      brass,
      site.x,
      site.h + 0.42,
      site.z,
    );
    scene.add(group);
  });
}

function buildSkyTraces(scene, model) {
  const bounds = model.bounds;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = bounds.maxZ - bounds.minZ;
  [-28, -8, 12, 32].forEach((x, index) => {
    const beam = new THREE.Mesh(
      roundedBoxGeometry(0.12, 0.08, span * 0.72, 0.03, 2),
      emissiveSurface('silicon', index % 2 ? VALLEY_PALETTE.cyan : VALLEY_PALETTE.lime, 0.7, 3),
    );
    beam.position.set(x, 22 + (index % 2) * 3.5, cz);
    scene.add(beam);
  });
}

function buildMountains(scene, model, low) {
  const bounds = model.bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const count = low ? 8 : 16;
  const geometry = new THREE.ConeGeometry(18, 48, 5, 1);
  const material = pbrMaterial('wetRock', VALLEY_PALETTE.cliff, {
    roughness: 0.92,
    metalness: 0.04,
    repeat: 3,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x7a11);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index++) {
    const ang = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.18;
    const rad = 118 + random() * 42;
    const h = 0.7 + random() * 0.7;
    matrix.compose(
      new THREE.Vector3(cx + Math.cos(ang) * rad, 18 * h - 4, cz + Math.sin(ang) * rad),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, (random() - 0.5) * 0.08)),
      new THREE.Vector3(0.7 + random() * 0.5, h, 0.7 + random() * 0.5),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.cast = true;
  scene.add(mesh);
  return mesh;
}

function buildStelae(scene, model, stone) {
  const random = mulberry32(0x2e01);
  const path = model.path || [];
  const nodes = (model.interactables || []).map(item => ({ x: item.x, z: item.z }));
  const cap = emissiveSurface('silicon', VALLEY_PALETTE.lime, 0.85, 1);
  const bounds = model.bounds;
  let placed = 0;
  let tries = 0;
  while (placed < 32 && tries < 480) {
    tries++;
    const x = bounds.minX + 10 + random() * (bounds.maxX - bounds.minX - 20);
    const z = bounds.minZ + 10 + random() * (bounds.maxZ - bounds.minZ - 20);
    if (path.some(point => Math.hypot(point.x - x, point.z - z) < 7)) continue;
    if (nodes.some(point => Math.hypot(point.x - x, point.z - z) < 6)) continue;
    const h = 2.8 + random() * 3.4;
    const post = new THREE.Mesh(roundedBoxGeometry(0.42, h, 0.42, 0.06, 2), stone);
    post.position.set(x, h / 2, z);
    post.userData.cast = true;
    scene.add(post);
    const tip = new THREE.Mesh(roundedBoxGeometry(0.28, 0.16, 0.28, 0.04, 2), cap);
    tip.position.set(x, h + 0.12, z);
    scene.add(tip);
    placed++;
  }
}

function buildDebris(scene, model, low) {
  const count = low ? 16 : 42;
  const geometry = new THREE.BoxGeometry(0.8, 0.7, 0.8);
  const material = pbrMaterial('wetRock', VALLEY_PALETTE.stone, {
    roughness: 0.78,
    metalness: 0.08,
    repeat: 1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x51c2);
  const matrix = new THREE.Matrix4();
  const bounds = model.bounds;
  const path = model.path || [];
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 18) {
    tries++;
    const x = bounds.minX + 8 + random() * (bounds.maxX - bounds.minX - 16);
    const z = bounds.minZ + 8 + random() * (bounds.maxZ - bounds.minZ - 16);
    const onPath = path.some(point => Math.hypot(point.x - x, point.z - z) < 6);
    if (onPath) continue;
    const scale = 0.6 + random() * 1.4;
    matrix.compose(
      new THREE.Vector3(x, 0.32 * scale, z),
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
  const count = low ? 70 : 150;
  const pos = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 0.82);
    const r = 420;
    pos[index * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[index * 3 + 1] = r * Math.cos(ph) + 8;
    pos[index * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xc8e8b8,
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.78,
  })));
}

function buildValleyWorldScene(scene, model, theme, helpers) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  } = helpers;

  const stone = pbrMaterial('wetRock', VALLEY_PALETTE.stone, {
    roughness: 0.72,
    metalness: 0.06,
    repeat: 3,
  });
  const brass = pbrMaterial('brass', VALLEY_PALETTE.brass, { roughness: 0.38, metalness: 0.82, repeat: 2 });
  const steel = pbrMaterial('wornSteel', VALLEY_PALETTE.steel, { roughness: 0.42, metalness: 0.76, repeat: 2 });

  scene.background = new THREE.Color(VALLEY_PALETTE.void);
  scene.fog = new THREE.FogExp2(VALLEY_PALETTE.fog, 0.0066);
  scene.userData.baseFogDensity = 0.0066;

  const lighting = buildValleyLighting(scene, model, low);
  buildStars(scene, low);
  buildValleyFloor(scene, model);
  const frame = buildSpawnNave(scene, model, stone, brass);
  const pathLighting = buildPathLighting(scene, model, low);
  buildCliffs(scene, model, stone);
  buildRuinArches(scene, model, stone, brass);
  buildSkyTraces(scene, model);
  buildMountains(scene, model, low);
  buildStelae(scene, model, stone);
  const monument = buildMonolith(scene, model, brass, steel);
  const shaft = buildLightShaft(scene, model);
  const detail = buildDebris(scene, model, low);
  const atmosphere = dustField(model.bounds, VALLEY_PALETTE.lime, low ? 50 : 110);
  scene.add(atmosphere);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  api.nextGrp = api.nextGrp || makeNextBeacon(scene, theme.accent, true);
  if (!api.exploration) api.exploration = buildExplorationProps(scene, model, theme.accent);
  if (!api.fogGate) api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    monument.halo.rotation.z = time * 0.28;
    monument.xor.rotation.y = time * 0.18;
    monument.under.intensity = 1.25 + Math.sin(time * 1.6) * 0.28;
    shaft.material.opacity = 0.012 + Math.sin(time * 0.7) * 0.005;
    atmosphere.rotation.y = time * 0.004;
  });

  const art = {
    world: 2,
    name: 'Gate Valley',
    palette: VALLEY_PALETTE,
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
      contrast: 1.12,
      tint: 0xd8f0d4,
      lift: -0.02,
      gamma: 1.03,
      gain: 1.0,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  VALLEY_PALETTE,
  buildValleyWorldScene,
};

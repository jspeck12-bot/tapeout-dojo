import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, dustField } from './cinematic.js';

const ARCADE_PALETTE = {
  void: 0x06040c,
  fog: 0x120818,
  plate: 0x12101a,
  steel: 0x2a3140,
  brass: 0xb08a4a,
  magenta: 0xff7df0,
  cyan: 0x22d3ee,
  lime: 0xa3e635,
  amber: 0xffc76b,
  spill: 0xffd6f5,
};

const HALL_H = 5.4;
const MARQUEE = { x: 0, z: 0 };

const PATH = [
  { x: 0, z: 28 },
  { x: 0, z: 20 },
  { x: 0, z: 10 },
  { x: 0, z: 0 },
  { x: 0, z: -12 },
  { x: 0, z: -18 },
];

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

function parseAccent(accent) {
  if (typeof accent === 'number') return accent;
  if (typeof accent === 'string') {
    const hex = accent.startsWith('#') ? accent.slice(1) : accent;
    const value = Number.parseInt(hex, 16);
    return Number.isFinite(value) ? value : ARCADE_PALETTE.magenta;
  }
  return ARCADE_PALETTE.magenta;
}

function buildArcadeLighting(scene, low) {
  const ambient = new THREE.AmbientLight(0x1a1020, 0.16);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3a2848, 0x08060c, 0.22);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(ARCADE_PALETTE.spill, low ? 0.38 : 0.62);
  key.position.set(8, 28, 18);
  key.target.position.set(MARQUEE.x, 2.4, MARQUEE.z);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -26;
  cam.right = 26;
  cam.top = 30;
  cam.bottom = -18;
  cam.near = 4;
  cam.far = 70;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(ARCADE_PALETTE.cyan, low ? 0.14 : 0.26);
  rim.position.set(-22, 14, -16);
  rim.target.position.set(0, 2, -4);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, fill, key, rim };
}

function buildEntranceFrame(scene, steel, brass) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  const z = 25.2;
  [-1, 1].forEach(side => {
    const pier = addMesh(
      frame,
      roundedBoxGeometry(1.4, 5.2, 1.6, 0.12, 2),
      steel,
      side * 4.4,
      2.6,
      z,
    );
    pier.userData.cast = true;
    const rib = addMesh(
      frame,
      roundedBoxGeometry(0.16, 4.4, 0.16, 0.04, 2),
      brass,
      side * 3.7,
      2.3,
      z + 0.45,
    );
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(10.2, 0.9, 1.7, 0.12, 2), steel, 0, 5.15, z);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(6.4, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', ARCADE_PALETTE.magenta, 1.2, 1),
    0,
    4.7,
    z + 0.55,
  );
  const title = gothicLabel('THE ARCADE', '#FF7DF0', 0.88);
  title.position.set(0, 5.85, z + 0.25);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', ARCADE_PALETTE.magenta, 0.4, 4);
  const stud = emissiveSurface('silicon', ARCADE_PALETTE.cyan, 0.7, 1);
  for (let index = 0; index < PATH.length - 1; index++) {
    const a = PATH[index];
    const b = PATH[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const pavement = new THREE.Mesh(
      roundedBoxGeometry(2.6, 0.04, len + 0.2, 0.04, 2),
      pbrMaterial('concrete', 0x141018, {
        roughness: 0.78,
        metalness: 0.12,
        emissive: 0x1a0814,
        emissiveIntensity: 0.18,
        repeat: 3,
      }),
    );
    pavement.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    pavement.rotation.y = Math.atan2(dx, dz);
    pavement.receiveShadow = true;
    group.add(pavement);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(0.28, 0.04, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  PATH.forEach((point, index) => {
    if (index === 0) return;
    const post = new THREE.Mesh(roundedBoxGeometry(0.18, 0.9, 0.18, 0.04, 2), stud);
    post.position.set(point.x + (index % 2 ? 1.1 : -1.1), 0.45, point.z);
    post.userData.cast = true;
    group.add(post);
    if (!low) {
      const lamp = new THREE.PointLight(
        index % 2 ? ARCADE_PALETTE.cyan : ARCADE_PALETTE.magenta,
        0.35,
        9,
        2,
      );
      lamp.position.set(point.x + (index % 2 ? 1.1 : -1.1), 1.05, point.z);
      lamp.castShadow = false;
      lamp.userData.lightRole = 'path';
      lamp.userData.baseIntensity = lamp.intensity;
      group.add(lamp);
    }
  });
  scene.add(group);
  return group;
}

function buildShell(scene, model, plate, steel) {
  const b = model.bounds;
  const pad = 4;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2, 6, 6),
    pbrMaterial('concrete', ARCADE_PALETTE.plate, {
      roughness: 0.72,
      metalness: 0.18,
      repeat: 8,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2, 4, 4),
    pbrMaterial('paintedMetal', 0x0c0a12, {
      roughness: 0.86,
      metalness: 0.35,
      repeat: 6,
    }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, HALL_H, cz);
  scene.add(ceil);

  model.colliders.forEach((wall, index) => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const mesh = new THREE.Mesh(
      roundedBoxGeometry(Math.max(0.4, sx), HALL_H, Math.max(0.4, sz), 0.08, 2),
      sx > 8 || sz > 8 ? plate : steel,
    );
    mesh.position.set((wall.minX + wall.maxX) / 2, HALL_H / 2, (wall.minZ + wall.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
    if ((sx > 6 || sz > 6) && index < 10) {
      const neon = [
        ARCADE_PALETTE.magenta,
        ARCADE_PALETTE.cyan,
        ARCADE_PALETTE.lime,
        ARCADE_PALETTE.amber,
      ][index % 4];
      const strip = new THREE.Mesh(
        roundedBoxGeometry(Math.max(0.3, sx * 0.94), 0.1, Math.max(0.3, sz * 0.94), 0.03, 2),
        emissiveSurface('silicon', neon, 0.95, 2),
      );
      strip.position.set(
        (wall.minX + wall.maxX) / 2,
        HALL_H - 0.35,
        (wall.minZ + wall.maxZ) / 2,
      );
      scene.add(strip);
    }
  });
}

function buildMarqueeLandmark(scene, steel, brass) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(MARQUEE.x, 0, MARQUEE.z);

  const base = addMesh(
    landmark,
    roundedBoxGeometry(2.4, 0.55, 2.4, 0.12, 2),
    steel,
    0,
    0.28,
    0,
  );
  base.userData.cast = true;

  const column = addMesh(
    landmark,
    roundedBoxGeometry(0.55, 3.6, 0.55, 0.08, 2),
    brass,
    0,
    2.1,
    0,
  );
  column.userData.cast = true;

  const core = addMesh(
    landmark,
    roundedBoxGeometry(0.22, 3.2, 0.22, 0.04, 2),
    emissiveSurface('silicon', ARCADE_PALETTE.cyan, 1.35, 1),
    0,
    2.2,
    0,
  );
  core.userData.cast = true;

  // Unfogged neon beacon so the marquee reads from spawn through bloom.
  // Face-on slab so the marquee reads as a cabinet totem, not a sun disk.
  const beacon = new THREE.Mesh(
    roundedBoxGeometry(1.35, 1.35, 0.22, 0.06, 2),
    emissiveSurface('silicon', ARCADE_PALETTE.magenta, 1.15, 1),
  );
  beacon.position.set(0, 4.35, 0.62);
  beacon.rotation.x = -0.18;
  beacon.material.fog = false;
  landmark.add(beacon);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.16, 10, 28),
    emissiveSurface('silicon', ARCADE_PALETTE.cyan, 1.15, 1),
  );
  crown.position.set(0, 3.7, 0);
  crown.rotation.x = Math.PI / 2;
  crown.material.fog = false;
  landmark.add(crown);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.09, 8, 36),
    new THREE.MeshBasicMaterial({
      color: ARCADE_PALETTE.magenta,
      transparent: true,
      opacity: 0.62,
      fog: false,
      toneMapped: false,
    }),
  );
  halo.position.set(0, 3.7, 0);
  halo.rotation.x = 0.55;
  landmark.add(halo);

  const sign = gothicLabel('NEON HALL', '#22D3EE', 0.78);
  sign.position.set(0, 5.35, 0.35);
  landmark.add(sign);

  const under = new THREE.PointLight(ARCADE_PALETTE.magenta, 1.1, 18, 1.6);
  under.position.set(0, 4.2, 0);
  under.castShadow = false;
  under.userData.lightRole = 'landmark';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);

  scene.add(landmark);
  return { landmark, spin: halo, under };
}

function buildCabinet(scene, item, spawnZ, steel, brass) {
  const accent = parseAccent(item.accent);
  const group = new THREE.Group();
  group.position.set(item.x, 0, item.z);

  const body = addMesh(
    group,
    roundedBoxGeometry(1.55, 2.75, 1.15, 0.1, 2),
    pbrMaterial('paintedMetal', 0x0c0c16, {
      roughness: 0.48,
      metalness: 0.55,
      repeat: 2,
    }),
    0,
    1.38,
    0,
  );
  body.userData.cast = true;

  const trim = addMesh(
    group,
    roundedBoxGeometry(1.62, 0.12, 1.22, 0.04, 2),
    brass,
    0,
    2.55,
    0,
  );
  trim.userData.cast = true;

  const marquee = addMesh(
    group,
    roundedBoxGeometry(1.35, 0.28, 0.18, 0.05, 2),
    emissiveSurface('silicon', accent, 1.15, 1),
    0,
    2.95,
    0.42,
  );
  marquee.userData.cast = true;

  const faceZ = item.z < spawnZ ? 1 : -1;
  const screenMat = emissiveSurface('silicon', accent, 1.45, 1);
  screenMat.fog = false;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.78), screenMat);
  screen.position.set(0, 1.92, 0.58 * faceZ);
  if (faceZ < 0) screen.rotation.y = Math.PI;
  group.add(screen);

  const bezel = addMesh(
    group,
    roundedBoxGeometry(1.2, 0.95, 0.12, 0.04, 2),
    steel,
    0,
    1.92,
    0.5 * faceZ,
  );
  bezel.userData.cast = true;

  const control = addMesh(
    group,
    roundedBoxGeometry(1.2, 0.18, 0.55, 0.05, 2),
    pbrMaterial('wornSteel', ARCADE_PALETTE.steel, {
      roughness: 0.42,
      metalness: 0.72,
      repeat: 1,
    }),
    0,
    1.15,
    0.35 * faceZ,
  );
  control.userData.cast = true;

  [-0.28, 0.28].forEach((x, index) => {
    const knob = addMesh(
      group,
      new THREE.SphereGeometry(0.08, 10, 10),
      emissiveSurface('silicon', index ? ARCADE_PALETTE.cyan : accent, 1.1, 1),
      x,
      1.28,
      0.52 * faceZ,
    );
    knob.userData.cast = true;
  });

  const light = new THREE.PointLight(accent, 0.72, 11, 1.8);
  light.position.set(0, 2.65, 0);
  light.castShadow = false;
  light.userData.lightRole = 'cabinet';
  light.userData.baseIntensity = light.intensity;
  group.add(light);

  // Keep cabinet titles below the marquee crown so they do not stack on NEON HALL.
  const label = gothicLabel(item.label, '#' + new THREE.Color(accent).getHexString(), 0.48);
  label.position.set(0, 3.25, 0);
  group.add(label);

  scene.add(fxCone(accent, 1.35, 4.2, 0.04, item.x, item.z));
  scene.add(group);
  return { screenMat, light, group };
}

function buildLightShaft(scene) {
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.8, 7.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: ARCADE_PALETTE.magenta,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  shaft.position.set(MARQUEE.x, 3.6, MARQUEE.z);
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildCeilingTrusses(scene, steel) {
  const cool = emissiveSurface('silicon', ARCADE_PALETTE.cyan, 0.42, 2);
  // Skip the mid truss (z=0) so the marquee crown is not crushed by a hot bar.
  [-14, 14].forEach((z, index) => {
    const beam = new THREE.Mesh(
      roundedBoxGeometry(36, 0.28, 0.42, 0.06, 2),
      steel,
    );
    beam.position.set(0, HALL_H - 0.55, z);
    beam.userData.cast = true;
    scene.add(beam);
    const neon = new THREE.Mesh(
      roundedBoxGeometry(34, 0.08, 0.1, 0.03, 2),
      index % 2
        ? cool
        : emissiveSurface('silicon', ARCADE_PALETTE.magenta, 0.48, 2),
    );
    neon.position.set(0, HALL_H - 0.72, z);
    scene.add(neon);
  });
}

function buildArcadeWorldScene(scene, model) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const plate = pbrMaterial('concrete', ARCADE_PALETTE.plate, { roughness: 0.78, metalness: 0.14, repeat: 3 });
  const steel = pbrMaterial('wornSteel', ARCADE_PALETTE.steel, { roughness: 0.4, metalness: 0.78, repeat: 3 });
  const brass = pbrMaterial('brass', ARCADE_PALETTE.brass, { roughness: 0.38, metalness: 0.82, repeat: 2 });

  scene.background = new THREE.Color(ARCADE_PALETTE.void);
  scene.fog = new THREE.FogExp2(ARCADE_PALETTE.fog, 0.018);
  scene.userData.baseFogDensity = 0.018;
  scene.userData.baseExposure = 0.88;

  const lighting = buildArcadeLighting(scene, low);
  buildShell(scene, model, plate, steel);
  buildCeilingTrusses(scene, steel);
  const frame = buildEntranceFrame(scene, steel, brass);
  const pathLighting = buildPathLighting(scene, low);
  const marquee = buildMarqueeLandmark(scene, steel, brass);
  const shaft = buildLightShaft(scene);

  const api = { cabinets: {}, spin: marquee.spin, anims: [] };

  model.interactables.filter(item => item.kind === 'arcade').forEach(item => {
    api.cabinets[item.id] = buildCabinet(scene, item, model.spawn.z, steel, brass);
  });

  const lift = model.interactables.find(item => item.kind === 'exit');
  if (lift) {
    const padMesh = new THREE.Mesh(
      roundedBoxGeometry(4.4, 0.16, 4.4, 0.08, 2),
      pbrMaterial('silicon', 0x4a1a22, {
        roughness: 0.32,
        metalness: 0.55,
        emissive: 0x7a2a30,
        emissiveIntensity: 0.55,
        repeat: 2,
      }),
    );
    padMesh.position.set(lift.x, 0.08, lift.z);
    padMesh.receiveShadow = true;
    scene.add(padMesh);
    const liftLabel = gothicLabel('MAIN MENU', '#FF8B82', 0.8);
    liftLabel.position.set(lift.x, 3.0, lift.z);
    scene.add(liftLabel);
  }

  // Side booth clutter — instanced so draw calls stay bounded.
  const detailGeo = roundedBoxGeometry(0.55, 0.7, 0.55, 0.06, 2);
  const detailMat = pbrMaterial('wornSteel', ARCADE_PALETTE.steel, {
    roughness: 0.55,
    metalness: 0.62,
    repeat: 1,
  });
  const detailCount = low ? 16 : 42;
  const detail = new THREE.InstancedMesh(detailGeo, detailMat, detailCount);
  const random = mulberry32(0xa7cade);
  const matrix = new THREE.Matrix4();
  let placed = 0;
  for (let attempt = 0; attempt < detailCount * 6 && placed < detailCount; attempt++) {
    const x = (random() - 0.5) * 36;
    const z = (random() - 0.5) * 40;
    if (Math.hypot(x, z) < 3.2) continue;
    if (Math.abs(x) < 2.2 && z > 8) continue;
    const nearCab = model.interactables.some(item => Math.hypot(item.x - x, item.z - z) < 2.4);
    if (nearCab) continue;
    matrix.compose(
      new THREE.Vector3(x, 0.35, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, 0)),
      new THREE.Vector3(0.7 + random() * 0.6, 0.7 + random() * 0.7, 0.7 + random() * 0.6),
    );
    detail.setMatrixAt(placed, matrix);
    placed += 1;
  }
  detail.count = placed;
  detail.instanceMatrix.needsUpdate = true;
  detail.userData.cast = true;
  scene.add(detail);

  const atmosphere = dustField(model.bounds, ARCADE_PALETTE.magenta, low ? 40 : 72);
  scene.add(atmosphere);

  markSelectiveShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    if (api.spin) {
      api.spin.rotation.y = time * 0.8;
      api.spin.rotation.x = 0.42 + Math.sin(time * 0.6) * 0.08;
    }
    marquee.under.intensity = 1.0 + Math.sin(time * 1.8) * 0.22;
    shaft.material.opacity = 0.026 + Math.sin(time * 0.9) * 0.008;
    atmosphere.rotation.y = time * 0.005;
    Object.values(api.cabinets).forEach((cabinet, index) => {
      if (!cabinet?.light) return;
      cabinet.light.intensity = cabinet.light.userData.baseIntensity
        * (0.88 + 0.12 * Math.sin(time * 2.4 + index));
    });
  });

  const art = {
    world: 'arcade',
    name: 'Arcade',
    palette: ARCADE_PALETTE,
    landmark: marquee.landmark,
    detail,
    atmosphere,
    shaft,
    frame,
    pathLighting,
    lighting,
    materialCoverage: materialCoverage(scene),
    quality: low ? 'low' : 'high',
    grade: {
      saturation: 1.05,
      contrast: 1.12,
      tint: 0xf2d8ff,
      lift: -0.02,
      gamma: 1.02,
      gain: 1.02,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  ARCADE_PALETTE,
  MARQUEE,
  PATH,
  buildArcadeWorldScene,
};

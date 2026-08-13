import * as THREE from 'three';
import { mulberry32 } from '../game/content.js';
import { CAMPUS_SIZE, CAMPUS_DISTRICTS } from '../world/campus.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { WALL_H, makeTextCanvas, mineLabelSprite } from './primitives.js';
import { fxCone, glowSprite, dustField } from './cinematic.js';

const CAMPUS_PALETTE = {
  void: 0x05070b,
  fog: 0x08141d,
  silicon: 0x4a5a68,
  steel: 0x3a4654,
  concrete: 0x2c343e,
  brass: 0xb08a4a,
  cyan: 0x69e7ff,
  violet: 0x9a7dff,
  amber: 0xffc76b,
  spill: 0xcfe6ff,
};

const ARRIVAL_PATH = [
  { x: 0, z: 90 },
  { x: 0, z: 72 },
  { x: 0, z: 54 },
  { x: 0, z: 36 },
  { x: 0, z: 18 },
  { x: 0, z: 0 },
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

function buildCampusLighting(scene, low) {
  const ambient = new THREE.AmbientLight(0x1a2433, 0.18);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3a566e, 0x0a0e14, 0.28);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(CAMPUS_PALETTE.spill, low ? 0.42 : 0.68);
  key.position.set(28, 64, 48);
  key.target.position.set(0, 0, 24);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const cam = key.shadow.camera;
  cam.left = -48;
  cam.right = 48;
  cam.top = 70;
  cam.bottom = -28;
  cam.near = 8;
  cam.far = 160;
  cam.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(CAMPUS_PALETTE.violet, low ? 0.18 : 0.32);
  rim.position.set(-40, 36, -20);
  rim.target.position.set(0, 2, 0);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  return { ambient, fill, key, rim };
}

function buildArrivalArch(scene, concrete, steel, brass) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  [-1, 1].forEach(side => {
    const pier = addMesh(frame, roundedBoxGeometry(1.7, 7.2, 1.9, 0.18, 3), concrete, side * 6.2, 3.6, 86.4);
    pier.userData.cast = true;
    const rib = addMesh(frame, roundedBoxGeometry(0.22, 6.1, 0.22, 0.04, 2), brass, side * 5.4, 3.2, 85.6);
    rib.userData.cast = true;
  });
  const lintel = addMesh(frame, roundedBoxGeometry(14.2, 1.05, 2.0, 0.16, 3), steel, 0, 7.15, 86.4);
  lintel.userData.cast = true;
  addMesh(
    frame,
    roundedBoxGeometry(7.2, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', CAMPUS_PALETTE.cyan, 1.25, 1),
    0,
    6.62,
    85.45,
  );
  const title = gothicLabel('TAPEOUT FAB', '#7DEFFF', 0.92);
  title.position.set(0, 8.35, 85.8);
  frame.add(title);
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, low) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', CAMPUS_PALETTE.cyan, 0.82, 4);
  const stud = emissiveSurface('silicon', CAMPUS_PALETTE.amber, 1.2, 1);
  for (let index = 0; index < ARRIVAL_PATH.length - 1; index++) {
    const a = ARRIVAL_PATH[index];
    const b = ARRIVAL_PATH[index + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ribbon = new THREE.Mesh(roundedBoxGeometry(1.35, 0.045, len, 0.02, 2), strip);
    ribbon.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    group.add(ribbon);
  }
  ARRIVAL_PATH.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.4, 0.08, 0.4, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    if (low && index % 2 === 1) return;
    const pool = new THREE.PointLight(
      index === ARRIVAL_PATH.length - 1 ? CAMPUS_PALETTE.amber : CAMPUS_PALETTE.cyan,
      index === ARRIVAL_PATH.length - 1 ? 0.9 : 0.42,
      index === ARRIVAL_PATH.length - 1 ? 18 : 11,
      1.8,
    );
    pool.position.set(point.x, index === ARRIVAL_PATH.length - 1 ? 4.6 : 2.5, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function buildWaferMonument(scene, brass) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#140a22';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = ((x * 7 + y * 13) % 5) < 2 ? '#f5b14c' : '#8a5cf5';
      g.globalAlpha = 0.28 + ((x + y) % 3) * 0.24;
      g.fillRect(x * 32 + 4, y * 32 + 4, 24, 24);
    }
  }
  g.globalAlpha = 0.5;
  g.strokeStyle = '#7defff';
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
  }
  g.globalAlpha = 1;
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const waferMat = pbrMaterial('silicon', 0x6a7a88, {
    map,
    roughness: 0.28,
    metalness: 0.82,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.42,
    clearcoat: 0.62,
    clearcoatRoughness: 0.18,
    repeat: 1,
  });
  const wafer = addMesh(landmark, new THREE.CylinderGeometry(7, 7, 0.55, 48), waferMat, 0, 13, 0);
  wafer.rotation.z = 0.15;
  wafer.userData.cast = true;
  const haloA = addMesh(landmark, new THREE.TorusGeometry(8.8, 0.2, 10, 64), brass, 0, 13, 0);
  haloA.rotation.x = Math.PI / 2;
  const haloB = new THREE.Mesh(
    new THREE.TorusGeometry(10.2, 0.1, 8, 64),
    new THREE.MeshBasicMaterial({ color: CAMPUS_PALETTE.cyan, transparent: true, opacity: 0.7 }),
  );
  haloB.position.y = 13;
  landmark.add(haloB);
  const under = new THREE.PointLight(0x8a5cf5, 1.35, 48, 2);
  under.position.set(0, 9.5, 0);
  under.castShadow = false;
  under.userData.lightRole = 'monument';
  under.userData.baseIntensity = under.intensity;
  landmark.add(under);
  [[5.4, 5.4], [-5.4, 5.4], [5.4, -5.4], [-5.4, -5.4]].forEach(([bx, bz]) => {
    landmark.add(fxCone(0x8a5cf5, 1.5, 12.4, 0.05, bx, bz));
  });
  landmark.add(fxCone(0xf5b14c, 3.2, 12.6, 0.045, 0, 0));
  const marquee = gothicLabel('T A P E O U T   F A B', '#FFD98A', 2.4);
  marquee.position.set(0, 18.4, 0);
  landmark.add(marquee);
  scene.add(landmark);
  return { landmark, wafer, haloA, haloB, under };
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: CAMPUS_PALETTE.spill,
    transparent: true,
    opacity: 0.018,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(11, 28, 24, 1, true), material);
  shaft.position.set(0, 16, 0);
  shaft.rotation.z = 0.08;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildCampusFloor(scene, steel) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CAMPUS_SIZE, CAMPUS_SIZE),
    pbrMaterial('silicon', CAMPUS_PALETTE.silicon, {
      roughness: 0.34,
      metalness: 0.58,
      repeat: 12,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(40, 40, 0.08, 48),
    pbrMaterial('silicon', 0x3e4e5c, {
      roughness: 0.22,
      metalness: 0.7,
      emissive: 0x123a44,
      emissiveIntensity: 0.22,
      repeat: 4,
    }),
  );
  plaza.position.y = 0.04;
  plaza.receiveShadow = true;
  scene.add(plaza);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(40, 0.18, 8, 64),
    emissiveSurface('silicon', CAMPUS_PALETTE.cyan, 0.7, 2),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  scene.add(ring);
  const rim = new THREE.Mesh(
    roundedBoxGeometry(CAMPUS_SIZE + 6, 1.2, CAMPUS_SIZE + 6, 0.2, 2),
    steel,
  );
  rim.position.y = -0.7;
  rim.userData.cast = true;
  scene.add(rim);
  return { ground, plaza };
}

function buildWallsAndGates(scene, model, api, concrete, steel) {
  const wallMat = pbrMaterial('concrete', CAMPUS_PALETTE.concrete, {
    roughness: 0.78,
    metalness: 0.12,
    emissive: 0x0c2a33,
    emissiveIntensity: 0.18,
    repeat: 3,
  });
  model.colliders.forEach(box => {
    if (!/^wall/.test(box.tag)) return;
    const sx = box.maxX - box.minX;
    const sz = box.maxZ - box.minZ;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_H, sz), wallMat);
    mesh.position.set((box.minX + box.maxX) / 2, WALL_H / 2, (box.minZ + box.maxZ) / 2);
    mesh.userData.cast = true;
    scene.add(mesh);
  });

  model.gates.forEach(gt => {
    const district = model.districts.find(entry => entry.w === gt.w);
    const span = 14;
    const p1 = gt.horiz ? [gt.x - span / 2, gt.z] : [gt.x, gt.z - span / 2];
    const p2 = gt.horiz ? [gt.x + span / 2, gt.z] : [gt.x, gt.z + span / 2];
    [p1, p2].forEach(point => {
      const post = new THREE.Mesh(roundedBoxGeometry(1.4, WALL_H + 2, 1.4, 0.12, 3), steel);
      post.position.set(point[0], (WALL_H + 2) / 2, point[1]);
      post.userData.cast = true;
      scene.add(post);
    });
    const lintel = new THREE.Mesh(
      roundedBoxGeometry(gt.horiz ? span + 1.4 : 1.4, 1.2, gt.horiz ? 1.4 : span + 1.4, 0.12, 3),
      steel,
    );
    lintel.position.set(gt.x, WALL_H + 1.6, gt.z);
    lintel.userData.cast = true;
    scene.add(lintel);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x301014,
      emissive: 0xb1303a,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.92,
    });
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(gt.horiz ? span - 1 : 0.8, WALL_H, gt.horiz ? 0.8 : span - 1),
      panelMat,
    );
    panel.position.set(gt.x, WALL_H / 2, gt.z);
    scene.add(panel);
    const signTex = makeTextCanvas([
      { text: 'SEAL ' + String(gt.w).padStart(2, '0'), size: 64, bold: true, color: '#FF8B82' },
      { text: district.name.toUpperCase(), size: 40, color: '#B9C6D6' },
    ], { border: '#B14A52' });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 4),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true }),
    );
    sign.position.set(gt.x, WALL_H + 4.6, gt.z);
    if (!gt.horiz) sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    const gate = { panel, panelMat, sign, open: false, anim: 0, collider: gt.collider, w: gt.w };
    api.gates[gt.w] = gate;
    api.anims.push((time, dt) => {
      if (gate.open && panel.position.y > -WALL_H / 2 - 0.6) {
        panel.position.y = Math.max(-WALL_H / 2 - 0.6, panel.position.y - dt * 3.2);
        panelMat.opacity = Math.max(0, panelMat.opacity - dt * 0.5);
      }
      if (!gate.open) panelMat.emissiveIntensity = 0.9 + 0.35 * Math.sin(time * 2.2 + gt.w);
    });
  });
}

function buildKiosk(scene, x, z, title, sub, color, api, key, steel) {
  const ped = new THREE.Mesh(roundedBoxGeometry(1.8, 1.4, 1.2, 0.1, 3), steel);
  ped.position.set(x, 0.7, z);
  ped.userData.cast = true;
  scene.add(ped);
  const neck = new THREE.Mesh(roundedBoxGeometry(0.4, 1.0, 0.4, 0.06, 2), steel);
  neck.position.set(x, 1.8, z);
  neck.userData.cast = true;
  scene.add(neck);
  const tex = makeTextCanvas([
    { text: title, size: 46, bold: true, color },
    { text: sub, size: 26, color: '#76849A' },
  ], { border: color });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.8),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  screen.position.set(x, 2.9, z);
  scene.add(screen);
  api.kioskScreens[key] = { screen, baseY: 2.9 };
  api.anims.push((time) => {
    screen.position.y = 2.9 + Math.sin(time * 1.1 + x) * 0.07;
  });
}

function buildLandmark(scene, district, L, api, steel) {
  const acc = district.color;
  const accent = pbrMaterial('wornSteel', 0x2a3344, {
    roughness: 0.42,
    metalness: 0.72,
    emissive: acc,
    emissiveIntensity: 0.22,
    repeat: 2,
  });
  if (district.w === 1) {
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(roundedBoxGeometry(0.7, 10, 0.7, 0.08, 2), steel);
      leg.position.set(L.x + ox * 0.7, 5, L.z + oz * 0.7);
      leg.userData.cast = true;
      scene.add(leg);
    });
    const cap = new THREE.Mesh(roundedBoxGeometry(6.4, 0.8, 6.4, 0.1, 2), steel);
    cap.position.set(L.x, 10.2, L.z);
    cap.userData.cast = true;
    scene.add(cap);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 20), accent);
    wheel.position.set(L.x, 12.4, L.z);
    scene.add(wheel);
    api.anims.push((time) => { wheel.rotation.y = time * 0.7; });
  } else if (district.w === 2) {
    ['AND', 'OR', 'XOR', 'NAND', 'NOR'].forEach((name, index) => {
      const gx = L.x - 12 + index * 6;
      [-1.6, 1.6].forEach(ox => {
        const post = new THREE.Mesh(roundedBoxGeometry(0.8, 6, 0.8, 0.08, 2), accent);
        post.position.set(gx + ox, 3, L.z);
        post.userData.cast = true;
        scene.add(post);
      });
      const bar = new THREE.Mesh(roundedBoxGeometry(4.6, 0.7, 1.0, 0.08, 2), accent);
      bar.position.set(gx, 6.3, L.z);
      bar.userData.cast = true;
      scene.add(bar);
      const tex = makeTextCanvas([{ text: name, size: 90, bold: true, color: '#7DEFFF' }], { h: 160, border: '#155E6B' });
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 1.1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      label.position.set(gx, 5.2, L.z + 0.6);
      scene.add(label);
    });
  } else if (district.w === 3) {
    const hall = new THREE.Mesh(roundedBoxGeometry(16, 8, 11, 0.16, 2), steel);
    hall.position.set(L.x, 4, L.z);
    hall.userData.cast = true;
    scene.add(hall);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.85 }),
    );
    win.position.set(L.x, 4, L.z + 5.56);
    scene.add(win);
    api.windows[3] = win;
    [-4, 4].forEach(ox => {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 7, 10), steel);
      chimney.position.set(L.x + ox, 11, L.z - 2);
      chimney.userData.cast = true;
      scene.add(chimney);
    });
  } else if (district.w === 4) {
    const ridge = pbrMaterial('concrete', 0x1f2a23, {
      roughness: 0.88,
      emissive: 0xa3e635,
      emissiveIntensity: 0.08,
      repeat: 2,
    });
    for (let index = 0; index < 5; index++) {
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5 + (index % 3) * 2, 3.5), ridge);
      r1.position.set(L.x - 8 + index * 4, 2.6 + (index % 2), L.z - 7);
      r1.rotation.y = index * 0.5;
      r1.userData.cast = true;
      scene.add(r1);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4 + ((index + 1) % 3) * 2, 3.2), ridge);
      r2.position.set(L.x - 8 + index * 4, 2.2 + ((index + 1) % 2), L.z + 7);
      r2.rotation.y = -index * 0.4;
      r2.userData.cast = true;
      scene.add(r2);
    }
  } else if (district.w === 5) {
    const tower = new THREE.Mesh(roundedBoxGeometry(5, 22, 5, 0.14, 2), steel);
    tower.position.set(L.x, 11, L.z);
    tower.userData.cast = true;
    scene.add(tower);
    const cap = new THREE.Mesh(roundedBoxGeometry(6.4, 1.6, 6.4, 0.12, 2), accent);
    cap.position.set(L.x, 22.8, L.z);
    cap.userData.cast = true;
    scene.add(cap);
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), new THREE.MeshBasicMaterial({ color: 0x0e141c }));
    face.position.set(L.x, 18, L.z + 2.56);
    scene.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.16, 8, 26), new THREE.MeshBasicMaterial({ color: acc }));
    rim.position.copy(face.position);
    scene.add(rim);
    const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.06), new THREE.MeshBasicMaterial({ color: 0x7defff }));
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.06), new THREE.MeshBasicMaterial({ color: 0xe8f1fa }));
    hand1.position.set(L.x, 18, L.z + 2.6);
    hand2.position.set(L.x, 18, L.z + 2.62);
    scene.add(hand1);
    scene.add(hand2);
    api.anims.push((time) => {
      hand1.rotation.z = -time * 0.5;
      hand2.rotation.z = -time * 0.05;
      hand1.position.x = L.x + Math.sin(-time * 0.5) * 0.65;
      hand1.position.y = 18 + Math.cos(-time * 0.5) * 0.65;
      hand2.position.x = L.x + Math.sin(-time * 0.05) * 0.45;
      hand2.position.y = 18 + Math.cos(-time * 0.05) * 0.45;
    });
  } else if (district.w === 6) {
    const keep = new THREE.Mesh(roundedBoxGeometry(11, 11, 11, 0.16, 2), steel);
    keep.position.set(L.x, 5.5, L.z);
    keep.userData.cast = true;
    scene.add(keep);
    [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4]].forEach(([ox, oz]) => {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 14, 10), steel);
      tw.position.set(L.x + ox, 7, L.z + oz);
      tw.userData.cast = true;
      scene.add(tw);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 10), accent);
      cap.position.set(L.x + ox, 15.2, L.z + oz);
      scene.add(cap);
    });
  } else if (district.w === 7) {
    const hall = new THREE.Mesh(roundedBoxGeometry(22, 10, 15, 0.16, 2), steel);
    hall.position.set(L.x, 5, L.z);
    hall.userData.cast = true;
    scene.add(hall);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 3.2),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }),
    );
    win.position.set(L.x, 5, L.z + 7.56);
    scene.add(win);
    api.windows[7] = win;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 8), steel);
    mast.position.set(L.x + 7, 14.5, L.z - 3);
    scene.add(mast);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    blink.position.set(L.x + 7, 19.3, L.z - 3);
    scene.add(blink);
    api.anims.push((time) => { blink.visible = Math.sin(time * 4) > -0.2; });
    const tex = makeTextCanvas([{ text: 'TAPEOUT', size: 86, bold: true, color: '#FFE27A' }], { h: 170, border: '#7A6310' });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    sign.position.set(L.x, 11.6, L.z + 7.6);
    scene.add(sign);
  }
}

function buildDistricts(scene, model, api, steel) {
  model.districts.forEach(district => {
    const anchor = model.anchors[district.w];
    const L = anchor.landmarkPos;
    buildLandmark(scene, district, L, api, steel);
    const bMat = new THREE.MeshBasicMaterial({ color: district.color, transparent: true, opacity: 0.16 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 10, 1, true), bMat);
    beam.position.set(L.x, 30, L.z);
    scene.add(beam);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), new THREE.MeshBasicMaterial({ color: district.color }));
    tip.position.set(L.x, 18 + (district.w === 7 ? 6 : 0), L.z);
    scene.add(tip);
    api.beacons[district.w] = { beam, bMat, tip };
    api.anims.push((time) => {
      tip.position.y = 18 + (district.w === 7 ? 6 : 0) + Math.sin(time * 1.4 + district.w) * 0.6;
    });
  });
}

function buildInteractables(scene, model, api, steel) {
  model.interactables.forEach(item => {
    if (item.kind === 'console') {
      const district = model.districts.find(entry => entry.w === item.w);
      buildKiosk(scene, item.x, item.z, district.name.toUpperCase(), 'DISTRICT CONSOLE', '#' + district.color.toString(16).padStart(6, '0'), api, 'c' + item.w, steel);
    } else if (item.kind === 'arcade') {
      buildKiosk(scene, item.x, item.z, item.label, 'PERIPHERAL', '#7DEFFF', api, item.id, steel);
    } else if (item.kind === 'pad') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0x7defff }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(item.x, 0.12, item.z);
      scene.add(ring);
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9, 1.9, 0.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x155e6b, transparent: true, opacity: 0.5 }),
      );
      glow.position.set(item.x, 0.06, item.z);
      scene.add(glow);
      api.anims.push((time) => { ring.rotation.z = time * 0.6; });
    }
  });
}

function buildCampusUltra(scene, model, api, low, steel) {
  (model.gates || []).forEach((gt, index) => {
    const district = CAMPUS_DISTRICTS.find(entry => entry.w === gt.w) || {};
    const col = district.color || CAMPUS_PALETTE.cyan;
    const grp = new THREE.Group();
    grp.position.set(gt.x, 7.4, gt.z);
    grp.add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 40), new THREE.MeshBasicMaterial({ color: col })));
    grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true })));
    grp.add(glowSprite(col, 5.4, 0.5));
    scene.add(grp);
    api.anims.push((time) => {
      grp.position.y = 7.4 + Math.sin(time * 1.1 + index) * 0.35;
      grp.rotation.y = time * 0.9 + index;
    });
  });

  const pipeMat = pbrMaterial('wornSteel', 0x232f42, { roughness: 0.35, metalness: 0.9, repeat: 4 });
  const coolMat = emissiveSurface('silicon', CAMPUS_PALETTE.cyan, 0.85, 2);
  const length = CAMPUS_SIZE - 24;
  [
    { x: 0, z: -30, y: 11.2, alongX: true },
    { x: 0, z: 30, y: 11.2, alongX: true },
    { x: -30, z: 0, y: 12.6, alongX: false },
    { x: 30, z: 0, y: 12.6, alongX: false },
  ].forEach(run => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, length, 12), pipeMat);
    const cool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, length + 0.4, 8), coolMat);
    pipe.position.set(run.x, run.y, run.z);
    cool.position.set(run.x, run.y - 0.62, run.z);
    if (run.alongX) { pipe.rotation.z = Math.PI / 2; cool.rotation.z = Math.PI / 2; }
    else { pipe.rotation.x = Math.PI / 2; cool.rotation.x = Math.PI / 2; }
    pipe.userData.cast = true;
    scene.add(pipe);
    scene.add(cool);
  });

  const R = 40;
  const railMat = pbrMaterial('wornSteel', 0x1b2434, {
    roughness: 0.5,
    metalness: 0.8,
    emissive: 0x0c2a33,
    emissiveIntensity: 0.4,
    repeat: 3,
  });
  [[0, -R, true], [0, R, true], [-R, 0, false], [R, 0, false]].forEach(([rx, rz, alongX]) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? R * 2 : 0.9, 0.32, alongX ? 0.9 : R * 2),
      railMat,
    );
    rail.position.set(rx, 6.6, rz);
    scene.add(rail);
  });
  const waferMat = emissiveSurface('silicon', 0xffd98a, 0.9, 1);
  const wafers = [];
  const count = low ? 4 : 6;
  for (let index = 0; index < count; index++) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20), waferMat);
    scene.add(mesh);
    wafers.push(mesh);
  }
  const squarePos = (p, r) => {
    const s = (p % 1) * 4;
    const k = Math.floor(s);
    const f = s - k;
    if (k === 0) return { x: -r + f * 2 * r, z: -r };
    if (k === 1) return { x: r, z: -r + f * 2 * r };
    if (k === 2) return { x: r - f * 2 * r, z: r };
    return { x: -r, z: r - f * 2 * r };
  };
  api.anims.push((time) => {
    wafers.forEach((mesh, index) => {
      const pos = squarePos(time * 0.028 + index / wafers.length, R);
      mesh.position.set(pos.x, 6.95, pos.z);
      mesh.rotation.y = time * 1.2 + index;
    });
  });

  [[-118, -118], [118, -118], [-118, 118], [118, 118]].forEach(([tx, tz], index) => {
    const col = new THREE.Mesh(roundedBoxGeometry(1.7, 16, 1.7, 0.12, 2), steel);
    col.position.set(tx, 8, tz);
    col.userData.cast = true;
    scene.add(col);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5f52 }));
    beacon.position.set(tx, 17, tz);
    scene.add(beacon);
    scene.add(fxCone(0x9fd8ff, 2.8, 15.4, 0.04, tx, tz));
    const pivot = new THREE.Group();
    pivot.position.set(tx, 16.4, tz);
    scene.add(pivot);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 30, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xcfe6ff,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    beam.position.y = -14;
    beam.rotation.x = Math.PI;
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.62;
    tilt.add(beam);
    pivot.add(tilt);
    api.anims.push((time) => {
      pivot.rotation.y = time * (0.24 + index * 0.05) + index * 1.7;
      beacon.material.color.setHex(Math.sin(time * 3.4 + index) > 0 ? 0xff5f52 : 0x53160f);
    });
  });

  (model.gates || []).forEach(gt => {
    const district = CAMPUS_DISTRICTS.find(entry => entry.w === gt.w) || {};
    const dist = Math.hypot(gt.x, gt.z);
    if (dist < 20) return;
    const len = dist - 18;
    const tr = new THREE.Mesh(
      roundedBoxGeometry(0.55, 0.05, len, 0.02, 2),
      emissiveSurface('silicon', district.color || CAMPUS_PALETTE.cyan, 0.7, 2),
    );
    const ux = gt.x / dist;
    const uz = gt.z / dist;
    const mid = 12 + len / 2;
    tr.position.set(ux * mid, 0.06, uz * mid);
    tr.rotation.y = Math.atan2(ux, uz);
    scene.add(tr);
  });

  [[18, 18], [-18, 18], [18, -16], [-18, -16]].forEach(([x, z]) => {
    const lamp = new THREE.PointLight(CAMPUS_PALETTE.amber, 0.55, 16, 1.8);
    lamp.position.set(x, 3.4, z);
    lamp.castShadow = false;
    lamp.userData.lightRole = 'lantern';
    lamp.userData.baseIntensity = lamp.intensity;
    scene.add(lamp);
    const housing = new THREE.Mesh(roundedBoxGeometry(0.28, 0.5, 0.28, 0.05, 2), steel);
    housing.position.set(x, 3.4, z);
    housing.userData.cast = true;
    scene.add(housing);
  });
}

function buildCampusWorldScene(scene, model) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const api = { anims: [], gates: {}, beacons: {}, windows: {}, kioskScreens: {}, dispose: [] };
  const concrete = pbrMaterial('concrete', CAMPUS_PALETTE.concrete, { roughness: 0.8, repeat: 3 });
  const steel = pbrMaterial('wornSteel', CAMPUS_PALETTE.steel, { roughness: 0.4, metalness: 0.78, repeat: 3 });
  const brass = pbrMaterial('brass', CAMPUS_PALETTE.brass, { roughness: 0.38, metalness: 0.82, repeat: 2 });

  scene.background = new THREE.Color(CAMPUS_PALETTE.void);
  scene.fog = new THREE.FogExp2(CAMPUS_PALETTE.fog, 0.0072);
  scene.userData.baseFogDensity = 0.0072;

  const lighting = buildCampusLighting(scene, low);
  {
    const count = low ? 80 : 180;
    const pos = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.85);
      const r = 380;
      pos[index * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[index * 3 + 1] = r * Math.cos(ph) + 10;
      pos[index * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
      color: 0xaad4ff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
    })));
  }

  buildCampusFloor(scene, steel);
  const frame = buildArrivalArch(scene, concrete, steel, brass);
  const pathLighting = buildPathLighting(scene, low);
  buildWallsAndGates(scene, model, api, concrete, steel);
  buildDistricts(scene, model, api, steel);
  buildInteractables(scene, model, api, steel);
  const monument = buildWaferMonument(scene, brass);
  const shaft = buildLightShaft(scene);
  buildCampusUltra(scene, model, api, low, steel);

  const detailGeo = new THREE.BoxGeometry(0.7, 0.9, 0.7);
  const detailMat = pbrMaterial('wornSteel', CAMPUS_PALETTE.steel, { roughness: 0.55, metalness: 0.62, repeat: 1 });
  const detailCount = low ? 18 : 54;
  const detail = new THREE.InstancedMesh(detailGeo, detailMat, detailCount);
  const random = mulberry32(0x51c0);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < detailCount; index++) {
    const ang = random() * Math.PI * 2;
    const rad = 44 + random() * 36;
    matrix.compose(
      new THREE.Vector3(Math.cos(ang) * rad, 0.45, Math.sin(ang) * rad),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, 0)),
      new THREE.Vector3(0.8 + random(), 0.8 + random(), 0.8 + random()),
    );
    detail.setMatrixAt(index, matrix);
  }
  detail.instanceMatrix.needsUpdate = true;
  detail.userData.cast = true;
  scene.add(detail);

  const atmosphere = dustField(model.bounds, CAMPUS_PALETTE.cyan, low ? 50 : 90);
  scene.add(atmosphere);

  markSelectiveShadows(scene);

  api.anims.push((time) => {
    monument.wafer.rotation.y = time * 0.22;
    const bob = 13 + Math.sin(time * 0.7) * 0.5;
    monument.wafer.position.y = bob;
    monument.haloA.position.y = bob;
    monument.haloB.position.y = bob;
    monument.haloA.rotation.z = time * 0.3;
    monument.under.intensity = 1.2 + Math.sin(time * 1.7) * 0.28;
    shaft.material.opacity = 0.014 + Math.sin(time * 0.7) * 0.005;
    atmosphere.rotation.y = time * 0.004;
  });

  const art = {
    world: 0,
    name: 'Fab Campus',
    palette: CAMPUS_PALETTE,
    landmark: monument.landmark,
    detail,
    atmosphere,
    shaft,
    frame,
    pathLighting,
    lighting,
    ultraApplied: true,
    materialCoverage: materialCoverage(scene),
    quality: low ? 'low' : 'high',
    grade: {
      saturation: 0.96,
      contrast: 1.12,
      tint: 0xd8eef8,
      lift: -0.022,
      gamma: 1.03,
      gain: 1.0,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

function applyCampusUltra(scene, model, api) {
  if (api?.worldArt?.ultraApplied) return api;
  const steel = pbrMaterial('wornSteel', CAMPUS_PALETTE.steel, { roughness: 0.4, metalness: 0.78, repeat: 3 });
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  buildCampusUltra(scene, model, api || { anims: [] }, low, steel);
  if (api?.worldArt) api.worldArt.ultraApplied = true;
  return api;
}

function applyCampusProgress(api, model, progress) {
  model.districts.forEach(district => {
    const p = progress.perWorld[district.w] || { unlocked: false, complete: false, frac: 0 };
    const beacon = api.beacons[district.w];
    if (beacon) {
      const col = !p.unlocked
        ? 0x39434f
        : p.complete
          ? (district.w === 7 || progress.ngplus ? 0xfacc15 : 0x2ea56a)
          : district.color;
      beacon.bMat.color.setHex(col);
      beacon.bMat.opacity = p.unlocked ? 0.16 + p.frac * 0.14 : 0.05;
      beacon.tip.material.color.setHex(col);
    }
    const gate = api.gates[district.w];
    if (gate) {
      const open = !!p.unlocked;
      if (open && !gate.open) { gate.open = true; gate.collider.off = true; gate.sign.visible = false; }
      if (!open) { gate.open = false; gate.collider.off = false; gate.sign.visible = true; }
    }
    const win = api.windows[district.w];
    if (win) win.material.opacity = 0.35 + p.frac * 0.55;
  });
}

export {
  CAMPUS_PALETTE,
  ARRIVAL_PATH,
  buildCampusWorldScene,
  applyCampusUltra,
  applyCampusProgress,
};

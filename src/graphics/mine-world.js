import * as THREE from 'three';
import { mulberry32, GAUNTLETS } from '../game/content.js';
import { enemyFor } from '../game/rpg.js';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';
import { fxCone, glowSprite, dustField } from './cinematic.js';
import { fieldNoteProp, plinthRock, rockNoise, rockWall } from './rock.js';
import { creatureSpec, makeCreature } from './creatures.js';

const MINE_PALETTE = {
  void: 0x060402,
  fog: 0x140e0a,
  wet: 0x6a5846,
  wall: 0x3d332b,
  vault: 0x2c241e,
  timber: 0x5a4030,
  brass: 0xb08a4a,
  steel: 0x4a5560,
  lantern: 0xffb066,
  vein: 0x69e7ff,
  amber: 0xffc76b,
  cavern: 0xffc98a,
  spill: 0xffd9a0,
};

const SHAFT_SPLIT = -62;
const SHAFT_H = 5.5;
const VAULT_H = 17.6;

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

function markOpaqueShadows(scene) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const ghost = materials.some(material => (
      material
      && (material.transparent
        || material.blending === THREE.AdditiveBlending)
    ));
    object.castShadow = !ghost;
    object.receiveShadow = !ghost;
  });
}

function buildMineCeilings(scene, model, material, zSplit, pad) {
  const bounds = model.bounds;
  const width = bounds.maxX - bounds.minX + pad * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const makeCeiling = (z1, z2, y, amp, segs) => {
    const geometry = new THREE.PlaneGeometry(width, z2 - z1, segs, segs);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(cx, y, (z1 + z2) / 2);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index);
      const z = position.getZ(index);
      let dy = rockNoise(x + 7, 3, z + 7) * amp - amp * 0.4;
      dy = Math.max(-amp * 1.6, Math.min(amp * 0.7, dy));
      position.setY(index, position.getY(index) + dy);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.material.side = THREE.DoubleSide;
    scene.add(mesh);
    return mesh;
  };
  return {
    shaft: makeCeiling(zSplit, bounds.maxZ + pad, SHAFT_H, 0.82, 24),
    vault: makeCeiling(bounds.minZ - pad, zSplit, VAULT_H, 2.2, 18),
  };
}

function buildEntranceArch(scene, brass, concrete) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  [-1, 1].forEach(side => {
    const pier = addMesh(
      frame,
      roundedBoxGeometry(1.35, 5.4, 1.6, 0.16, 3),
      concrete,
      side * 5.4,
      2.7,
      60.4,
    );
    pier.castShadow = pier.receiveShadow = true;
    const rib = addMesh(
      frame,
      roundedBoxGeometry(0.22, 4.4, 0.22, 0.04, 2),
      brass,
      side * 4.72,
      2.4,
      59.7,
    );
    rib.castShadow = true;
  });
  const lintel = addMesh(
    frame,
    roundedBoxGeometry(12.2, 0.9, 1.7, 0.14, 3),
    concrete,
    0,
    5.15,
    60.4,
  );
  lintel.castShadow = lintel.receiveShadow = true;
  const signal = addMesh(
    frame,
    roundedBoxGeometry(6.4, 0.08, 0.08, 0.03, 2),
    emissiveSurface('silicon', MINE_PALETTE.amber, 1.35, 1),
    0,
    4.72,
    59.55,
  );
  signal.userData.signal = true;
  scene.add(frame);
  return frame;
}

function buildPathLighting(scene, model, scale) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const strip = emissiveSurface('silicon', MINE_PALETTE.amber, 0.95, 4);
  const stud = emissiveSurface('silicon', MINE_PALETTE.lantern, 1.4, 1);
  const path = model.path || [];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index];
    const b = path[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const ribbon = new THREE.Mesh(
      roundedBoxGeometry(1.15, 0.045, len, 0.02, 2),
      strip,
    );
    ribbon.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
    ribbon.rotation.y = Math.atan2(dx, dz);
    ribbon.receiveShadow = true;
    group.add(ribbon);
  }
  path.forEach((point, index) => {
    if (index === 0) return;
    const marker = new THREE.Mesh(roundedBoxGeometry(0.34, 0.08, 0.34, 0.03, 2), stud);
    marker.position.set(point.x, 0.05, point.z);
    group.add(marker);
    const pool = new THREE.PointLight(
      MINE_PALETTE.lantern,
      index === path.length - 1 ? 0.85 : 0.48,
      (index === path.length - 1 ? 16 : 10) * scale,
      1.8,
    );
    pool.position.set(point.x, index === path.length - 1 ? 4.2 : 2.4, point.z);
    pool.castShadow = false;
    pool.userData.lightRole = 'path';
    pool.userData.baseIntensity = pool.intensity;
    group.add(pool);
  });
  scene.add(group);
  return group;
}

function addLantern(scene, x, y, z, brass, cage, options = {}) {
  const scale = options.scale || 1;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const housing = new THREE.Mesh(roundedBoxGeometry(0.3, 0.46, 0.3, 0.05, 2), brass);
  housing.castShadow = true;
  group.add(housing);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    cage,
  );
  group.add(bulb);
  const light = new THREE.PointLight(
    MINE_PALETTE.lantern,
    options.intensity ?? 1.12,
    (options.distance ?? 15) * scale,
    1.7,
  );
  light.castShadow = false;
  light.userData.lightRole = 'lantern';
  light.userData.baseIntensity = light.intensity;
  group.add(light);
  const glow = glowSprite(MINE_PALETTE.lantern, options.glow ?? 2.2, 0.48);
  glow.castShadow = false;
  group.add(glow);
  if (options.spot) {
    const spot = new THREE.SpotLight(
      MINE_PALETTE.spill,
      options.spotIntensity ?? 1.55,
      (options.spotDistance ?? 20) * scale,
      options.angle ?? 0.62,
      0.46,
      1.35,
    );
    spot.castShadow = !!options.shadow;
    if (spot.castShadow) {
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.002;
      spot.shadow.normalBias = 0.35;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = (options.spotDistance ?? 20) + 4;
    }
    spot.position.set(0, 0.05, 0);
    spot.target.position.set(0, -6, options.targetZ || 0);
    spot.userData.lightRole = 'lantern-spot';
    spot.userData.baseIntensity = spot.intensity;
    group.add(spot);
    group.add(spot.target);
  }
  scene.add(group);
  return group;
}

function buildTimberSets(scene, model, timber, brass) {
  const postGeo = roundedBoxGeometry(0.34, 4.85, 0.34, 0.05, 2);
  const barGeo = roundedBoxGeometry(8.2, 0.3, 0.36, 0.05, 2);
  const bandGeo = roundedBoxGeometry(0.4, 0.12, 0.4, 0.03, 2);
  model.beams.forEach(beam => {
    [-3.55, 3.55].forEach(x => {
      const post = new THREE.Mesh(postGeo, timber);
      post.position.set(beam.x + x, 2.42, beam.z);
      post.castShadow = post.receiveShadow = true;
      scene.add(post);
      const band = new THREE.Mesh(bandGeo, brass);
      band.position.set(beam.x + x, 4.55, beam.z);
      scene.add(band);
    });
    const bar = new THREE.Mesh(barGeo, timber);
    bar.position.set(beam.x, 4.78, beam.z);
    bar.castShadow = true;
    scene.add(bar);
  });
}

function buildVeins(scene, model) {
  const geometry = new THREE.OctahedronGeometry(0.42, 0);
  const material = emissiveSurface('silicon', MINE_PALETTE.vein, 1.55, 1);
  const count = 28;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(1337);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index++) {
    const wall = model.colliders[Math.floor(random() * model.colliders.length)];
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const scale = 0.55 + random() * 1.15;
    matrix.compose(
      new THREE.Vector3(
        wall.minX + random() * sx,
        0.55 + random() * 2.4,
        wall.minZ + random() * sz,
      ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(random(), random() * Math.PI, random() * 0.4)),
      new THREE.Vector3(scale, scale * (1.4 + random()), scale * 0.45),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.veins = true;
  scene.add(mesh);
  return mesh;
}

function buildDebris(scene, model, material, low) {
  const count = low ? 22 : 70;
  const geometry = new THREE.IcosahedronGeometry(0.42, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x51c1);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index++) {
    const alongShaft = random() < 0.72;
    const x = alongShaft
      ? (random() - 0.5) * 7.2
      : model.bounds.minX + random() * (model.bounds.maxX - model.bounds.minX);
    const z = alongShaft
      ? 68 - random() * 130
      : model.bounds.minZ + random() * (model.bounds.maxZ - model.bounds.minZ);
    const scale = 0.35 + random() * 1.1;
    matrix.compose(
      new THREE.Vector3(x, 0.22 * scale, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * 0.8, random() * Math.PI, random() * 0.5)),
      new THREE.Vector3(scale, scale * 0.7, scale),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = !low;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function buildShaftChandelier(scene, brass, crystal) {
  const group = new THREE.Group();
  group.position.set(0, 0, -18);
  group.userData.shaftLandmark = true;
  const ring = addMesh(group, new THREE.TorusGeometry(1.35, 0.07, 10, 28), brass, 0, 4.55, 0);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  [-1, 1].forEach(side => {
    const crystalMesh = addMesh(
      group,
      new THREE.OctahedronGeometry(0.28, 0),
      crystal,
      side * 0.85,
      4.15,
      0,
    );
    crystalMesh.scale.y = 1.8;
  });
  const core = addMesh(group, new THREE.OctahedronGeometry(0.34, 0), crystal, 0, 3.85, 0);
  core.scale.y = 2.1;
  const light = new THREE.PointLight(MINE_PALETTE.vein, 1.05, 16, 1.8);
  light.position.set(0, 4.1, 0);
  light.castShadow = false;
  light.userData.lightRole = 'chandelier';
  light.userData.baseIntensity = light.intensity;
  group.add(light);
  scene.add(group);
  return group;
}

function buildCavernMonument(scene, brass, crystal, steel) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  landmark.position.set(0, 0, -84);
  const ring = addMesh(landmark, new THREE.TorusGeometry(3.4, 0.12, 12, 48), brass, 0, 11.4, 0);
  ring.rotation.x = Math.PI / 2;
  const wafer = addMesh(
    landmark,
    new THREE.CylinderGeometry(2.2, 2.2, 0.22, 48),
    crystal,
    0,
    11.4,
    0,
  );
  wafer.rotation.z = Math.PI / 2;
  [-1.8, 0, 1.8].forEach((x, index) => {
    const spike = addMesh(
      landmark,
      new THREE.OctahedronGeometry(0.7 + Math.abs(index - 1) * 0.12, 0),
      index === 1 ? crystal : steel,
      x,
      8.4 + Math.abs(x) * 0.4,
      0,
    );
    spike.scale.y = 3.4;
    spike.castShadow = true;
  });
  const light = new THREE.PointLight(MINE_PALETTE.spill, 1.15, 28, 1.6);
  light.position.set(0, 12.2, 0);
  light.castShadow = false;
  light.userData.lightRole = 'monument';
  light.userData.baseIntensity = light.intensity;
  landmark.add(light);
  scene.add(landmark);
  return landmark;
}

function buildLightShaft(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: MINE_PALETTE.spill,
    transparent: true,
    opacity: 0.028,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(6.4, 22, 24, 1, true), material);
  shaft.position.set(0, 12.4, -84);
  shaft.rotation.z = 0.08;
  shaft.castShadow = false;
  shaft.renderOrder = 3;
  shaft.userData.lightShaft = true;
  scene.add(shaft);
  return shaft;
}

function buildMineLighting(scene, model, scale, low) {
  const ambient = new THREE.AmbientLight(0x2a1c12, 0.2);
  ambient.userData.lightRole = 'ambient';
  ambient.userData.baseIntensity = ambient.intensity;
  scene.add(ambient);

  const fill = new THREE.HemisphereLight(0x3d4c5c, 0x1a1008, 0.3);
  fill.userData.lightRole = 'fill';
  fill.userData.baseIntensity = fill.intensity;
  scene.add(fill);

  const key = new THREE.DirectionalLight(MINE_PALETTE.spill, low ? 0.55 : 0.92);
  key.position.set(6, 24, -70);
  key.target.position.set(0, 1, -84);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.55;
  const camera = key.shadow.camera;
  camera.left = -28;
  camera.right = 28;
  camera.top = 24;
  camera.bottom = -24;
  camera.near = 2;
  camera.far = 70;
  camera.updateProjectionMatrix();
  key.userData.lightRole = 'key';
  key.userData.baseIntensity = key.intensity;
  scene.add(key);
  scene.add(key.target);

  const cool = new THREE.DirectionalLight(0x6aa0c8, 0.22);
  cool.position.set(4, 10, 78);
  cool.target.position.set(0, 1, 20);
  cool.castShadow = false;
  cool.userData.lightRole = 'cool-fill';
  cool.userData.baseIntensity = cool.intensity;
  scene.add(cool);
  scene.add(cool.target);

  const rim = new THREE.SpotLight(MINE_PALETTE.vein, 1.35, 54 * scale, 0.55, 0.4, 1.4);
  rim.position.set(0, 9.5, -104);
  rim.target.position.set(0, 2.2, -48);
  rim.castShadow = false;
  rim.userData.lightRole = 'rim';
  rim.userData.baseIntensity = rim.intensity;
  scene.add(rim);
  scene.add(rim.target);

  const spill = new THREE.PointLight(MINE_PALETTE.spill, 1.2, 20 * scale, 1.7);
  spill.position.set(0, 3.1, -56);
  spill.castShadow = false;
  spill.userData.lightRole = 'gate-spill';
  spill.userData.baseIntensity = spill.intensity;
  scene.add(spill);

  return { ambient, fill, key, cool, rim, spill };
}

function buildMineWorldScene(scene, model, helpers) {
  const { makeNextBeacon, buildFogGate, buildExplorationProps } = helpers;
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const scale = model.worldScale || 1;
  const pad = 8;
  const bounds = model.bounds;
  const zSplit = SHAFT_SPLIT;

  scene.background = new THREE.Color(MINE_PALETTE.void);
  scene.fog = new THREE.FogExp2(MINE_PALETTE.fog, 0.0165 / scale);
  scene.userData.baseFogDensity = scene.fog.density;

  const floorMat = pbrMaterial('wetRock', MINE_PALETTE.wet, {
    roughness: 0.24,
    metalness: 0.08,
    repeat: 12,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
  });
  const wallSmall = pbrMaterial('wetRock', MINE_PALETTE.wall, {
    roughness: 0.74,
    repeat: 2,
    clearcoat: 0.16,
    clearcoatRoughness: 0.72,
  });
  const wallMed = pbrMaterial('wetRock', MINE_PALETTE.wall, {
    roughness: 0.74,
    repeat: 4,
    clearcoat: 0.16,
    clearcoatRoughness: 0.72,
  });
  const wallLong = pbrMaterial('wetRock', MINE_PALETTE.wall, {
    roughness: 0.76,
    repeat: 8,
    clearcoat: 0.14,
    clearcoatRoughness: 0.76,
  });
  const ceilMat = pbrMaterial('wetRock', MINE_PALETTE.vault, {
    roughness: 0.82,
    repeat: 8,
    clearcoat: 0.1,
    clearcoatRoughness: 0.8,
  });
  const timber = pbrMaterial('paintedMetal', MINE_PALETTE.timber, {
    roughness: 0.9,
    metalness: 0.08,
    repeat: 2,
  });
  const brass = pbrMaterial('brass', MINE_PALETTE.brass, {
    roughness: 0.42,
    metalness: 0.82,
    repeat: 2,
  });
  const steel = pbrMaterial('wornSteel', MINE_PALETTE.steel, {
    roughness: 0.38,
    metalness: 0.78,
    repeat: 2,
  });
  const lanternGlow = emissiveSurface('silicon', MINE_PALETTE.lantern, 2.4, 1);
  const crystal = emissiveSurface('silicon', MINE_PALETTE.vein, 1.7, 1);
  const debrisMat = pbrMaterial('wetRock', 0x4e4236, { roughness: 0.86, repeat: 2 });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(
      bounds.maxX - bounds.minX + pad * 2,
      bounds.maxZ - bounds.minZ + pad * 2,
      8,
      8,
    ),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  buildMineCeilings(scene, model, ceilMat, zSplit, pad);

  model.colliders.forEach(wall => {
    const sx = wall.maxX - wall.minX;
    const sz = wall.maxZ - wall.minZ;
    const length = Math.max(sx, sz);
    const material = length > 40 ? wallLong : (length > 14 ? wallMed : wallSmall);
    const cx = (wall.minX + wall.maxX) / 2;
    const cz = (wall.minZ + wall.maxZ) / 2;
    const height = cz < zSplit + 1 ? VAULT_H : SHAFT_H;
    const mesh = rockWall(sx, height, sz, material, cx, cz);
    mesh.position.set(cx, height / 2, cz);
    scene.add(mesh);
  });

  const lintel = rockWall(10, 12.2, 1.6, wallSmall, 0, zSplit);
  lintel.position.set(0, 10.4, zSplit);
  scene.add(lintel);
  const lintelBar = new THREE.Mesh(
    roundedBoxGeometry(8.6, 0.14, 0.14, 0.04, 2),
    emissiveSurface('silicon', MINE_PALETTE.amber, 1.2, 1),
  );
  lintelBar.position.set(0, 5.15, zSplit + 0.7);
  scene.add(lintelBar);

  const frame = buildEntranceArch(scene, brass, wallSmall);
  const pathLighting = buildPathLighting(scene, model, scale);
  buildTimberSets(scene, model, timber, brass);

  const lanterns = [];
  model.lanterns.forEach((lantern, index) => {
    lanterns.push(addLantern(
      scene,
      lantern.x,
      3.55,
      lantern.z,
      brass,
      lanternGlow,
      {
        scale,
        spot: index === 0 || index === 3,
        shadow: false,
        intensity: 1.05,
        distance: 16,
      },
    ));
  });
  [50, 32, 14, -4, -26, -44].forEach((z, index) => {
    lanterns.push(addLantern(
      scene,
      index % 2 ? 0.15 : -0.15,
      4.85,
      z,
      brass,
      lanternGlow,
      {
        scale,
        intensity: 0.82,
        distance: 12,
        glow: 1.7,
      },
    ));
  });

  buildVeins(scene, model);
  const lighting = buildMineLighting(scene, model, scale, low);
  const chandelier = buildShaftChandelier(scene, brass, crystal);
  const landmark = buildCavernMonument(scene, brass, crystal, steel);
  const shaft = buildLightShaft(scene);
  const detail = buildDebris(scene, model, debrisMat, low);
  const atmosphere = dustField(bounds, MINE_PALETTE.amber, low ? 70 : 160);
  scene.add(atmosphere);
  const vaultDust = dustField(
    { minX: -22, maxX: 22, minZ: -108, maxZ: -62 },
    MINE_PALETTE.spill,
    low ? 28 : 70,
  );
  vaultDust.position.y = 4;
  scene.add(vaultDust);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };

  model.interactables.filter(item => item.kind === 'fight').forEach(item => {
    const enemy = enemyFor(item.id, 1, 30, item.boss, 'engineer', false);
    const scaleBoss = item.boss ? 1.7 : 1;
    plinthRock(scene, item.x, item.z, scaleBoss);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6b62 });
    const creature = makeCreature(creatureSpec(1, enemy.name, item.boss), beaconMat);
    creature.position.set(item.x, 0.5, item.z);
    scene.add(creature);
    const fightLight = new THREE.PointLight(
      item.boss ? 0xfacc15 : 0xff6b62,
      item.boss ? 1.05 : 0.7,
      14 * scale,
      2,
    );
    fightLight.position.set(item.x, 3.1 * scaleBoss, item.z);
    fightLight.castShadow = false;
    fightLight.userData.lightRole = 'fight';
    fightLight.userData.baseIntensity = fightLight.intensity;
    scene.add(fightLight);
    scene.add(fxCone(
      item.boss ? 0xfacc15 : 0xff6b62,
      item.boss ? 3.2 : 2,
      5.1,
      item.boss ? 0.1 : 0.06,
      item.x,
      item.z,
    ));
    const label = gothicLabel(
      (item.boss ? '★ FINAL · ' : item.ord ? '#' + item.ord + ' · ' : '') + enemy.name,
      item.boss ? '#FFE27A' : '#FF8B82',
      item.boss ? 0.44 : 0.34,
    );
    label.position.set(item.x, item.boss ? 9.5 : 2.9 * scaleBoss + 0.5, item.z);
    scene.add(label);
    api.totems[item.id] = { beaconMat, creature };
    api.creatures.push({ grp: creature, it: item });
  });

  model.interactables.filter(item => item.kind === 'book').forEach(item => {
    const { bookMat } = fieldNoteProp(scene, item.x, item.z, 0x7defff);
    const label = gothicLabel(
      (item.ord ? '#' + item.ord + ' · ' : '') + 'FIELD NOTE',
      '#7DEFFF',
      0.42,
    );
    label.position.set(item.x, 2.5, item.z);
    scene.add(label);
    scene.add(fxCone(0x7defff, 1.6, 5.1, 0.055, item.x, item.z));
    api.books[item.lid] = { bookMat };
  });

  const gate = new THREE.Group();
  for (let x = -3.2; x <= 3.2; x += 1.6) {
    const bar = new THREE.Mesh(roundedBoxGeometry(0.28, 5.2, 0.28, 0.05, 2), steel);
    bar.position.set(x, 2.6, model.gateZ);
    bar.castShadow = true;
    gate.add(bar);
  }
  const cross = new THREE.Mesh(roundedBoxGeometry(8.2, 0.36, 0.4, 0.06, 2), brass);
  cross.position.set(0, 4.7, model.gateZ);
  gate.add(cross);
  scene.add(gate);
  api.gateGrp = gate;
  const gateLabel = gothicLabel('THE DEEP GATE', '#FF8B82', 0.85);
  gateLabel.position.set(0, 6.1, model.gateZ + 0.2);
  scene.add(gateLabel);

  const lift = model.interactables.find(item => item.kind === 'exit');
  const padMesh = new THREE.Mesh(
    roundedBoxGeometry(4.6, 0.16, 4.6, 0.08, 2),
    pbrMaterial('silicon', 0x1a4a55, {
      roughness: 0.28,
      metalness: 0.62,
      emissive: 0x155e6b,
      emissiveIntensity: 0.55,
      repeat: 2,
    }),
  );
  padMesh.position.set(lift.x, 0.08, lift.z);
  padMesh.receiveShadow = true;
  scene.add(padMesh);
  const liftLabel = gothicLabel('SURFACE LIFT', '#7DEFFF', 0.8);
  liftLabel.position.set(lift.x, 3.1, lift.z);
  scene.add(liftLabel);
  api.nextGrp = makeNextBeacon(scene, 0xf5b14c, false);

  api.exploration = buildExplorationProps(scene, model, 0xf5b14c);
  api.fogGate = buildFogGate(scene, model, 0xff6b62);

  markOpaqueShadows(scene);

  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    chandelier.rotation.y = time * 0.08;
    landmark.rotation.y = time * 0.03;
    shaft.material.opacity = 0.022 + Math.sin(time * 0.7) * 0.008;
    atmosphere.rotation.y = time * 0.004;
  });

  const art = {
    world: 1,
    name: 'Bit Mines',
    palette: MINE_PALETTE,
    landmark,
    detail,
    atmosphere,
    shaft,
    frame,
    pathLighting,
    chandelier,
    lighting,
    lanterns,
    materialCoverage: materialCoverage(scene),
    quality: low ? 'low' : 'high',
    grade: {
      saturation: 0.94,
      contrast: 1.14,
      tint: 0xf3e6d4,
      lift: -0.028,
      gamma: 1.04,
      gain: 1.01,
    },
  };
  scene.userData.worldArt = art;
  api.worldArt = art;
  return api;
}

export {
  MINE_PALETTE,
  SHAFT_SPLIT,
  buildMineWorldScene,
};

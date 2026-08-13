import * as THREE from 'three';
import { buildWorldArt } from './art-direction.js';
import { pbrMaterial, roundedBoxGeometry, finalizeWorldMaterials } from './materials.js';

const STYLE_GUIDE_MODEL = {
  bounds: { minX: -34, maxX: 34, minZ: -62, maxZ: 18 },
  rects: [{ x1: -34, x2: 34, z1: -62, z2: 18 }],
  spawn: { x: 0, z: 14, yaw: 0 },
  path: [
    { x: 0, z: 12 },
    { x: -4, z: -2 },
    { x: 3, z: -18 },
    { x: 0, z: -36 },
    { x: 0, z: -53 },
  ],
  interactables: [
    { id: 'style_note', kind: 'book', x: -8, z: -8 },
    { id: 'style_station', kind: 'fight', x: 8, z: -18 },
  ],
};

function buildStyleGuideScene(scene) {
  scene.background = new THREE.Color(0x03060c);
  scene.fog = new THREE.FogExp2(0x0a1620, 0.018);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(78, 94, 32, 32),
    pbrMaterial('wetRock', 0x655f55, { roughness: 0.72, metalness: 0.03, repeat: 8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -22;
  floor.receiveShadow = true;
  scene.add(floor);

  const samples = [
    ['wetRock', 0x6c655b],
    ['wornSteel', 0x65717b],
    ['concrete', 0x85878a],
    ['brass', 0x9b7536],
    ['silicon', 0x4a5362],
  ];
  samples.forEach(([surface, color], index) => {
    const x = (index - 2) * 4.8;
    const pedestal = new THREE.Mesh(
      roundedBoxGeometry(3.4, 0.65, 3.4, 0.24, 2),
      pbrMaterial('concrete', 0x343a41, { roughness: 0.82 }),
    );
    pedestal.position.set(x, 0.33, -8);
    pedestal.castShadow = pedestal.receiveShadow = true;
    scene.add(pedestal);
    const sampleOptions = {};
    if (surface === 'wetRock') sampleOptions.roughness = 0.62;
    if (surface === 'wornSteel' || surface === 'brass' || surface === 'silicon') sampleOptions.metalness = 0.72;
    const sample = new THREE.Mesh(
      index % 2
        ? roundedBoxGeometry(2.4, 2.4, 2.4, 0.36, 3)
        : new THREE.SphereGeometry(1.42, 32, 20),
      pbrMaterial(surface, color, sampleOptions),
    );
    sample.position.set(x, 2, -8);
    sample.castShadow = sample.receiveShadow = true;
    sample.userData.materialSample = surface;
    scene.add(sample);
  });

  const terminal = new THREE.Group();
  const terminalBody = new THREE.Mesh(
    roundedBoxGeometry(2.2, 3.2, 1.2, 0.28, 3),
    pbrMaterial('paintedMetal', 0x293744, { roughness: 0.46, metalness: 0.62 }),
  );
  terminalBody.position.y = 1.6;
  terminal.add(terminalBody);
  const terminalScreen = new THREE.Mesh(
    roundedBoxGeometry(1.45, 1.05, 0.09, 0.08, 2),
    new THREE.MeshStandardMaterial({
      color: 0x7defff,
      emissive: 0x22d3ee,
      emissiveIntensity: 3.4,
      roughness: 0.24,
      toneMapped: false,
    }),
  );
  terminalScreen.position.set(0, 1.95, 0.64);
  terminal.add(terminalScreen);
  terminal.position.set(-8, 0, -18);
  scene.add(terminal);
  const terminalLight = new THREE.PointLight(0x22d3ee, 1.5, 12, 2);
  terminalLight.position.set(-8, 2.5, -16.8);
  scene.add(terminalLight);

  const marker = new THREE.Group();
  const markerBody = new THREE.Mesh(
    roundedBoxGeometry(1.2, 4.2, 1.2, 0.22, 2),
    pbrMaterial('wornSteel', 0x56616c, { metalness: 0.78, roughness: 0.34 }),
  );
  markerBody.position.y = 2.1;
  marker.add(markerBody);
  const markerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.12, 8, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffc76b,
      emissive: 0xff9b3d,
      emissiveIntensity: 3,
      toneMapped: false,
    }),
  );
  markerRing.rotation.x = Math.PI / 2;
  markerRing.position.y = 4.35;
  marker.add(markerRing);
  marker.position.set(8, 0, -18);
  scene.add(marker);

  const worldArt = buildWorldArt(scene, STYLE_GUIDE_MODEL, 0);
  worldArt.materialCoverage = finalizeWorldMaterials(scene, 0);
  const animations = scene.userData.anims = scene.userData.anims || [];
  animations.push((time) => {
    markerRing.rotation.z = time * 0.7;
    terminalScreen.material.emissiveIntensity = 2.8 + Math.sin(time * 1.7) * 0.55;
  });
  return { model: STYLE_GUIDE_MODEL, worldArt, samples, terminal, marker };
}

export { STYLE_GUIDE_MODEL, buildStyleGuideScene };

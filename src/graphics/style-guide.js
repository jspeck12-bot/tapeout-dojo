import * as THREE from 'three';
import {
  materialCoverage,
  pbrMaterial,
  roundedBoxGeometry,
} from './materials.js';
import { mineLabelSprite } from './primitives.js';

const STYLE_GUIDE_MODEL = {
  bounds: { minX: -24, maxX: 24, minZ: -70, maxZ: 18 },
  rects: [{ x1: -24, x2: 24, z1: -70, z2: 18 }],
  spawn: { x: 0, z: 14, yaw: 0 },
  path: [
    { x: 0, z: 12 },
    { x: 0, z: 0 },
    { x: 0, z: -14 },
    { x: 0, z: -30 },
    { x: 0, z: -50 },
  ],
  interactables: [
    { id: 'style_note', kind: 'book', x: -11, z: -19 },
    { id: 'style_station', kind: 'fight', x: 11, z: -20 },
  ],
};

const PALETTE = {
  void: 0x02050a,
  fog: 0x08141d,
  concrete: 0x303740,
  steel: 0x53606b,
  warm: 0xffb35f,
  cyan: 0x69e7ff,
  violet: 0x9a7dff,
  silicon: 0x536575,
};

function addMesh(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function emissivePbr(surface, color, intensity = 3) {
  return pbrMaterial(surface, color, {
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.28,
    metalness: surface === 'silicon' ? 0.62 : 0.2,
    toneMapped: false,
  });
}

function styleLabel(text, color, scale) {
  const label = mineLabelSprite(text, color, scale);
  label.material.toneMapped = false;
  label.material.depthTest = false;
  label.material.opacity = 1;
  label.renderOrder = 24;
  return label;
}

function buildArchitecture(scene) {
  const frame = new THREE.Group();
  frame.userData.foregroundFrame = true;
  const concrete = pbrMaterial('concrete', PALETTE.concrete, {
    roughness: 0.82,
    repeat: 4,
  });
  const steel = pbrMaterial('wornSteel', 0x28313a, {
    roughness: 0.42,
    metalness: 0.74,
    repeat: 4,
  });

  [-1, 1].forEach(side => {
    const x = side * 15.4;
    const pier = addMesh(
      frame,
      roundedBoxGeometry(3.1, 15.5, 3.4, 0.3, 4),
      concrete,
      x,
      7.75,
      7,
    );
    pier.rotation.z = side * -0.035;
    pier.castShadow = pier.receiveShadow = true;
    const innerRib = addMesh(
      frame,
      roundedBoxGeometry(0.48, 12.4, 0.56, 0.1, 3),
      steel,
      x - side * 1.72,
      6.4,
      6.4,
    );
    innerRib.castShadow = true;
  });
  const lintel = addMesh(
    frame,
    roundedBoxGeometry(29.2, 2.2, 3.4, 0.34, 4),
    concrete,
    0,
    14.4,
    7,
  );
  lintel.castShadow = lintel.receiveShadow = true;
  const signal = addMesh(
    frame,
    roundedBoxGeometry(15.5, 0.16, 0.16, 0.05, 2),
    emissivePbr('silicon', PALETTE.violet, 1.15),
    0,
    13.15,
    5.22,
  );
  signal.userData.signal = true;
  scene.add(frame);

  const nave = new THREE.Group();
  nave.userData.nave = true;
  const zPositions = [-7, -20, -34, -49];
  zPositions.forEach((z, index) => {
    [-1, 1].forEach(side => {
      const height = 10.5 + index * 2.35;
      const x = side * (15.2 + index * 0.65);
      const column = addMesh(
        nave,
        roundedBoxGeometry(2.35, height, 2.6, 0.25, 3),
        index % 2 ? steel : concrete,
        x,
        height / 2,
        z,
      );
      column.rotation.z = side * (0.018 + index * 0.008);
      column.castShadow = column.receiveShadow = true;
      const cap = addMesh(
        nave,
        roundedBoxGeometry(3.1, 0.55, 3.25, 0.16, 3),
        steel,
        x,
        height + 0.22,
        z,
      );
      cap.castShadow = true;
    });
  });
  [-21, -42].forEach((z, index) => {
    [-1, 1].forEach(side => {
      const bridge = addMesh(
        nave,
        roundedBoxGeometry(10.5, 0.75, 1.2, 0.18, 3),
        steel,
        side * 10.2,
        15.8 + index * 3.2,
        z,
      );
      bridge.castShadow = true;
    });
  });
  scene.add(nave);
  return { frame, nave };
}

function buildWaferMonument(scene) {
  const landmark = new THREE.Group();
  landmark.userData.landmark = true;
  const silicon = pbrMaterial('silicon', PALETTE.silicon, {
    roughness: 0.24,
    metalness: 0.74,
    repeat: 2,
  });
  const brass = pbrMaterial('brass', 0x7d5a27, {
    roughness: 0.38,
    metalness: 0.82,
    repeat: 2,
  });
  const concrete = pbrMaterial('concrete', 0x252b31, {
    roughness: 0.86,
    repeat: 2,
  });

  const dais = addMesh(
    landmark,
    roundedBoxGeometry(19, 1.4, 8.5, 0.42, 4),
    concrete,
    0,
    0.7,
    0,
  );
  dais.castShadow = dais.receiveShadow = true;
  const secondStep = addMesh(
    landmark,
    roundedBoxGeometry(14, 1.1, 5.5, 0.32, 4),
    concrete,
    0,
    1.75,
    0,
  );
  secondStep.castShadow = secondStep.receiveShadow = true;
  const stem = addMesh(
    landmark,
    roundedBoxGeometry(3.4, 9.5, 2.5, 0.3, 4),
    brass,
    0,
    6.8,
    0.2,
  );
  stem.castShadow = true;

  const wafer = addMesh(
    landmark,
    new THREE.CylinderGeometry(7.4, 7.4, 0.72, 64, 2),
    silicon,
    0,
    11.5,
    0,
  );
  wafer.rotation.x = Math.PI / 2;
  wafer.castShadow = wafer.receiveShadow = true;
  wafer.userData.wafer = true;
  const edge = addMesh(
    landmark,
    new THREE.TorusGeometry(7.46, 0.22, 12, 96),
    emissivePbr('silicon', PALETTE.cyan, 2.7),
    0,
    11.5,
    0.48,
  );
  edge.userData.monumentRing = true;
  const orbit = addMesh(
    landmark,
    new THREE.TorusGeometry(9.1, 0.09, 8, 96),
    emissivePbr('silicon', PALETTE.violet, 1.8),
    0,
    11.5,
    0.25,
  );
  orbit.rotation.z = 0.24;
  orbit.userData.orbit = true;

  const die = addMesh(
    landmark,
    roundedBoxGeometry(5.4, 4.1, 0.62, 0.36, 4),
    pbrMaterial('silicon', 0x21313f, {
      roughness: 0.2,
      metalness: 0.76,
    }),
    0,
    11.5,
    0.82,
  );
  die.castShadow = true;
  [
    [-1.55, 0, 2.4, 0.18],
    [1.55, 0, 2.4, 0.18],
    [0, -1.15, 0.18, 1.4],
    [0, 1.15, 0.18, 1.4],
  ].forEach(([x, y, width, height]) => {
    addMesh(
      landmark,
      roundedBoxGeometry(width, height, 0.1, 0.035, 2),
      emissivePbr('silicon', PALETTE.warm, 3.1),
      x,
      11.5 + y,
      1.18,
    );
  });
  landmark.position.set(0, 0, -54);
  scene.add(landmark);
  return landmark;
}

function buildMaterialGallery(scene) {
  const gallery = new THREE.Group();
  gallery.userData.materialGallery = true;
  const concrete = pbrMaterial('concrete', 0x343a40, {
    roughness: 0.84,
    repeat: 2,
  });
  const specs = [
    {
      label: 'WET ROCK',
      surface: 'wetRock',
      color: 0x555d56,
      x: -10.4,
      z: -6.5,
      geometry: new THREE.IcosahedronGeometry(1.85, 3),
    },
    {
      label: 'WORN STEEL',
      surface: 'wornSteel',
      color: 0x68737d,
      x: -5.2,
      z: -9,
      geometry: roundedBoxGeometry(3.25, 3.25, 3.25, 0.48, 5),
    },
    {
      label: 'CONCRETE',
      surface: 'concrete',
      color: 0x8a8c8e,
      x: 0,
      z: -10.2,
      geometry: new THREE.SphereGeometry(1.8, 40, 28),
    },
    {
      label: 'BRASS',
      surface: 'brass',
      color: 0xa37936,
      x: 5.2,
      z: -9,
      geometry: new THREE.CylinderGeometry(1.65, 1.85, 3.6, 32, 2),
    },
    {
      label: 'SILICON',
      surface: 'silicon',
      color: 0x51677d,
      x: 10.4,
      z: -6.5,
      geometry: new THREE.OctahedronGeometry(2.05, 2),
    },
  ];

  const samples = specs.map((spec, index) => {
    const pedestal = addMesh(
      gallery,
      roundedBoxGeometry(4.15, 0.9, 4.15, 0.3, 4),
      concrete,
      spec.x,
      0.45,
      spec.z,
    );
    pedestal.castShadow = pedestal.receiveShadow = true;
    const trim = addMesh(
      gallery,
      roundedBoxGeometry(3.45, 0.12, 3.45, 0.04, 2),
      emissivePbr('silicon', index % 2 ? PALETTE.cyan : PALETTE.warm, 1.1),
      spec.x,
      0.94,
      spec.z,
    );
    trim.receiveShadow = false;
    const sampleOptions = {};
    if (spec.surface === 'wetRock') sampleOptions.roughness = 0.54;
    if (['wornSteel', 'brass', 'silicon'].includes(spec.surface)) {
      sampleOptions.metalness = 0.76;
    }
    const sample = addMesh(
      gallery,
      spec.geometry,
      pbrMaterial(spec.surface, spec.color, sampleOptions),
      spec.x,
      2.7,
      spec.z,
    );
    sample.castShadow = sample.receiveShadow = true;
    sample.userData.materialSample = spec.surface;
    const label = styleLabel(
      spec.label,
      index % 2 ? '#A8F1FF' : '#FFE0A3',
      0.56,
    );
    label.position.set(spec.x, 5.65, spec.z);
    gallery.add(label);
    return sample;
  });
  scene.add(gallery);
  return { gallery, samples };
}

function buildFieldTerminal(scene) {
  const terminal = new THREE.Group();
  terminal.userData.fieldTerminal = true;
  const body = addMesh(
    terminal,
    roundedBoxGeometry(3.5, 5.2, 2, 0.36, 4),
    pbrMaterial('paintedMetal', 0x26333d, {
      roughness: 0.44,
      metalness: 0.58,
    }),
    0,
    2.6,
    0,
  );
  body.castShadow = true;
  const screen = addMesh(
    terminal,
    roundedBoxGeometry(2.45, 1.65, 0.12, 0.1, 3),
    emissivePbr('silicon', PALETTE.cyan, 3.2),
    0,
    3.15,
    1.08,
  );
  screen.userData.terminalScreen = true;
  const base = addMesh(
    terminal,
    roundedBoxGeometry(4.6, 0.65, 3.2, 0.24, 3),
    pbrMaterial('concrete', 0x30363d, { roughness: 0.86 }),
    0,
    0.32,
    0,
  );
  base.receiveShadow = true;
  const label = styleLabel('FIELD NOTE // MATERIAL DOCTRINE', '#A8F1FF', 0.34);
  label.position.set(0, 6.2, 0);
  terminal.add(label);
  terminal.position.set(-11, 0, -21);
  terminal.rotation.y = 0.18;
  scene.add(terminal);
  return terminal;
}

function buildStationMarker(scene) {
  const station = new THREE.Group();
  station.userData.stationMarker = true;
  const body = addMesh(
    station,
    roundedBoxGeometry(2, 6.3, 2, 0.28, 4),
    pbrMaterial('wornSteel', 0x515e69, {
      roughness: 0.36,
      metalness: 0.8,
    }),
    0,
    3.15,
    0,
  );
  body.castShadow = true;
  const ring = addMesh(
    station,
    new THREE.TorusGeometry(1.85, 0.17, 12, 48),
    emissivePbr('silicon', PALETTE.warm, 3.3),
    0,
    6.7,
    0,
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.stationRing = true;
  const label = styleLabel('01 // SIGNAL STATION', '#FFE0A3', 0.36);
  label.position.set(0, 8.2, 0);
  station.add(label);
  station.position.set(11, 0, -22);
  station.rotation.y = -0.16;
  scene.add(station);
  return station;
}

function buildSignalPath(scene) {
  const group = new THREE.Group();
  group.userData.pathLighting = true;
  const traceMaterial = emissivePbr('silicon', PALETTE.warm, 2.6);
  const poolMaterial = emissivePbr('silicon', 0xffcf7c, 2.2);
  const points = [
    { x: 0, z: 12, width: 0.24, depth: 8 },
    { x: -0.8, z: 3.2, width: 2.2, depth: 0.24 },
    { x: 0.8, z: -1.8, width: 2.2, depth: 0.24 },
    { x: 0, z: -7, width: 0.24, depth: 8 },
    { x: -0.65, z: -14, width: 1.8, depth: 0.24 },
    { x: 0.65, z: -21, width: 1.8, depth: 0.24 },
    { x: 0, z: -31.5, width: 0.24, depth: 18 },
    { x: 0, z: -45, width: 3.4, depth: 0.24 },
  ];
  points.forEach((point, index) => {
    const trace = addMesh(
      group,
      roundedBoxGeometry(point.width, 0.08, point.depth, 0.035, 2),
      index % 3 === 0 ? poolMaterial : traceMaterial,
      point.x,
      0.08,
      point.z,
    );
    trace.userData.signalPath = true;
  });
  [-2, -18, -37].forEach((z, index) => {
    const side = index % 2 ? -1 : 1;
    const pool = addMesh(
      group,
      new THREE.RingGeometry(1.05, 1.28, 32),
      new THREE.MeshBasicMaterial({
        color: PALETTE.warm,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      side * 2.6,
      0.1,
      z,
    );
    pool.rotation.x = -Math.PI / 2;
    const light = new THREE.PointLight(PALETTE.warm, 44, 15, 2);
    light.position.set(side * 2.6, 2.4, z);
    light.userData.lightRole = 'path-lure';
    group.add(light);
  });
  scene.add(group);
  return group;
}

function buildDebris(scene) {
  const count = 68;
  const geometry = new THREE.DodecahedronGeometry(0.34, 0);
  geometry.userData.shared = true;
  const material = pbrMaterial('wetRock', 0x434b47, {
    roughness: 0.62,
  });
  const detail = new THREE.InstancedMesh(geometry, material, count);
  detail.userData.edgeDebris = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index++) {
    const side = index % 2 ? -1 : 1;
    const row = Math.floor(index / 2);
    const z = 12 - row * 2.15;
    const wobble = Math.sin(index * 12.9898) * 0.8;
    position.set(side * (13.2 + (row % 4) * 0.72) + wobble, 0.22, z);
    quaternion.setFromEuler(new THREE.Euler(index * 0.17, index * 0.61, index * 0.11));
    const size = 0.55 + (index % 5) * 0.12;
    scale.set(size, size * (0.55 + (index % 3) * 0.18), size);
    matrix.compose(position, quaternion, scale);
    detail.setMatrixAt(index, matrix);
  }
  detail.instanceMatrix.needsUpdate = true;
  detail.castShadow = detail.receiveShadow = true;
  scene.add(detail);
  return detail;
}

function buildAtmosphere(scene) {
  const count = 190;
  const positions = new Float32Array(count * 3);
  let state = 0x51c0a7;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = 0; index < count; index++) {
    positions[index * 3] = -23 + random() * 46;
    positions[index * 3 + 1] = 0.5 + random() * 19;
    positions[index * 3 + 2] = 14 - random() * 82;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: PALETTE.cyan,
    size: 0.11,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const atmosphere = new THREE.Points(geometry, material);
  atmosphere.userData.atmosphere = true;
  scene.add(atmosphere);
  return atmosphere;
}

function buildLightShaft(scene) {
  const shaft = new THREE.Mesh(
    new THREE.ConeGeometry(8.5, 35, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0.022,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  shaft.position.set(0, 17.5, -54);
  shaft.userData.lightShaft = true;
  shaft.castShadow = false;
  scene.add(shaft);
  return shaft;
}

function buildLighting(scene) {
  const fill = new THREE.HemisphereLight(0x537d91, 0x100b08, 0.52);
  fill.userData.lightRole = 'ambient-fill';
  scene.add(fill);

  const key = new THREE.DirectionalLight(0xffc985, 1.95);
  key.position.set(-19, 26, 18);
  key.target.position.set(0, 2.5, -12);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 25;
  key.shadow.camera.bottom = -18;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 115;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.38;
  key.userData.lightRole = 'key';
  scene.add(key, key.target);

  const coolFill = new THREE.DirectionalLight(0x6fb8dc, 0.56);
  coolFill.position.set(20, 12, 8);
  coolFill.target.position.set(0, 5, -24);
  coolFill.userData.lightRole = 'cool-fill';
  scene.add(coolFill, coolFill.target);

  const rim = new THREE.SpotLight(PALETTE.cyan, 720, 105, 0.58, 0.88, 2);
  rim.position.set(0, 21, -44);
  rim.target.position.set(0, 5.5, -8);
  rim.userData.lightRole = 'rim';
  scene.add(rim, rim.target);

  const monumentGlow = new THREE.PointLight(PALETTE.cyan, 92, 31, 2);
  monumentGlow.position.set(0, 11.5, -50);
  monumentGlow.userData.lightRole = 'monument-lure';
  scene.add(monumentGlow);
  return { fill, key, coolFill, rim, monumentGlow };
}

function buildStyleGuideScene(scene) {
  scene.background = new THREE.Color(PALETTE.void);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.014);
  scene.userData.baseFogDensity = scene.fog.density;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 96, 48, 80),
    pbrMaterial('wetRock', 0x4c514d, {
      roughness: 0.58,
      metalness: 0.02,
      repeat: 12,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -26);
  floor.receiveShadow = true;
  floor.userData.heroFloor = true;
  scene.add(floor);

  const { frame, nave } = buildArchitecture(scene);
  const landmark = buildWaferMonument(scene);
  const { gallery, samples } = buildMaterialGallery(scene);
  const terminal = buildFieldTerminal(scene);
  const station = buildStationMarker(scene);
  const pathLighting = buildSignalPath(scene);
  const detail = buildDebris(scene);
  const atmosphere = buildAtmosphere(scene);
  const shaft = buildLightShaft(scene);
  const lighting = buildLighting(scene);

  const animations = scene.userData.anims = scene.userData.anims || [];
  animations.push((time, delta) => {
    landmark.traverse(object => {
      if (object.userData.wafer) object.rotation.y = Math.sin(time * 0.16) * 0.035;
      if (object.userData.orbit) object.rotation.z += delta * 0.055;
    });
    const ring = station.children.find(object => object.userData.stationRing);
    if (ring) ring.rotation.z = time * 0.42;
    const terminalScreen = terminal.children.find(object => object.userData.terminalScreen);
    if (terminalScreen) {
      terminalScreen.material.emissiveIntensity = 2.7 + Math.sin(time * 1.35) * 0.35;
    }
    atmosphere.rotation.y = Math.sin(time * 0.04) * 0.025;
    shaft.material.opacity = 0.02 + Math.sin(time * 0.42) * 0.004;
  });

  const coverage = materialCoverage(scene);
  const worldArt = {
    world: 'style-guide',
    name: 'Silicon Gothic Material & Lighting Lab',
    palette: PALETTE,
    landmark,
    frame,
    nave,
    gallery,
    pathLighting,
    detail,
    atmosphere,
    shaft,
    terminal,
    station,
    samples,
    materialCoverage: coverage,
    ...lighting,
    grade: {
      saturation: 0.92,
      contrast: 1.1,
      tint: 0xe8f3ff,
      lift: -0.018,
      gamma: 1.02,
      gain: 1.01,
      exposure: 1.04,
    },
  };
  scene.userData.worldArt = worldArt;
  return {
    model: STYLE_GUIDE_MODEL,
    worldArt,
    samples,
    terminal,
    station,
  };
}

export { STYLE_GUIDE_MODEL, PALETTE, buildStyleGuideScene };

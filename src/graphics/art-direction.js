import * as THREE from 'three';

const WORLD_ART = {
  0: { name: 'Fab Campus', top: 0x050a18, horizon: 0x173f55, key: 0x7defff, rim: 0x9b7dff, prop: 0x24364a, dust: 0x7defff, density: 54 },
  1: { name: 'Bit Mines', top: 0x080402, horizon: 0x4b2710, key: 0xffb35c, rim: 0x54d9ff, prop: 0x4a3520, dust: 0xffc76b, density: 64 },
  2: { name: 'Gate Valley', top: 0x06110b, horizon: 0x416329, key: 0xa3e635, rim: 0x7defff, prop: 0x334523, dust: 0xd7ffa1, density: 72 },
  3: { name: 'Module Foundry', top: 0x120705, horizon: 0x723217, key: 0xff7b38, rim: 0x22d3ee, prop: 0x4b2b22, dust: 0xff9a55, density: 72 },
  4: { name: 'Combinational Canyon', top: 0x120806, horizon: 0x9b6030, key: 0xffa14a, rim: 0xffdf91, prop: 0x5a4028, dust: 0xffc47a, density: 76 },
  5: { name: 'Clock Tower', top: 0x040814, horizon: 0x24446b, key: 0x5bd9ff, rim: 0xa78bfa, prop: 0x26384e, dust: 0x8ee9ff, density: 62 },
  6: { name: 'FSM Fortress', top: 0x0c0614, horizon: 0x57305f, key: 0xfb7185, rim: 0xc4b5fd, prop: 0x3b304a, dust: 0xff9ead, density: 68 },
  7: { name: 'TAPEOUT', top: 0x05090f, horizon: 0x42515e, key: 0xfacc15, rim: 0x7defff, prop: 0x485462, dust: 0xffe67a, density: 48 },
};

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function skyMaterial(config) {
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(config.top) },
      horizonColor: { value: new THREE.Color(config.horizon) },
      glowColor: { value: new THREE.Color(config.key) },
    },
    vertexShader: [
      'varying vec3 vWorld;',
      'void main(){ vec4 world = modelMatrix * vec4(position,1.0); vWorld=world.xyz;',
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor;',
      'varying vec3 vWorld;',
      'void main(){ vec3 d=normalize(vWorld-cameraPosition);',
      'float h=smoothstep(-0.18,0.72,d.y);',
      'float sun=pow(max(0.0,dot(d,normalize(vec3(-0.45,0.3,-0.7)))),18.0);',
      'vec3 c=mix(horizonColor,topColor,h)+glowColor*sun*0.22;',
      'gl_FragColor=vec4(c,1.0); }',
    ].join('\n'),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

function worldCenter(model) {
  return {
    x: (model.bounds.minX + model.bounds.maxX) / 2,
    z: (model.bounds.minZ + model.bounds.maxZ) / 2,
    span: Math.max(model.bounds.maxX - model.bounds.minX, model.bounds.maxZ - model.bounds.minZ),
  };
}

function makeLandmark(world, config) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: config.prop,
    emissive: config.rim,
    emissiveIntensity: 0.18,
    roughness: 0.42,
    metalness: 0.72,
  });
  const light = new THREE.MeshBasicMaterial({ color: config.key });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material === metal;
    group.add(mesh);
    return mesh;
  };

  if (world === 1) {
    for (let index = -2; index <= 2; index++) {
      const crystal = add(new THREE.OctahedronGeometry(1.1 + Math.abs(index) * 0.12, 0), index ? metal : light, index * 2.2, 3.4 + Math.abs(index), 0);
      crystal.scale.y = 3.2;
    }
  } else if (world === 2) {
    add(new THREE.BoxGeometry(5.5, 20, 3.2), metal, 0, 10, 0);
    add(new THREE.TorusGeometry(4.6, 0.18, 8, 48), light, 0, 16, 0).rotation.x = Math.PI / 2;
  } else if (world === 3) {
    [-4, 0, 4].forEach((x, index) => {
      add(new THREE.CylinderGeometry(1.1, 1.6, 16 + index * 3, 10), metal, x, 8 + index * 1.5, 0);
      add(new THREE.ConeGeometry(1.7, 2.5, 10), light, x, 17 + index * 3, 0);
    });
  } else if (world === 4) {
    add(new THREE.BoxGeometry(2.2, 14, 2.2), metal, -6, 7, 0);
    add(new THREE.BoxGeometry(2.2, 14, 2.2), metal, 6, 7, 0);
    add(new THREE.BoxGeometry(14, 2, 2.2), metal, 0, 13, 0);
    add(new THREE.IcosahedronGeometry(2.1, 1), light, 0, 10, 0);
  } else if (world === 5) {
    [3.2, 5.1, 7].forEach((radius, index) => {
      const ring = add(new THREE.TorusGeometry(radius, 0.28, 10, 64), index === 1 ? light : metal, 0, 11, 0);
      ring.rotation.set(index * 0.7, index * 0.45, index * 0.25);
      ring.userData.spin = (index % 2 ? -1 : 1) * (0.12 + index * 0.05);
    });
  } else if (world === 6) {
    [-6, 6].forEach(x => {
      add(new THREE.CylinderGeometry(2.4, 3.1, 17, 8), metal, x, 8.5, 0);
      add(new THREE.ConeGeometry(3.2, 3.6, 8), light, x, 18.2, 0);
    });
    add(new THREE.BoxGeometry(10, 7, 3), metal, 0, 4, 0);
  } else if (world === 7) {
    const wafer = add(new THREE.CylinderGeometry(7, 7, 0.7, 64), metal, 0, 12, 0);
    wafer.rotation.z = Math.PI / 2;
    add(new THREE.TorusGeometry(9, 0.25, 12, 72), light, 0, 12, 0);
  } else {
    const die = add(new THREE.BoxGeometry(11, 1, 11), metal, 0, 10, 0);
    die.rotation.set(0.25, 0.35, 0.12);
    add(new THREE.TorusGeometry(8, 0.2, 10, 64), light, 0, 10, 0);
  }
  group.userData.landmark = true;
  return group;
}

function addInstancedDetail(scene, model, config, world, low) {
  const count = low ? 18 : config.density;
  const geometry = world === 3 || world === 6
    ? new THREE.BoxGeometry(0.7, 1.8, 0.7)
    : new THREE.IcosahedronGeometry(0.55, 0);
  const material = new THREE.MeshStandardMaterial({
    color: config.prop,
    roughness: 0.88,
    metalness: world === 3 || world === 5 || world === 7 ? 0.55 : 0.16,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seeded(0x51c0 + world * 977);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index++) {
    const x = model.bounds.minX + random() * (model.bounds.maxX - model.bounds.minX);
    const z = model.bounds.minZ + random() * (model.bounds.maxZ - model.bounds.minZ);
    const scale = 0.55 + random() * 1.5;
    matrix.compose(
      new THREE.Vector3(x, 0.35 * scale, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(random() * 0.4, random() * Math.PI, random() * 0.3)),
      new THREE.Vector3(scale, scale, scale),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = !low;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addAtmosphere(scene, model, config, world, low) {
  const count = low ? 40 : 120;
  const positions = new Float32Array(count * 3);
  const random = seeded(0xa710 + world * 313);
  for (let index = 0; index < count; index++) {
    positions[index * 3] = model.bounds.minX + random() * (model.bounds.maxX - model.bounds.minX);
    positions[index * 3 + 1] = 0.8 + random() * 14;
    positions[index * 3 + 2] = model.bounds.minZ + random() * (model.bounds.maxZ - model.bounds.minZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: config.dust,
    size: world === 3 ? 0.2 : 0.12,
    transparent: true,
    opacity: world === 7 ? 0.2 : 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = true;
  scene.add(particles);
  return particles;
}

function addLightShaft(scene, x, z, color, span) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.014,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const shaft = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(5, span * 0.08), Math.max(24, span * 0.35), 24, 1, true),
    material,
  );
  shaft.position.set(x, Math.max(12, span * 0.18), z);
  shaft.rotation.z = 0.08;
  shaft.renderOrder = 3;
  scene.add(shaft);
  return shaft;
}

function buildWorldArt(scene, model, world) {
  if (scene.userData.worldArt) return scene.userData.worldArt;
  const config = WORLD_ART[world];
  if (!config) throw new Error(`Missing art direction for world ${world}`);
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const center = worldCenter(model);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(center.span * 1.8 + 80, 32, 18),
    skyMaterial(config),
  );
  sky.position.set(center.x, 0, center.z);
  sky.frustumCulled = false;
  scene.add(sky);

  const landmark = makeLandmark(world, config);
  const landmarkPoint = model.path?.[Math.max(0, model.path.length - 2)] || { x: center.x, z: center.z };
  landmark.position.set(landmarkPoint.x, 0, landmarkPoint.z);
  scene.add(landmark);

  const detail = addInstancedDetail(scene, model, config, world, low);
  const atmosphere = addAtmosphere(scene, model, config, world, low);
  const shaft = addLightShaft(scene, landmarkPoint.x, landmarkPoint.z, config.key, center.span);
  const rim = new THREE.DirectionalLight(config.rim, low ? 0.35 : 0.7);
  rim.position.set(center.x - center.span * 0.25, center.span * 0.45, center.z + center.span * 0.2);
  rim.target.position.set(center.x, 0, center.z);
  scene.add(rim, rim.target);

  const animations = scene.userData.anims = scene.userData.anims || [];
  animations.push((time, delta) => {
    landmark.rotation.y += delta * 0.06;
    landmark.traverse(object => {
      if (object.userData.spin) object.rotation.z += object.userData.spin * delta;
    });
    atmosphere.rotation.y = time * 0.004;
    shaft.material.opacity = 0.012 + Math.sin(time * 0.7) * 0.004;
  });

  const art = {
    world,
    name: config.name,
    palette: config,
    landmark,
    detail,
    atmosphere,
    shaft,
    quality: low ? 'low' : 'high',
    grade: {
      saturation: world === 7 ? 0.96 : 1.08,
      contrast: world === 0 ? 1.06 : 1.1,
      tint: new THREE.Color(config.horizon).lerp(new THREE.Color(0xffffff), 0.82).getHex(),
    },
  };
  scene.userData.worldArt = art;
  return art;
}

export { WORLD_ART, buildWorldArt };

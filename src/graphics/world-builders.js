import * as THREE from "three";
import { mulberry32, GAUNTLETS } from '../game/content.js';
import { enemyFor } from '../game/rpg.js';
import { activeDone } from '../world/challenges.js';
import { nextStationOf } from '../world/progression.js';
import { CAMPUS_SIZE, CAMPUS_DISTRICTS } from '../world/campus.js';
import { mineGateOpen } from '../world/mine.js';
import { dungeonGateOpen } from '../world/dungeon.js';
import { explorationState } from '../world/exploration.js';
import {
  WALL_H, makeTextCanvas, groundTexture, matStd, addBoxMesh, mineLabelSprite,
} from './primitives.js';
import { fxCone, glowSprite, lightScene } from './cinematic.js';
import {
  caveDressing, rockMaterial, rockNoise, rockWall, roughen, plinthRock,
  fieldNoteProp,
} from './rock.js';
import { creatureSpec, makeCreature } from './creatures.js';
import { buildWorldArt } from './art-direction.js';

function buildExplorationProps(scene, model, accent) {
  const built = {};
  for (const zone of model.exploration?.elevationZones || []) {
    const overlook = new THREE.Mesh(
      new THREE.CylinderGeometry(zone.radius * 0.55, zone.radius, zone.height, 28),
      matStd(0x263242, { roughness: 0.9, metalness: 0.18 }),
    );
    overlook.position.set(zone.x, zone.height / 2 - 0.05, zone.z);
    overlook.receiveShadow = true;
    scene.add(overlook);
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(zone.radius * 0.58, 0.08, 6, 36),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.36 }),
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(zone.x, zone.height + 0.06, zone.z);
    scene.add(rail);
  }
  for (const feature of (model.exploration && model.exploration.features) || []) {
    const group = new THREE.Group();
    group.position.set(feature.x, 0, feature.z);
    if (feature.kind === 'grace') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.09, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x3199b2 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.18;
      group.add(ring);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.18, 2.2, 8),
        new THREE.MeshBasicMaterial({ color: 0x42a9c0, transparent: true, opacity: 0.34 }),
      );
      pillar.position.y = 1.1;
      group.add(pillar);
      group.add(fxCone(0x3199b2, 0.85, 2.8, 0.012, 0, 0));
      const label = mineLabelSprite('TRACE GRACE', '#7DEFFF', 0.36);
      label.position.y = 2.65;
      group.add(label);
      (scene.userData.anims = scene.userData.anims || []).push((time) => {
        ring.rotation.z = time * 0.8;
        pillar.material.opacity = 0.3 + Math.sin(time * 2) * 0.1;
      });
      built[feature.id] = { group, material: ring.material, feature };
    } else if (feature.kind === 'lore') {
      const terminal = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.8, 0.45),
        matStd(0x182534, { emissive: accent, emissiveIntensity: 0.28, metalness: 0.7 }),
      );
      terminal.position.y = 0.9;
      group.add(terminal);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.72),
        new THREE.MeshBasicMaterial({ color: accent }),
      );
      screen.position.set(0, 1.05, 0.231);
      group.add(screen);
      built[feature.id] = { group, material: screen.material, feature };
    } else {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.8, 1.05),
        matStd(0x49351e, { emissive: 0x6f4819, emissiveIntensity: 0.35, metalness: 0.35 }),
      );
      crate.position.y = 0.4;
      group.add(crate);
      const trace = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.06, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0xffc76b }),
      );
      trace.rotation.x = Math.PI / 2;
      trace.position.y = 0.84;
      group.add(trace);
      built[feature.id] = { group, material: trace.material, feature };
    }
    scene.add(group);
  }
  return built;
}

function applyExplorationProgress(api, save) {
  if (!api || !api.exploration) return;
  const state = explorationState(save);
  Object.values(api.exploration).forEach((entry) => {
    const feature = entry.feature;
    const complete = feature.kind === 'grace'
      ? !!state.graces[feature.id]
      : feature.kind === 'lore'
        ? !!state.lore[feature.id]
        : !!state.caches[feature.id];
    if (feature.kind === 'cache') entry.group.visible = !complete;
    else entry.material.color.setHex(complete ? 0x2ea56a : feature.kind === 'grace' ? 0x3199b2 : 0xffc76b);
  });
}

function buildFogGate(scene, model, accent) {
  const fog = model.fogGate;
  if (!fog) return null;
  const gate = model.gateCollider;
  const horizontal = (gate.maxX - gate.minX) > (gate.maxZ - gate.minZ);
  const width = horizontal ? gate.maxX - gate.minX : gate.maxZ - gate.minZ;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(accent) },
      time: { value: 0 },
      opacity: { value: 0.36 },
    },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: [
      'uniform vec3 color; uniform float time; uniform float opacity; varying vec2 vUv;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'void main(){float edge=smoothstep(0.0,.14,vUv.x)*smoothstep(0.0,.14,1.0-vUv.x);',
      'float veil=.45+.35*sin(vUv.y*22.0+time*1.7)+.2*hash(floor(vUv*18.0)+time);',
      'gl_FragColor=vec4(color,opacity*edge*veil);}',
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(7, width), 6.5, 20, 12), material);
  plane.position.set(fog.x, 3.25, fog.z);
  if (!horizontal) plane.rotation.y = Math.PI / 2;
  plane.renderOrder = 6;
  scene.add(plane);
  const label = mineLabelSprite('CROSS THE FOG', '#FF8B82', 0.42);
  label.position.set(fog.x, 6.9, fog.z);
  scene.add(label);
  (scene.userData.anims = scene.userData.anims || []).push((time) => {
    material.uniforms.time.value = time;
  });
  return { plane, material, label, feature: fog };
}

function applyFogProgress(api, model, save, open) {
  if (!api?.fogGate) return;
  const boss = model.interactables.find((item) => item.boss);
  const visible = !!open && !activeDone(save)[boss.id];
  api.fogGate.plane.visible = visible;
  api.fogGate.label.visible = visible;
}

function buildFabUltra(scene, model, api) {
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const A = api.anims;

  // --- 1) master-die monument: floating wafer over the die center ---
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#140a22'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = ((x * 7 + y * 13) % 5) < 2 ? '#f5b14c' : '#8a5cf5';
      g.globalAlpha = 0.28 + ((x + y) % 3) * 0.24;
      g.fillRect(x * 32 + 4, y * 32 + 4, 24, 24);
    }
    g.globalAlpha = 0.5; g.strokeStyle = '#7defff'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke();
    }
    g.globalAlpha = 1;
    const tx = new THREE.CanvasTexture(cv);
    const wafer = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.55, 48),
      new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.85 }));
    wafer.position.set(0, 13, 0); wafer.rotation.z = 0.15; scene.add(wafer);
    const haloA = new THREE.Mesh(new THREE.TorusGeometry(8.8, 0.2, 10, 64), new THREE.MeshBasicMaterial({ color: 0xf5b14c }));
    haloA.rotation.x = Math.PI / 2; haloA.position.y = 13; scene.add(haloA);
    const haloB = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.1, 8, 64), new THREE.MeshBasicMaterial({ color: 0x7defff, transparent: true, opacity: 0.7 }));
    haloB.position.y = 13; scene.add(haloB);
    const under = new THREE.PointLight(0x8a5cf5, 1.7, 52, 2); under.position.set(0, 9.5, 0); scene.add(under);
    [[5.4, 5.4], [-5.4, 5.4], [5.4, -5.4], [-5.4, -5.4]].forEach(([bx, bz]) => scene.add(fxCone(0x8a5cf5, 1.5, 12.4, 0.06, bx, bz)));
    scene.add(fxCone(0xf5b14c, 3.2, 12.6, 0.05, 0, 0));
    const marquee = mineLabelSprite('T A P E O U T   F A B', '#FFD98A', 3.0);
    marquee.position.set(0, 18.6, 0); scene.add(marquee);
    A.push((t) => {
      wafer.rotation.y = t * 0.22;
      const bob = 13 + Math.sin(t * 0.7) * 0.5;
      wafer.position.y = bob; haloA.position.y = bob; haloB.position.y = bob;
      haloA.rotation.z = t * 0.3;
      haloB.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.35;
      haloB.rotation.z = -t * 0.22;
      under.intensity = 1.5 + Math.sin(t * 1.7) * 0.35;
    });
  }

  // --- 2) holo sigils spinning over every district gate ---
  (model.gates || []).forEach((gt, gi) => {
    const d = CAMPUS_DISTRICTS.find(x => x.w === gt.w) || {};
    const col = d.color || 0x7defff;
    const grp = new THREE.Group();
    grp.position.set(gt.x, 7.4, gt.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 40), new THREE.MeshBasicMaterial({ color: col }));
    grp.add(ring);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true }));
    grp.add(core);
    const sp = glowSprite(col, 5.4, 0.5); grp.add(sp);
    scene.add(grp);
    A.push((t) => {
      grp.position.y = 7.4 + Math.sin(t * 1.1 + gi) * 0.35;
      ring.rotation.y = t * 0.9 + gi;
      ring.rotation.x = Math.sin(t * 0.6 + gi) * 0.5;
      core.rotation.y = -t * 1.4;
      core.rotation.x = t * 0.7;
    });
  });

  // --- 3) overhead coolant network above the roads ---
  {
    const pipeMat = matStd(0x232f42, { roughness: 0.35, metalness: 0.9 });
    const coolMat = new THREE.MeshBasicMaterial({ color: 0x7defff, transparent: true, opacity: 0.85 });
    const clampMat = matStd(0x394a66, { roughness: 0.4, metalness: 0.85, emissive: 0x123a44, emissiveIntensity: 0.6 });
    const L = CAMPUS_SIZE - 24;
    const runs = [
      { x: 0, z: -30, y: 11.2, alongX: true }, { x: 0, z: 30, y: 11.2, alongX: true },
      { x: -30, z: 0, y: 12.6, alongX: false }, { x: 30, z: 0, y: 12.6, alongX: false },
    ];
    runs.forEach(rn => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, L, 12), pipeMat);
      const cool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, L + 0.4, 8), coolMat);
      pipe.position.set(rn.x, rn.y, rn.z); cool.position.set(rn.x, rn.y - 0.62, rn.z);
      if (rn.alongX) { pipe.rotation.z = Math.PI / 2; cool.rotation.z = Math.PI / 2; }
      else { pipe.rotation.x = Math.PI / 2; cool.rotation.x = Math.PI / 2; }
      scene.add(pipe); scene.add(cool);
      for (let s = -L / 2 + 12; s <= L / 2 - 12; s += 26) {
        const cl = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 8, 18), clampMat);
        cl.position.set(rn.alongX ? rn.x + s : rn.x, rn.y, rn.alongX ? rn.z : rn.z + s);
        cl.rotation.y = rn.alongX ? 0 : Math.PI / 2;
        scene.add(cl);
      }
    });
    [[-30, -30], [30, -30], [-30, 30], [30, 30]].forEach(([jx, jz]) => {
      const j = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), clampMat);
      j.position.set(jx, 11.9, jz); scene.add(j);
    });
  }

  // --- 4) wafer conveyor ring: product circling the die at y7 ---
  {
    const R = 40;
    const railMat = matStd(0x1b2434, { roughness: 0.5, metalness: 0.8, emissive: 0x0c2a33, emissiveIntensity: 0.5 });
    [[0, -R, true], [0, R, true], [-R, 0, false], [R, 0, false]].forEach(([rx, rz, ax]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ax ? R * 2 : 0.9, 0.32, ax ? 0.9 : R * 2), railMat);
      rail.position.set(rx, 6.6, rz); scene.add(rail);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 6.6, 8), railMat);
      post.position.set(rx, 3.3, rz); scene.add(post);
    });
    const squarePos = (p, r) => {
      const s = (p % 1) * 4, k = Math.floor(s), f = s - k;
      if (k === 0) return { x: -r + f * 2 * r, z: -r };
      if (k === 1) return { x: r, z: -r + f * 2 * r };
      if (k === 2) return { x: r - f * 2 * r, z: r };
      return { x: -r, z: r - f * 2 * r };
    };
    const wMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const wafers = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20), wMat);
      scene.add(m); wafers.push(m);
    }
    A.push((t) => {
      for (let i = 0; i < wafers.length; i++) {
        const pos = squarePos(t * 0.028 + i / wafers.length, R);
        wafers[i].position.set(pos.x, 6.95 + Math.sin(t * 2 + i) * 0.07, pos.z);
        wafers[i].rotation.y = t * 1.2 + i;
      }
    });
  }

  // --- 5) corner watchtowers with sweeping searchlights ---
  [[-118, -118], [118, -118], [-118, 118], [118, 118]].forEach(([tx2, tz], ti) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.7, 16, 1.7), matStd(0x1a2434, { roughness: 0.6, metalness: 0.7 }));
    col.position.set(tx2, 8, tz); scene.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.6), matStd(0x2a3a55, { roughness: 0.4, metalness: 0.8 }));
    cap.position.set(tx2, 16.2, tz); scene.add(cap);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5f52 }));
    beacon.position.set(tx2, 17, tz); scene.add(beacon);
    scene.add(fxCone(0x9fd8ff, 2.8, 15.4, 0.045, tx2, tz));
    const pivot = new THREE.Group(); pivot.position.set(tx2, 16.4, tz); scene.add(pivot);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 30, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = -14; beam.rotation.x = Math.PI; beam.renderOrder = 5;
    const tilt = new THREE.Group(); tilt.rotation.z = 0.62; tilt.add(beam); pivot.add(tilt);
    A.push((t) => {
      pivot.rotation.y = t * (0.24 + ti * 0.05) + ti * 1.7;
      beacon.material.color.setHex(Math.sin(t * 3.4 + ti) > 0 ? 0xff5f52 : 0x53160f);
    });
  });

  // --- 6) glowing die traces from the center plaza to every gate ---
  (model.gates || []).forEach(gt => {
    const d = CAMPUS_DISTRICTS.find(x => x.w === gt.w) || {};
    const dist = Math.hypot(gt.x, gt.z);
    if (dist < 20) return;
    const len = dist - 18;
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, len),
      new THREE.MeshBasicMaterial({ color: d.color || 0x7defff, transparent: true, opacity: 0.5 }));
    const ux = gt.x / dist, uz = gt.z / dist, mid = 12 + len / 2;
    tr.position.set(ux * mid, 0.06, uz * mid);
    tr.rotation.y = Math.atan2(ux, uz);
    scene.add(tr);
    const node = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.07, 16),
      new THREE.MeshBasicMaterial({ color: d.color || 0x7defff, transparent: true, opacity: 0.75 }));
    node.position.set(ux * 12, 0.07, uz * 12); scene.add(node);
  });

  // --- 7) drifting dust + high haze motes ---
  {
    const mk = (N, col, y0, y1, size, op) => {
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * CAMPUS_SIZE * 0.94;
        pos[i * 3 + 1] = y0 + Math.random() * (y1 - y0);
        pos[i * 3 + 2] = (Math.random() - 0.5) * CAMPUS_SIZE * 0.94;
      }
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(gm, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
      scene.add(pts);
      return pts;
    };
    const warm = mk(low ? 220 : 520, 0xffc98a, 0.4, 5, 0.5, 0.5);
    const cold = mk(low ? 140 : 340, 0x7defff, 6, 16, 0.7, 0.3);
    A.push((t) => {
      warm.rotation.y = t * 0.008; warm.position.y = Math.sin(t * 0.23) * 0.5;
      cold.rotation.y = -t * 0.005; cold.position.y = Math.sin(t * 0.17) * 0.8;
    });
  }

  // --- 8) orbiting service wisps ---
  for (let i = 0; i < 3; i++) {
    const col = [0x7defff, 0xf5b14c, 0xc4b5fd][i];
    const wg = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: col }));
    wg.add(orb); wg.add(glowSprite(col, 3.6, 0.7));
    const lt = new THREE.PointLight(col, 0.7, 16, 2); wg.add(lt);
    scene.add(wg);
    const r0 = 56 + i * 22, sp0 = 0.1 - i * 0.022, ph = i * 2.1;
    A.push((t) => {
      wg.position.set(Math.cos(t * sp0 + ph) * r0, 8.4 + Math.sin(t * 0.9 + ph) * 1.6, Math.sin(t * sp0 + ph) * r0);
    });
  }

  // --- shadow flags for the whole campus (desktop only) ---
  if (!low) {
    scene.traverse(o => {
      if (o.isMesh) {
        const tr = o.material && o.material.transparent;
        o.castShadow = !tr;
        o.receiveShadow = true;
      }
    });
  }
}

function buildCampusWorld(scene, model) {
  const api = { anims: [], gates: {}, beacons: {}, windows: {}, kioskScreens: {}, dispose: [] };

  // --- lights / sky ---
  scene.background = new THREE.Color(0x060A12);
  scene.fog = new THREE.Fog(0x060A12, 60, 230);
  const hemi = new THREE.HemisphereLight(0x3a566e, 0x0a0e14, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0x9fd8ff, 0.5);
  dir.position.set(60, 90, 30);
  scene.add(dir);
  if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) {
    try {
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      const SC = CAMPUS_SIZE / 2 + 14;
      dir.shadow.camera.left = -SC; dir.shadow.camera.right = SC;
      dir.shadow.camera.top = SC; dir.shadow.camera.bottom = -SC;
      dir.shadow.camera.near = 10; dir.shadow.camera.far = 260;
      dir.shadow.bias = -0.0006;
    } catch (e) { }
  }
  api.anims.push((t) => { // subtle 120s "fab night" cycle
    const c = (Math.sin(t * Math.PI * 2 / 120) + 1) / 2;
    hemi.intensity = 0.7 + 0.3 * c;
    dir.intensity = 0.35 + 0.3 * c;
  });

  // stars
  {
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.85);
      const r = 380;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 10;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(gm, new THREE.PointsMaterial({ color: 0xaad4ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }));
    scene.add(pts);
  }

  // --- ground ---
  const gtex = groundTexture(model);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CAMPUS_SIZE, CAMPUS_SIZE), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // die rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(CAMPUS_SIZE + 6, 1.2, CAMPUS_SIZE + 6), matStd(0x101826, { emissive: 0x123a44, emissiveIntensity: 0.5 }));
  rim.position.y = -0.7;
  scene.add(rim);

  // --- courtyard walls (mesh per collider tagged wall*) ---
  const wallMat = matStd(0x18222F, { emissive: 0x0c2a33, emissiveIntensity: 0.35 });
  model.colliders.forEach(b => {
    if (!/^wall/.test(b.tag)) return;
    const sx = b.maxX - b.minX, sz = b.maxZ - b.minZ;
    addBoxMesh(scene, (b.minX + b.maxX) / 2, WALL_H / 2, (b.minZ + b.maxZ) / 2, sx, WALL_H, sz, wallMat);
  });

  // --- gates ---
  model.gates.forEach(gt => {
    const d = model.districts.find(x => x.w === gt.w);
    const frameMat = matStd(0x222d3c);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x301014, emissive: 0xB1303A, emissiveIntensity: 1.1, transparent: true, opacity: 0.92 });
    const span = 14;
    // posts
    const p1 = gt.horiz ? [gt.x - span / 2, gt.z] : [gt.x, gt.z - span / 2];
    const p2 = gt.horiz ? [gt.x + span / 2, gt.z] : [gt.x, gt.z + span / 2];
    addBoxMesh(scene, p1[0], (WALL_H + 2) / 2, p1[1], 1.4, WALL_H + 2, 1.4, frameMat);
    addBoxMesh(scene, p2[0], (WALL_H + 2) / 2, p2[1], 1.4, WALL_H + 2, 1.4, frameMat);
    const lintel = addBoxMesh(scene, gt.x, WALL_H + 1.6, gt.z, gt.horiz ? span + 1.4 : 1.4, 1.2, gt.horiz ? 1.4 : span + 1.4, frameMat);
    // sliding panel
    const panel = addBoxMesh(scene, gt.x, WALL_H / 2, gt.z, gt.horiz ? span - 1 : 0.8, WALL_H, gt.horiz ? 0.8 : span - 1, panelMat);
    // sign above
    const signTex = makeTextCanvas([
      { text: 'SEAL ' + String(gt.w).padStart(2, '0'), size: 64, bold: true, color: '#FF8B82' },
      { text: d.name.toUpperCase(), size: 40, color: '#B9C6D6' },
    ], { border: '#B14A52' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(gt.x, WALL_H + 4.6, gt.z);
    if (!gt.horiz) sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    const g = { panel, panelMat, sign, open: false, anim: 0, collider: gt.collider, w: gt.w };
    api.gates[gt.w] = g;
    api.anims.push((t, dt) => {
      if (g.open && panel.position.y > -WALL_H / 2 - 0.6) {
        panel.position.y = Math.max(-WALL_H / 2 - 0.6, panel.position.y - dt * 3.2);
        panelMat.opacity = Math.max(0, panelMat.opacity - dt * 0.5);
      }
      if (!g.open) panelMat.emissiveIntensity = 0.9 + 0.35 * Math.sin(t * 2.2 + gt.w);
    });
  });

  // --- district landmarks + beacons + consoles + pads ---
  model.districts.forEach(d => {
    const a = model.anchors[d.w];
    const L = a.landmarkPos;
    buildLandmark(scene, d, L, api);
    // beacon pillar
    const bMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.16 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 10, 1, true), bMat);
    beam.position.set(L.x, 30, L.z);
    scene.add(beam);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), new THREE.MeshBasicMaterial({ color: d.color }));
    tip.position.set(L.x, 18 + (d.w === 7 ? 6 : 0), L.z);
    scene.add(tip);
    api.beacons[d.w] = { beam, bMat, tip };
    api.anims.push((t) => { tip.position.y = 18 + (d.w === 7 ? 6 : 0) + Math.sin(t * 1.4 + d.w) * 0.6; });
  });

  // consoles + plaza kiosks + pads
  model.interactables.forEach(it => {
    if (it.kind === 'console') {
      const d = model.districts.find(x => x.w === it.w);
      buildKiosk(scene, it.x, it.z, d.name.toUpperCase(), 'DISTRICT CONSOLE', '#' + d.color.toString(16).padStart(6, '0'), api, 'c' + it.w);
    } else if (it.kind === 'arcade') {
      buildKiosk(scene, it.x, it.z, it.label, 'PERIPHERAL', '#7DEFFF', api, it.id);
    } else if (it.kind === 'pad') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0x7DEFFF }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(it.x, 0.12, it.z);
      scene.add(ring);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0x155E6B, transparent: true, opacity: 0.5 }));
      glow.position.set(it.x, 0.06, it.z);
      scene.add(glow);
      api.anims.push((t) => { ring.rotation.z = t * 0.6; });
    }
  });

  api.worldArt = buildWorldArt(scene, model, 0);
  return api;
}

function buildKiosk(scene, x, z, title, sub, color, api, key) {
  const ped = addBoxMesh(scene, x, 0.7, z, 1.8, 1.4, 1.2, matStd(0x1a2432));
  const neck = addBoxMesh(scene, x, 1.8, z, 0.4, 1.0, 0.4, matStd(0x222d3c));
  const tex = makeTextCanvas([
    { text: title, size: 46, bold: true, color },
    { text: sub, size: 26, color: '#76849A' },
  ], { border: color });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(x, 2.9, z);
  scene.add(screen);
  api.kioskScreens[key] = { screen, baseY: 2.9 };
  api.anims.push((t) => { screen.position.y = 2.9 + Math.sin(t * 1.1 + x) * 0.07; screen.lookAtPlayer = true; });
  return screen;
}

function buildLandmark(scene, d, L, api) {
  const acc = d.color;
  if (d.w === 1) { // Bit Mines: headframe + ore
    const legMat = matStd(0x2a3344);
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([ox, oz]) => {
      const leg = addBoxMesh(scene, L.x + ox * 0.7, 5, L.z + oz * 0.7, 0.7, 10, 0.7, legMat);
      leg.rotation.y = 0.1;
    });
    addBoxMesh(scene, L.x, 10.2, L.z, 6.4, 0.8, 6.4, legMat);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 20), matStd(0x3a4759, { emissive: acc, emissiveIntensity: 0.25 }));
    wheel.position.set(L.x, 12.4, L.z);
    scene.add(wheel);
    api.anims.push((t) => { wheel.rotation.y = t * 0.7; });
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, matStd(0x33271a, { emissive: 0xFFB86B, emissiveIntensity: 0.12 }), 14);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2, rr = 10 + (i % 3) * 3;
      m4.makeRotationY(i);
      m4.setPosition(L.x + Math.cos(ang) * rr, 0.7, L.z + Math.sin(ang) * rr * 0.7);
      rocks.setMatrixAt(i, m4);
    }
    scene.add(rocks);
  } else if (d.w === 2) { // Gate Valley: arch row with gate names
    const names = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];
    names.forEach((nm, i) => {
      const gx = L.x - 12 + i * 6, gz = L.z;
      const m = matStd(0x223041, { emissive: acc, emissiveIntensity: 0.15 });
      addBoxMesh(scene, gx - 1.6, 3, gz, 0.8, 6, 0.8, m);
      addBoxMesh(scene, gx + 1.6, 3, gz, 0.8, 6, 0.8, m);
      addBoxMesh(scene, gx, 6.3, gz, 4.6, 0.7, 1.0, m);
      const tx = makeTextCanvas([{ text: nm, size: 90, bold: true, color: '#7DEFFF' }], { h: 160, border: '#155E6B' });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      s.position.set(gx, 5.2, gz + 0.6);
      scene.add(s);
    });
  } else if (d.w === 3) { // Module Foundry: hall + chimneys + crucible
    addBoxMesh(scene, L.x, 4, L.z, 16, 8, 11, matStd(0x232c39));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.4), new THREE.MeshBasicMaterial({ color: 0xFB923C, transparent: true, opacity: 0.85 }));
    win.position.set(L.x, 4, L.z + 5.56);
    scene.add(win);
    api.windows[3] = win;
    [-4, 4].forEach(ox => {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 7, 10), matStd(0x2a3344));
      ch.position.set(L.x + ox, 11, L.z - 2);
      scene.add(ch);
    });
    const cru = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.8, 2.6, 12), matStd(0x33271a, { emissive: 0xFB923C, emissiveIntensity: 0.9 }));
    cru.position.set(L.x + 11, 1.4, L.z + 2);
    scene.add(cru);
    api.anims.push((t) => { cru.material.emissiveIntensity = 0.7 + 0.4 * Math.sin(t * 3); });
  } else if (d.w === 4) { // Combinational Canyon: ridges + plank bridge
    const ridge = matStd(0x1f2a23, { emissive: 0xA3E635, emissiveIntensity: 0.06 });
    for (let i = 0; i < 5; i++) {
      const r1 = addBoxMesh(scene, L.x - 8 + i * 4, 2.6 + (i % 2), L.z - 7, 3.2, 5 + (i % 3) * 2, 3.5, ridge);
      r1.rotation.y = i * 0.5;
      const r2 = addBoxMesh(scene, L.x - 8 + i * 4, 2.2 + ((i + 1) % 2), L.z + 7, 3.4, 4 + ((i + 1) % 3) * 2, 3.2, ridge);
      r2.rotation.y = -i * 0.4;
    }
    for (let i = 0; i < 7; i++) addBoxMesh(scene, L.x - 7 + i * 2.4, 5.2, L.z, 1.8, 0.25, 2.6, matStd(0x4a3a22));
    addBoxMesh(scene, L.x - 8.4, 2.6, L.z, 0.5, 5.4, 0.5, matStd(0x2a3344));
    addBoxMesh(scene, L.x + 8.4, 2.6, L.z, 0.5, 5.4, 0.5, matStd(0x2a3344));
  } else if (d.w === 5) { // Clock Tower: tower + animated face
    addBoxMesh(scene, L.x, 11, L.z, 5, 22, 5, matStd(0x232c39));
    addBoxMesh(scene, L.x, 22.8, L.z, 6.4, 1.6, 6.4, matStd(0x2a3344, { emissive: acc, emissiveIntensity: 0.3 }));
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), new THREE.MeshBasicMaterial({ color: 0x0E141C }));
    face.position.set(L.x, 18, L.z + 2.56);
    scene.add(face);
    const rimm = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.16, 8, 26), new THREE.MeshBasicMaterial({ color: acc }));
    rimm.position.copy(face.position);
    scene.add(rimm);
    const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.06), new THREE.MeshBasicMaterial({ color: 0x7DEFFF }));
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.06), new THREE.MeshBasicMaterial({ color: 0xE8F1FA }));
    hand1.position.set(L.x, 18, L.z + 2.6);
    hand2.position.set(L.x, 18, L.z + 2.62);
    scene.add(hand1); scene.add(hand2);
    api.anims.push((t) => {
      hand1.rotation.z = -t * 0.5;
      hand2.rotation.z = -t * 0.05;
      hand1.position.x = L.x + Math.sin(-t * 0.5) * 0.65;
      hand1.position.y = 18 + Math.cos(-t * 0.5) * 0.65;
      hand2.position.x = L.x + Math.sin(-t * 0.05) * 0.45;
      hand2.position.y = 18 + Math.cos(-t * 0.05) * 0.45;
    });
  } else if (d.w === 6) { // FSM Fortress: keep + towers + crenellations
    addBoxMesh(scene, L.x, 5.5, L.z, 11, 11, 11, matStd(0x262433));
    [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4]].forEach(([ox, oz]) => {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 14, 10), matStd(0x2c2a3d));
      tw.position.set(L.x + ox, 7, L.z + oz);
      scene.add(tw);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 10), matStd(0x3a3454, { emissive: acc, emissiveIntensity: 0.3 }));
      cap.position.set(L.x + ox, 15.2, L.z + oz);
      scene.add(cap);
    });
    const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matStd(0x262433), 20);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) {
      const side = i % 4, k = Math.floor(i / 4) - 2;
      const px = side === 0 ? k * 2.4 : side === 1 ? k * 2.4 : side === 2 ? -5.5 : 5.5;
      const pz = side === 0 ? -5.5 : side === 1 ? 5.5 : k * 2.4;
      m4.setPosition(L.x + px, 11.5, L.z + pz);
      cren.setMatrixAt(i, m4);
    }
    scene.add(cren);
  } else if (d.w === 7) { // TAPEOUT fab: cleanroom + antenna
    addBoxMesh(scene, L.x, 5, L.z, 22, 10, 15, matStd(0x1c2735, { emissive: 0x0e3a44, emissiveIntensity: 0.4 }));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(19, 3.2), new THREE.MeshBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.7 }));
    win.position.set(L.x, 5, L.z + 7.56);
    scene.add(win);
    api.windows[7] = win;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 8), matStd(0x3a4759));
    mast.position.set(L.x + 7, 14.5, L.z - 3);
    scene.add(mast);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xFACC15 }));
    blink.position.set(L.x + 7, 19.3, L.z - 3);
    scene.add(blink);
    api.anims.push((t) => { blink.visible = Math.sin(t * 4) > -0.2; });
    const tx = makeTextCanvas([{ text: 'TAPEOUT', size: 86, bold: true, color: '#FFE27A' }], { h: 170, border: '#7A6310' });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
    s.position.set(L.x, 11.6, L.z + 7.6);
    scene.add(s);
  }
}

function applyCampusProgress(api, model, progress) {
  model.districts.forEach(d => {
    const p = progress.perWorld[d.w] || { unlocked: false, complete: false, frac: 0 };
    const b = api.beacons[d.w];
    if (b) {
      const col = !p.unlocked ? 0x39434f : p.complete ? (d.w === 7 || progress.ngplus ? 0xFACC15 : 0x2EA56A) : d.color;
      b.bMat.color.setHex(col);
      b.bMat.opacity = p.unlocked ? 0.16 + p.frac * 0.14 : 0.05;
      b.tip.material.color.setHex(col);
    }
    const g = api.gates[d.w];
    if (g) {
      const open = !!p.unlocked;
      if (open && !g.open) { g.open = true; g.collider.off = true; g.sign.visible = false; }
      if (!open) { g.open = false; g.collider.off = false; g.sign.visible = true; }
    }
    const w = api.windows[d.w];
    if (w) w.material.opacity = 0.35 + p.frac * 0.55;
  });
}

function makeNextBeacon(scene, acc, tall) {
  const g = new THREE.Group();
  const h = tall ? 12 : 4.4;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, h, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  pillar.position.y = h / 2; g.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 26), new THREE.MeshBasicMaterial({ color: acc }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  const lbl = mineLabelSprite('▼ NEXT', '#FFFFFF', 0.8);
  lbl.position.y = tall ? 12.9 : 4.95; g.add(lbl);
  const lt = new THREE.PointLight(0xffffff, 0.9, 20, 2); lt.position.y = 2.6; g.add(lt);
  (scene.userData.anims = scene.userData.anims || []).push((t) => { ring.rotation.z = t * 1.5; pillar.material.opacity = 0.72 + 0.22 * Math.sin(t * 3.2); lbl.position.y = (tall ? 12.9 : 4.95) + Math.sin(t * 2.1) * 0.16; });
  g.visible = false;
  scene.add(g);
  return g;
}

function skyDome(scene, topHex, horHex, cx, cz, radius) {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
  const g = cv.getContext('2d');
  const top = '#' + topHex.toString(16).padStart(6, '0');
  const hor = '#' + horHex.toString(16).padStart(6, '0');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(0.5, top); grad.addColorStop(0.84, hor); grad.addColorStop(1, hor);
  g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.position.set(cx, 0, cz); scene.add(dome);
  return dome;
}

function cliffRun(scene, model, mat, height, jitter, seed) {
  const rng = mulberry32(seed);
  model.colliders.forEach((wl, i) => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const h = height + (rng() - 0.5) * jitter;
    const g = roughen(new THREE.BoxGeometry(sx + 0.7, h, sz + 0.7, 3, 2, 3), Math.min(1.1, (sx + sz) * 0.04 + 0.3), (seed + i * 7) >>> 0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((wl.minX + wl.maxX) / 2, h / 2 - 0.5, (wl.minZ + wl.maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  });
}

function valleyMountains(scene, cx, cz, seed) {
  const rng = mulberry32(seed >>> 0);
  const rock = matStd(0x1e2c12, { roughness: 1.0, metalness: 0.04 });
  const rockFar = matStd(0x16240e, { roughness: 1.0, metalness: 0.02 });
  const snow = matStd(0x83906c, { roughness: 0.92, metalness: 0.04 });
  const ringPeaks = (R, count, hMin, hMax, mat, capped) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.2;
      const rr = R * (0.84 + rng() * 0.32);
      const h = hMin + rng() * (hMax - hMin);
      const bw = h * (0.5 + rng() * 0.32);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const peak = new THREE.Mesh(roughen(new THREE.ConeGeometry(bw, h, 5 + (i % 3), 1), bw * 0.18, (seed + i * 13) >>> 0), mat);
      peak.position.set(x, h / 2 - 2.5, z); peak.rotation.y = rng() * Math.PI; scene.add(peak);
      if (capped && h > hMax * 0.66) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.34, h * 0.26, 5, 1), snow);
        cap.position.set(x, h - h * 0.13 - 2.5, z); scene.add(cap);
      }
    }
  };
  ringPeaks(96, 22, 28, 54, rock, true);       // near range — rises right behind the valley cliffs
  ringPeaks(150, 18, 50, 90, rockFar, false);   // far range — taller, darker, hazing into the distance
}

function buildPathTrail(scene, path, acc, openSky) {
  if (!path || path.length < 2) return;
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const coreMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.85 });
  (scene.userData.anims = scene.userData.anims || []).push((t) => { coreMat.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4)); });
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const ang = Math.atan2(dx, dz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, len), ribbonMat);
    seg.position.set((a.x + b.x) / 2, 0.08, (a.z + b.z) / 2); seg.rotation.y = ang; scene.add(seg);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, len), coreMat);
    core.position.set((a.x + b.x) / 2, 0.1, (a.z + b.z) / 2); core.rotation.y = ang; scene.add(core);
  }
  path.forEach((p, i) => {
    if (i === 0) return;
    const isEnd = i === path.length - 1;
    const h = isEnd ? (openSky ? 20 : 5) : (openSky ? 3 + (i / path.length) * 7 : 3.2);
    const r = isEnd ? 0.7 : 0.26;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: isEnd ? 0.92 : 0.62 }));
    pylon.position.set(p.x, h / 2, p.z); scene.add(pylon);
    const lt = new THREE.PointLight(acc, isEnd ? 1.9 : 0.55, isEnd ? 46 : 13, 2);
    lt.position.set(p.x, isEnd ? 7 : 3, p.z); scene.add(lt);
    if (isEnd) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: acc }));
      orb.position.set(p.x, h, p.z); scene.add(orb);
      scene.add(fxCone(acc, openSky ? 3.6 : 2.4, openSky ? 19 : 4.8, openSky ? 0.09 : 0.12, p.x, p.z));
    }
  });
}

function buildValley(scene, model, theme) {
  const acc = theme.accent;
  const b = model.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  scene.background = new THREE.Color(0x16240e);
  scene.fog = new THREE.FogExp2(0x1c2e12, 0.0085);
  skyDome(scene, 0x0c1606, 0x33491c, cx, cz, 360);
  scene.add(new THREE.HemisphereLight(0x3a5a1e, 0x0a1206, 0.82));
  scene.add(new THREE.AmbientLight(0x24300f, theme.ambient * 0.7));

  // grassy basin floor (extends well past the cliffs to the horizon)
  const fw = (b.maxX - b.minX) + 300, fd = (b.maxZ - b.minZ) + 300;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 0.98, metalness: 0.04 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  buildPathTrail(scene, model.path, acc, true);

  // enclosing rock walls (read as valley cliffs)
  cliffRun(scene, model, rockMaterial({ repeat: [2, 3], normal: 1.3, tint: 0x3a4a22 }), 12, 3.0, 200 + model.world);
  valleyMountains(scene, cx, cz, 700 + model.world);

  // stone arches — a grand gateway flanking the gate, plus standalone ruins
  const postMat = matStd(0x2a3a16, { roughness: 0.8, metalness: 0.2 });
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const arch = (x, z, w, h) => {
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.85), postMat); p.position.set(x + s * w / 2, h / 2, z); scene.add(p); });
    const lint = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.95, 0.95), postMat); lint.position.set(x, h - 0.1, z); scene.add(lint);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.32, 0.55), accMat); cap.position.set(x, h + 0.35, z); scene.add(cap);
  };
  arch(0, -99, 16, 9);               // grand gateway at the golem grounds entrance
  arch(-38, -34, 7, 6);
  arch(40, -56, 7, 6);
  arch(-18, -82, 6, 5.4);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  lightScene(scene, model.bounds, { ceil: false, dust: acc, glowSize: 5.0, glowOpacity: 0.78, sky: 0x3a5a1e, skyI: 0.95 });
  api.worldArt = buildWorldArt(scene, model, model.world);
  return api;
}

function buildCanyon(scene, model, theme) {
  const acc = theme.accent;
  const b = model.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  scene.background = new THREE.Color(0x24130a);
  scene.fog = new THREE.FogExp2(0x2c1808, 0.016);
  skyDome(scene, 0x140a04, 0x5a3416, cx, cz, 190);
  scene.add(new THREE.HemisphereLight(0x6a4420, 0x140a04, 0.6));
  scene.add(new THREE.AmbientLight(0x2e1c0c, theme.ambient * 0.7));

  const fw = (b.maxX - b.minX) + 120, fd = (b.maxZ - b.minZ) + 120;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 1.0, metalness: 0.03 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  buildPathTrail(scene, model.path, acc, true);

  // sandstone mesa walls (reuse the cave-rock texture set for canyon stone)
  const mesaMat = rockMaterial({ repeat: [3, 2], normal: 1.3, tint: 0xb0884e });
  cliffRun(scene, model, mesaMat, 13, 3.2, 300 + model.world);

  // rock spires perched on the mesa tops for a jagged skyline
  const rng = mulberry32(77 + model.world);
  model.colliders.forEach((wl, i) => {
    if (i % 2 !== 0) return;
    const mx = (wl.minX + wl.maxX) / 2, mz = (wl.minZ + wl.maxZ) / 2;
    const h = 3 + rng() * 4;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1 + rng() * 0.6, h, 6), mesaMat);
    spire.position.set(mx + (rng() - 0.5) * 1.5, 12 + h / 2, mz + (rng() - 0.5) * 1.5);
    spire.rotation.y = rng() * Math.PI;
    scene.add(spire);
  });

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };
  buildDungeonNodes(scene, model, theme, api);
  lightScene(scene, model.bounds, { ceil: false, dust: acc, glowSize: 5.2, glowOpacity: 0.8, sky: 0x8a5a28, skyI: 1.0 });
  api.worldArt = buildWorldArt(scene, model, model.world);
  return api;
}

function buildMineWorld(scene, model) {
  scene.background = new THREE.Color(0x0a0604);
  scene.fog = new THREE.FogExp2(0x0a0604, 0.045);
  scene.add(new THREE.AmbientLight(0x3a2c1a, 0.62));
  const hemi = new THREE.HemisphereLight(0x32281a, 0x0a0604, 0.4);
  scene.add(hemi);

  const pad = 8;
  const b = model.bounds;
  const floorMat = rockMaterial({ repeat: [11, 11], normal: 1.0, tint: 0x8a7858, disp: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2, 100, 100), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  scene.add(floor);
  buildPathTrail(scene, model.path, 0xf5b14c);
  const zSplit = -62;
  const ceilMat = rockMaterial({ repeat: [9, 9], normal: 1.2, tint: 0x554636 });
  const mkCeil = (z1, z2, y, amp, segs) => {
    const w = b.maxX - b.minX + pad * 2, cxx = (b.minX + b.maxX) / 2, czz = (z1 + z2) / 2;
    const cg = new THREE.PlaneGeometry(w, z2 - z1, segs, segs);
    cg.rotateX(Math.PI / 2); cg.translate(cxx, y, czz);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i); let dy = rockNoise(x + 7, 3, z + 7) * amp - amp * 0.4; dy = Math.max(-amp * 1.6, Math.min(amp * 0.7, dy)); cp.setY(i, cp.getY(i) + dy); }
    cp.needsUpdate = true; cg.computeVertexNormals();
    const m = new THREE.Mesh(cg, ceilMat); m.material.side = THREE.DoubleSide; scene.add(m);
  };
  mkCeil(zSplit, b.maxZ + pad, 5.4, 1.05, 70);   // low ceiling: shaft + galleries
  mkCeil(b.minZ - pad, zSplit, 16.5, 2.4, 48);   // tall vault over the wyrm hollow

  const wallSmall = rockMaterial({ repeat: [1.6, 1.4], normal: 1.45 });
  const wallMed = rockMaterial({ repeat: [4, 1.6], normal: 1.45 });
  const wallLong = rockMaterial({ repeat: [10, 1.8], normal: 1.45 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ, L = Math.max(sx, sz);
    const mat = L > 40 ? wallLong : (L > 14 ? wallMed : wallSmall);
    const cx = (wl.minX + wl.maxX) / 2, cz = (wl.minZ + wl.maxZ) / 2;
    const H = cz < zSplit + 1 ? 16.5 : 5.4;       // wyrm-hollow walls rise into a tall cavern
    const m = rockWall(sx, H, sz, mat, cx, cz);
    m.position.set(cx, H / 2, cz);
    scene.add(m);
  });
  // lintel sealing the gap above the gate opening (low shaft -> tall arena)
  const lintel = rockWall(10, 12, 1.6, wallSmall, 0, zSplit);
  lintel.position.set(0, 10.4, zSplit);
  scene.add(lintel);

  // ore veins (seeded)
  const rng = mulberry32(1337);
  const cyan = new THREE.MeshBasicMaterial({ color: 0x7defff });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffc76b });
  for (let i = 0; i < 26; i++) {
    const wl = model.colliders[Math.floor(rng() * model.colliders.length)];
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const v = new THREE.Mesh(new THREE.BoxGeometry(Math.min(sx, 0.7) + 0.5, 0.5 + rng() * 0.7, Math.min(sz, 0.7) + 0.5), rng() < 0.6 ? cyan : amber);
    v.position.set(wl.minX + rng() * sx, 0.7 + rng() * 2.6, wl.minZ + rng() * sz);
    v.rotation.y = rng() * Math.PI;
    scene.add(v);
  }

  // support beams across the shaft
  const wood = matStd(0x4a3520, { roughness: 0.95 });
  model.beams.forEach(bm => {
    [-3.7, 3.7].forEach(x => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 4.9, 0.36), wood);
      post.position.set(bm.x + x, 2.45, bm.z);
      scene.add(post);
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.34, 0.4), wood);
    bar.position.set(bm.x, 4.75, bm.z);
    scene.add(bar);
  });

  // lanterns
  model.lanterns.forEach(L => {
    const pt = new THREE.PointLight(0xffb066, 1.05, 17, 1.6);
    pt.position.set(L.x, 3.6, L.z);
    scene.add(pt);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.32), new THREE.MeshBasicMaterial({ color: 0xffc98a }));
    bulb.position.set(L.x, 3.6, L.z);
    scene.add(bulb);
  });

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };

  // enemy totems
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
    const g = GAUNTLETS.find(x => x.id === it.id);
    const sc = it.boss ? 1.7 : 1;
    plinthRock(scene, it.x, it.z, sc);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6b62 });
    const creature = makeCreature(creatureSpec(1, en.name, it.boss), beaconMat);
    creature.position.set(it.x, 0.5, it.z);
    scene.add(creature);
    const fl = new THREE.PointLight(it.boss ? 0xfacc15 : 0xff6b62, it.boss ? 0.9 : 0.6, 15, 2.0);
    fl.position.set(it.x, 3.2 * sc, it.z);
    scene.add(fl);
    scene.add(fxCone(it.boss ? 0xfacc15 : 0xff6b62, it.boss ? 3.2 : 2.0, 5.1, it.boss ? 0.1 : 0.06, it.x, it.z));
    const nl = mineLabelSprite((it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name, it.boss ? '#FFE27A' : '#FF8B82', it.boss ? 0.44 : 0.34);
    nl.position.set(it.x, it.boss ? 9.5 : 2.9 * sc + 0.5, it.z);
    scene.add(nl);
    api.totems[it.id] = { beaconMat, creature };
    api.creatures.push({ grp: creature, it });
  });

  // field-note books
  model.interactables.filter(i => i.kind === 'book').forEach(it => {
    const { bookMat } = fieldNoteProp(scene, it.x, it.z, 0x7defff);
    const lbl = mineLabelSprite((it.ord ? '#' + it.ord + ' · ' : '') + 'FIELD NOTE', '#7DEFFF', 0.42);
    lbl.position.set(it.x, 2.5, it.z);
    scene.add(lbl);
    scene.add(fxCone(0x7defff, 1.6, 5.1, 0.055, it.x, it.z));
    api.books[it.lid] = { bookMat };
  });

  // boss gate bars
  const gate = new THREE.Group();
  const barMat = matStd(0x3a4a63, { roughness: 0.4, metalness: 0.8 });
  for (let x = -3.2; x <= 3.2; x += 1.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 0.3), barMat);
    bar.position.set(x, 2.6, model.gateZ);
    gate.add(bar);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 0.42), barMat);
  cross.position.set(0, 4.7, model.gateZ);
  gate.add(cross);
  scene.add(gate);
  api.gateGrp = gate;
  const gl = mineLabelSprite('THE DEEP GATE', '#FF8B82', 0.85);
  gl.position.set(0, 6.1, model.gateZ + 0.2);
  scene.add(gl);

  // surface lift
  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 4.6), new THREE.MeshBasicMaterial({ color: 0x155e6b }));
  padM.position.set(lift.x, 0.09, lift.z);
  scene.add(padM);
  const ll = mineLabelSprite('SURFACE LIFT', '#7DEFFF', 0.8);
  ll.position.set(lift.x, 3.1, lift.z);
  scene.add(ll);
  api.nextGrp = makeNextBeacon(scene, 0xf5b14c, false);

  caveDressing(scene, model);
  lightScene(scene, model.bounds, { ceil: true, dust: 0x6a5030, glowSize: 4.8, glowOpacity: 0.8 });
  api.exploration = buildExplorationProps(scene, model, 0xf5b14c);
  api.fogGate = buildFogGate(scene, model, 0xff6b62);
  api.worldArt = buildWorldArt(scene, model, 1);

  return api;
}

function applyMineProgress(api, model, save) {
  const d = activeDone(save);
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const t = api.totems[it.id];
    if (!t) return;
    t.beaconMat.color.setHex(d[it.id] ? 0x2ea56a : it.boss ? 0xfacc15 : 0xff6b62);
    if (t.creature) t.creature.userData.dead = !!d[it.id];
  });
  const lr = save.lessons || {};
  Object.keys(api.books).forEach(lid => {
    api.books[lid].bookMat.color.setHex(lr[lid] ? 0x3a5a66 : 0x7defff);
  });
  if (api.gateGrp) api.gateGrp.visible = !mineGateOpen(save);
  if (api.nextGrp) {
    const nx = nextStationOf(model, save);
    if (nx) { api.nextGrp.visible = true; api.nextGrp.position.set(nx.x, 0, nx.z); }
    else api.nextGrp.visible = false;
  }
  applyExplorationProgress(api, save);
  applyFogProgress(api, model, save, mineGateOpen(save));
}

function buildArcadeWorld(scene, model) {
  scene.background = new THREE.Color(0x06060f);
  scene.fog = new THREE.FogExp2(0x06060f, 0.022);
  scene.add(new THREE.AmbientLight(0x404a66, 0.7));
  scene.add(new THREE.HemisphereLight(0x222a44, 0x0a0810, 0.5));

  const b = model.bounds, pad = 6;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + pad * 2;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2), matStd(0x0b0b16, { roughness: 0.6, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  const grid = new THREE.GridHelper(span, 28, 0x22d3ee, 0x163848);
  grid.position.set(cx, 0.02, cz); scene.add(grid);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2), matStd(0x07070f, { roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, 5, cz); scene.add(ceil);

  const wallMat = matStd(0x14101e, { roughness: 0.7, metalness: 0.25 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 5, sz), wallMat);
    m.position.set((wl.minX + wl.maxX) / 2, 2.5, (wl.minZ + wl.maxZ) / 2);
    scene.add(m);
  });
  const neon = [0xff7df0, 0x22d3ee, 0xa3e635, 0xffc76b];
  model.colliders.filter(w => (w.maxX - w.minX) > 6 || (w.maxZ - w.minZ) > 6).slice(0, 8).forEach((wl, i) => {
    const sx = Math.max(0.3, wl.maxX - wl.minX), sz = Math.max(0.3, wl.maxZ - wl.minZ);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.96, 0.14, sz * 0.96), new THREE.MeshBasicMaterial({ color: neon[i % neon.length] }));
    strip.position.set((wl.minX + wl.maxX) / 2, 4.6, (wl.minZ + wl.maxZ) / 2);
    scene.add(strip);
  });

  const api = { cabinets: {}, spin: null };
  model.interactables.filter(i => i.kind === 'arcade').forEach(it => {
    const col = new THREE.Color(it.accent);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.7, 1.1), matStd(0x0c0c16, { roughness: 0.5, metalness: 0.5 }));
    body.position.set(it.x, 1.35, it.z); scene.add(body);
    const screenMat = new THREE.MeshBasicMaterial({ color: col });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.8), screenMat);
    const faceZ = it.z < model.spawn.z ? 1 : -1;
    scr.position.set(it.x, 1.9, it.z + 0.58 * faceZ);
    if (faceZ < 0) scr.rotation.y = Math.PI;
    scene.add(scr);
    const lt = new THREE.PointLight(col.getHex(), 0.85, 12, 1.8);
    lt.position.set(it.x, 2.7, it.z); scene.add(lt);
    const lbl = mineLabelSprite(it.label, '#' + col.getHexString(), 0.78);
    lbl.position.set(it.x, 3.6, it.z); scene.add(lbl);
    api.cabinets[it.id] = { screenMat, light: lt };
  });

  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 4.4), new THREE.MeshBasicMaterial({ color: 0x7a2a30 }));
  padM.position.set(lift.x, 0.09, lift.z); scene.add(padM);
  const ll = mineLabelSprite('MAIN MENU', '#FF8B82', 0.8);
  ll.position.set(lift.x, 3.0, lift.z); scene.add(ll);

  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), matStd(0x1a2230, { metalness: 0.7, roughness: 0.3 }));
  pole.position.set(0, 1.7, 0); scene.add(pole);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 12, 32), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  ring.position.set(0, 3.6, 0); scene.add(ring);
  api.spin = ring;
  lightScene(scene, model.bounds, { ceil: true, dust: 0x9a6abf, glowSize: 4.0, glowOpacity: 0.9, shadowLights: 3 });
  api.worldArt = buildWorldArt(scene, model, 0);
  return api;
}

function buildDungeonNodes(scene, model, theme, api) {
  const acc = theme.accent;
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const en = enemyFor(it.id, model.world, it.xp || 30, it.boss, 'engineer', false);
    const sc = it.boss ? 1.7 : 1;
    plinthRock(scene, it.x, it.z, sc);
    const beaconMat = new THREE.MeshBasicMaterial({ color: it.boss ? 0xfacc15 : acc });
    const creature = makeCreature(creatureSpec(model.world, en.name, it.boss), beaconMat);
    creature.position.set(it.x, 0.5, it.z); scene.add(creature);
    const lt = new THREE.PointLight(it.boss ? 0xfacc15 : acc, it.boss ? 1.0 : 0.7, 16, 1.8);
    lt.position.set(it.x, 3.6 * sc, it.z); scene.add(lt);
    scene.add(fxCone(it.boss ? 0xfacc15 : acc, it.boss ? 3.4 : 2.1, theme.ceil ? 5.1 : (it.boss ? 15 : 12), it.boss ? 0.1 : 0.06, it.x, it.z));
    const nl = mineLabelSprite((it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name, it.boss ? '#FFE27A' : '#CFE0F2', it.boss ? 0.44 : 0.34);
    nl.position.set(it.x, it.boss ? 9.5 : 2.9 * sc + 0.5, it.z);
    scene.add(nl);
    api.totems[it.id] = { beaconMat, creature };
    api.creatures.push({ grp: creature, it });
  });
  model.interactables.filter(i => i.kind === 'book').forEach(it => {
    const { bookMat } = fieldNoteProp(scene, it.x, it.z, acc);
    const lbl = mineLabelSprite((it.ord ? '#' + it.ord + ' · ' : '') + 'FIELD NOTE', '#' + acc.toString(16).padStart(6, '0'), 0.42);
    lbl.position.set(it.x, 2.5, it.z); scene.add(lbl);
    scene.add(fxCone(acc, 1.6, theme.ceil ? 5.1 : 9, 0.055, it.x, it.z));
    api.books[it.lid] = { bookMat };
  });
  const gx = model.gateX || 0, gw = model.gateW || 8;
  const gate = new THREE.Group();
  const barMat = matStd(0x3a4a63, { roughness: 0.4, metalness: 0.8 });
  for (let x = gx - gw / 2 + 0.8; x <= gx + gw / 2; x += 1.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 0.3), barMat);
    bar.position.set(x, 2.6, model.gateZ); gate.add(bar);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.2, 0.4, 0.42), new THREE.MeshBasicMaterial({ color: acc }));
  cross.position.set(gx, 4.7, model.gateZ); gate.add(cross);
  scene.add(gate); api.gateGrp = gate;
  const gl = mineLabelSprite('SEALED GATE', '#FF8B82', 0.85);
  gl.position.set(gx, 6.1, model.gateZ + 0.2); scene.add(gl);
  const lift = model.interactables.find(i => i.kind === 'exit');
  const padM = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 4.6), new THREE.MeshBasicMaterial({ color: 0x155e6b }));
  padM.position.set(lift.x, 0.09, lift.z); scene.add(padM);
  const ll = mineLabelSprite('SURFACE LIFT', '#7DEFFF', 0.8);
  ll.position.set(lift.x, 3.1, lift.z); scene.add(ll);
  api.nextGrp = makeNextBeacon(scene, acc, !theme.ceil);
  api.exploration = buildExplorationProps(scene, model, acc);
  api.fogGate = buildFogGate(scene, model, 0xff6b62);
}

function scatterStructures(scene, model, theme) {
  const acc = theme.accent, b = model.bounds;
  const rng = mulberry32(900 + model.world * 7);
  const nodes = model.interactables.map(i => ({ x: i.x, z: i.z }));
  const path = model.path || [];
  const wallMat = matStd(theme.wallCol, { roughness: 0.9, metalness: 0.18 });
  const darkMat = matStd(theme.floorCol, { roughness: 1, metalness: 0.1 });
  const litMat = matStd(theme.wallCol, { roughness: 0.5, metalness: 0.5 });
  const capMat = new THREE.MeshBasicMaterial({ color: acc });
  const inHall = (x, z) => model.rects.some(r => x > r.x1 + 1.2 && x < r.x2 - 1.2 && z > r.z1 + 1.2 && z < r.z2 - 1.2);
  const nearNode = (x, z) => nodes.some(n => Math.hypot(n.x - x, n.z - z) < 5.5);
  const onPath = (x, z) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], c = path[i + 1], dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz;
      let t = L2 ? ((x - a.x) * dx + (z - a.z) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < 4.5) return true;
    }
    return false;
  };
  const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
  const target = Math.min(74, Math.round(area / 95));
  let placed = 0, tries = 0;
  while (placed < target && tries < target * 16) {
    tries++;
    const x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ);
    if (!inHall(x, z) || nearNode(x, z) || onPath(x, z)) continue;
    placed++;
    const k = rng();
    if (k < 0.34) {
      const h = 3.4 + rng() * 6;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + rng() * 0.5, 0.65 + rng() * 0.5, h, 8), wallMat);
      col.position.set(x, h / 2, z); scene.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), capMat);
      cap.position.set(x, h + 0.3, z); scene.add(cap);
    } else if (k < 0.6) {
      const h = 1 + rng() * 2.6, w = 1 + rng() * 2.2;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7 + 0.6), litMat);
      blk.position.set(x, h / 2, z); blk.rotation.y = rng() * Math.PI; scene.add(blk);
    } else if (k < 0.82) {
      const h = 1.8 + rng() * 3;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.5 + rng() * 0.5, h, 5), wallMat);
      sh.position.set(x, h / 2, z); sh.rotation.y = rng() * Math.PI; scene.add(sh);
    } else {
      const h = 0.4 + rng() * 0.9;
      const d = new THREE.Mesh(new THREE.BoxGeometry(1 + rng() * 1.6, h, 1 + rng() * 1.6), darkMat);
      d.position.set(x, h / 2, z); d.rotation.y = rng() * Math.PI; scene.add(d);
    }
  }
}

function trailProps(scene, model, theme) {
  const acc = theme.accent, pts = model.path || [];
  if (pts.length < 2) return;
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const matte = matStd(theme.wallCol, { roughness: 0.6, metalness: 0.5 });
  const W2 = ((model.gateW || 22) - 0.6) / 2;
  for (let i = 1; i < pts.length - 2; i++) {
    const p = pts[i];
    const py = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4.8, 8), matte);
    py.position.set(p.x, 2.4, p.z); scene.add(py);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), accMat);
    cap.position.set(p.x, 5.0, p.z); scene.add(cap);
  }
  const kind = theme.prop;
  for (let i = 0; i < pts.length - 2; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 14) continue;
    const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L, px = -dz, pz = dx;
    for (let s = 12; s < L - 8; s += 20) {
      const x = a.x + dx * s, z = a.z + dz * s;
      if (kind === 'pipe') {
        [-1, 1].forEach(sd => {
          const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), accMat);
          pipe.position.set(x + px * sd * (W2 - 1), 2.6, z + pz * sd * (W2 - 1)); scene.add(pipe);
        });
      } else if (kind === 'gear') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.2, 8, 26), accMat);
        ring.position.set(x + px * (W2 - 1.4), 3.3, z + pz * (W2 - 1.4)); ring.rotation.y = Math.atan2(px, pz); scene.add(ring);
      } else {
        [-1, 1].forEach(sd => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 0.7), matte);
          post.position.set(x + px * sd * (W2 - 0.9), 2.6, z + pz * sd * (W2 - 0.9)); scene.add(post);
        });
        const lint = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, (W2 - 0.9) * 2), accMat);
        lint.position.set(x, 5.1, z); lint.rotation.y = Math.atan2(px, pz); scene.add(lint);
      }
    }
  }
  const bz = model.interactables.find(i => i.boss);
  if (bz) {
    const dais = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 9), matStd(theme.wallCol, { roughness: 0.5, metalness: 0.6 }));
    dais.position.set(bz.x, 0.25, bz.z); scene.add(dais);
  }
}

function buildDungeonWorld(scene, model, theme) {
  if (model.biome === 'valley') return buildValley(scene, model, theme);
  if (model.biome === 'canyon') return buildCanyon(scene, model, theme);
  const acc = theme.accent;
  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.FogExp2(theme.bg, theme.fog);
  scene.add(new THREE.AmbientLight(0x2a3344, theme.ambient));
  scene.add(new THREE.HemisphereLight(acc, theme.bg, 0.32));

  const b = model.bounds, pad = 8;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const fw = b.maxX - b.minX + pad * 2, fd = b.maxZ - b.minZ + pad * 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.floorCol, { roughness: 0.95, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);
  const grid = new THREE.GridHelper(Math.max(fw, fd), Math.round(Math.max(fw, fd) / 4), theme.gridCol, theme.gridCol);
  grid.material.transparent = true; grid.material.opacity = 0.42;
  grid.position.set(cx, 0.02, cz); scene.add(grid);
  buildPathTrail(scene, model.path, acc);
  if (theme.ceil) {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), matStd(theme.bg, { roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, 5.4, cz); scene.add(ceil);
  }

  const wallMat = matStd(theme.wallCol, { roughness: 0.85, metalness: 0.12 });
  model.colliders.forEach(wl => {
    const sx = wl.maxX - wl.minX, sz = wl.maxZ - wl.minZ;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 5.6, sz), wallMat);
    m.position.set((wl.minX + wl.maxX) / 2, 2.8, (wl.minZ + wl.maxZ) / 2);
    scene.add(m);
  });

  // ---- theme props (cheap, decorative) ----
  const accMat = new THREE.MeshBasicMaterial({ color: acc });
  const propMatte = matStd(theme.wallCol, { roughness: 0.6, metalness: 0.5 });
  const HD = -(b.minZ + pad); // not used directly; props placed relative to hall
  trailProps(scene, model, theme);
  scatterStructures(scene, model, theme);

  const api = { totems: {}, books: {}, gateGrp: null, creatures: [] };

  buildDungeonNodes(scene, model, theme, api);

  lightScene(scene, model.bounds, { ceil: theme.ceil, dust: theme.accent, glowSize: 4.4, glowOpacity: 0.8, sky: 0xcdbca0 });
  api.worldArt = buildWorldArt(scene, model, model.world);
  return api;
}

function applyDungeonProgress(api, model, save) {
  const d = activeDone(save);
  model.interactables.filter(i => i.kind === 'fight').forEach(it => {
    const t = api.totems[it.id];
    if (!t) return;
    t.beaconMat.color.setHex(d[it.id] ? 0x2ea56a : it.boss ? 0xfacc15 : (model.theme.accent));
    if (t.creature) t.creature.userData.dead = !!d[it.id];
  });
  const lr = save.lessons || {};
  Object.keys(api.books).forEach(lid => {
    api.books[lid].bookMat.color.setHex(lr[lid] ? 0x3a5a66 : model.theme.accent);
  });
  if (api.gateGrp) api.gateGrp.visible = !dungeonGateOpen(save, model);
  if (api.nextGrp) {
    const nx = nextStationOf(model, save);
    if (nx) { api.nextGrp.visible = true; api.nextGrp.position.set(nx.x, 0, nx.z); }
    else api.nextGrp.visible = false;
  }
  applyExplorationProgress(api, save);
  applyFogProgress(api, model, save, dungeonGateOpen(save, model));
}

export {
  buildExplorationProps, applyExplorationProgress, buildFogGate, applyFogProgress,
  buildFabUltra, buildCampusWorld, applyCampusProgress, makeNextBeacon,
  skyDome, cliffRun, valleyMountains, buildPathTrail,
  buildValley, buildCanyon, buildMineWorld, applyMineProgress,
  buildArcadeWorld, buildDungeonNodes, scatterStructures, trailProps,
  buildDungeonWorld, applyDungeonProgress,
};

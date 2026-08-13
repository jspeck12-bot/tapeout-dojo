import * as THREE from "three";
import { mulberry32 } from '../game/content.js';
import { enemyFor } from '../game/rpg.js';
import { activeDone } from '../world/challenges.js';
import { nextStationOf } from '../world/progression.js';
import { mineGateOpen } from '../world/mine.js';
import { dungeonGateOpen } from '../world/dungeon.js';
import { elevationAt, explorationState } from '../world/exploration.js';
import {
  matStd, mineLabelSprite,
} from './primitives.js';
import { fxCone, glowSprite, lightScene } from './cinematic.js';
import {
  rockMaterial, roughen, plinthRock,
  fieldNoteProp,
} from './rock.js';
import { creatureSpec, makeCreature } from './creatures.js';
import { buildWorldArt } from './art-direction.js';
import { buildMineWorldScene } from './mine-world.js';
import {
  buildCampusWorldScene,
  applyCampusUltra,
  applyCampusProgress,
} from './campus-world.js';
import { buildValleyWorldScene } from './valley-world.js';
import { buildFoundryWorldScene } from './foundry-world.js';
import { buildCanyonWorldScene } from './canyon-world.js';
import { buildClockWorldScene } from './clock-world.js';
import { buildFortressWorldScene } from './fortress-world.js';
import { buildTapeoutWorldScene } from './tapeout-world.js';

function buildExplorationProps(scene, model, accent) {
  const built = {};
  for (const zone of model.exploration?.elevationZones || []) {
    const overlook = new THREE.Mesh(
      new THREE.CylinderGeometry(zone.radius, zone.radius, 0.3, 32),
      matStd(0x263242, { roughness: 0.9, metalness: 0.18 }),
    );
    overlook.position.set(zone.x, zone.height - 0.15, zone.z);
    overlook.receiveShadow = true;
    scene.add(overlook);
    const rampLength = zone.radius * 2;
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.22, rampLength),
      matStd(0x334357, { roughness: 0.8, metalness: 0.24 }),
    );
    ramp.rotation.x = Math.atan2(zone.height, rampLength);
    ramp.position.set(zone.x, zone.height / 2, zone.z + zone.radius);
    ramp.receiveShadow = true;
    scene.add(ramp);
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
    group.position.set(feature.x, elevationAt(model, feature.x, feature.z), feature.z);
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

function buildCampusWorld(scene, model) {
  return buildCampusWorldScene(scene, model);
}

function buildFabUltra(scene, model, api) {
  return applyCampusUltra(scene, model, api);
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
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
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
  return buildValleyWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildFoundry(scene, model, theme) {
  return buildFoundryWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildClock(scene, model, theme) {
  return buildClockWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildFortress(scene, model, theme) {
  return buildFortressWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildTapeout(scene, model, theme) {
  return buildTapeoutWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildCanyon(scene, model, theme) {
  return buildCanyonWorldScene(scene, model, theme, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
    buildDungeonNodes,
  });
}

function buildMineWorld(scene, model) {
  return buildMineWorldScene(scene, model, {
    makeNextBeacon,
    buildFogGate,
    buildExplorationProps,
  });
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
    const lt = new THREE.PointLight(it.boss ? 0xfacc15 : acc, it.boss ? 1.1 : 0.82, 16 * (model.worldScale || 1), 1.8);
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
  if (model.world === 3) return buildFoundry(scene, model, theme);
  if (model.world === 5) return buildClock(scene, model, theme);
  if (model.world === 6) return buildFortress(scene, model, theme);
  if (model.world === 7) return buildTapeout(scene, model, theme);
  if (model.biome === 'canyon') return buildCanyon(scene, model, theme);
  const acc = theme.accent;
  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.FogExp2(theme.bg, theme.fog / (model.worldScale || 1));
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
  buildValley, buildFoundry, buildCanyon, buildClock, buildFortress, buildTapeout, buildMineWorld, applyMineProgress,
  buildArcadeWorld, buildDungeonNodes, scatterStructures, trailProps,
  buildDungeonWorld, applyDungeonProgress,
};

import * as THREE from "three";
import { matStd } from './primitives.js';
import { roughen } from './rock.js';

function creatureHash(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const CREATURE_PALETTE = {
  1: 0xF5B14C, 2: 0xA3E635, 3: 0x22D3EE, 4: 0xFB923C, 5: 0xA78BFA, 6: 0xFB7185, 7: 0xFACC15,
};

const WORLD_ARCH = {
  1: { min: 'floater', boss: 'serpent' },  // number systems — imps / the wyrm
  2: { min: 'biped', boss: 'biped' },       // gates — hounds / the golem
  3: { min: 'obelisk', boss: 'obelisk' },   // modules — shades / the hierarch
  4: { min: 'serpent', boss: 'biped' },     // combinational — serpents / the colossus
  5: { min: 'floater', boss: 'obelisk' },   // clock — phantoms / the tyrant
  6: { min: 'floater', boss: 'floater' },   // fsm — wisps / the state engine
  7: { min: 'obelisk', boss: 'obelisk' },   // tapeout — sentinels / silicon prime
};

function creatureSpec(world, name, boss) {
  const w = CREATURE_PALETTE[world] ? world : 1;
  const a = WORLD_ARCH[w];
  const arch = boss ? a.boss : a.min;
  const hsh = creatureHash(name + '|' + w + '|' + (boss ? 'B' : 'm'));
  const accent = CREATURE_PALETTE[w];
  const sc = boss ? 1.9 : (0.85 + (hsh % 40) / 100); // minion 0.85..1.24
  const segs = arch === 'serpent' ? (boss ? 9 : 4 + (hsh % 3)) : 0;
  const shards = arch === 'floater' ? (boss ? 5 : 1 + (hsh % 3)) : 0;
  const rings = arch === 'obelisk' ? (boss ? 3 : 1) : 0;
  return { world: w, arch, boss: !!boss, accent, sc, segs, shards, rings, seed: hsh };
}

function makeWyrmBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent;
  const skin = matStd(0x16110f, { roughness: 0.86, metalness: 0.26 });
  const scaleMat = matStd(0x2a1d12, { roughness: 0.7, metalness: 0.34 });
  const teeth = matStd(0xd8cbb0, { roughness: 0.45, metalness: 0.08 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });

  const N = 24;
  const segGroup = new THREE.Group(); g.add(segGroup);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const r = (1.35 * (1 - u) + 0.28);                 // thick neck -> thin tail
    const m = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(r, 1), r * 0.16, 700 + i), i % 4 === 0 ? scaleMat : skin);
    m.scale.z = 1.25;
    m.castShadow = true; segGroup.add(m);
    if (i > 1 && i % 2 === 0) {                          // dorsal spikes
      const sp = new THREE.Mesh(roughen(new THREE.ConeGeometry(r * 0.42, r * 1.5, 5), r * 0.08, 760 + i), scaleMat);
      sp.position.y = r * 0.95; sp.rotation.x = -0.15; m.add(sp);
    }
    segs.push({ m, u, r });
  }

  // ---- head ----
  const head = new THREE.Group(); g.add(head);
  const skull = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1.5, 1), 0.2, 901), skin);
  skull.scale.set(0.95, 0.82, 1.5); head.add(skull);                 // long snout
  const tR = 0.16, tH = 0.7;
  for (let k = 0; k < 9; k++) {                                       // upper fangs
    const a = (k / 8 - 0.5) * 2.4;
    const up = new THREE.Mesh(new THREE.ConeGeometry(tR, tH, 5), teeth);
    up.position.set(Math.sin(a) * 0.95, -0.5, 1.55 + Math.cos(a) * 0.5); up.rotation.x = Math.PI; head.add(up);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.55, 0.2); head.add(jaw);
  const jawMesh = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1.15, 1), 0.16, 902), skin);
  jawMesh.scale.set(0.82, 0.5, 1.35); jawMesh.position.set(0, -0.1, 0.55); jaw.add(jawMesh);
  for (let k = 0; k < 9; k++) {                                       // lower fangs
    const a = (k / 8 - 0.5) * 2.4;
    const lo = new THREE.Mesh(new THREE.ConeGeometry(tR, tH, 5), teeth);
    lo.position.set(Math.sin(a) * 0.85, 0.15, 1.35 + Math.cos(a) * 0.45); jaw.add(lo);
  }
  [-1, 1].forEach(s => {                                              // swept horns
    const h1 = new THREE.Mesh(roughen(new THREE.ConeGeometry(0.32, 2.1, 6), 0.06, 910 + s), teeth);
    h1.position.set(s * 0.7, 0.95, -0.3); h1.rotation.set(-0.8, 0, s * 0.35); head.add(h1);
    const h2 = new THREE.Mesh(roughen(new THREE.ConeGeometry(0.22, 1.3, 6), 0.05, 920 + s), teeth);
    h2.position.set(s * 1.05, 0.45, 0.2); h2.rotation.set(-0.2, 0, s * 0.9); head.add(h2);
  });
  [-1, 1].forEach(s => {                                              // eyes + brow ridges
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), core);
    eye.position.set(s * 0.62, 0.32, 0.95); head.add(eye);
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), skin);
    brow.position.set(s * 0.62, 0.66, 0.85); brow.rotation.set(-1.45, 0, s * 0.2); head.add(brow);
  });
  const maw = new THREE.PointLight(P, 1.4, 11, 2.0); maw.position.set(0, -0.15, 1.0); head.add(maw);
  const mawCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), core); mawCore.position.set(0, -0.2, 0.7); mawCore.scale.set(0.7, 0.5, 0.7); head.add(mawCore);

  g.scale.set(1.5, 1.5, 1.5);   // fill the tall arena
  g.userData = { wyrm: true, segs, head, jaw, core, phase: (spec.seed % 628) / 100, dead: false, N, span: 11, headHeight: 5.4, sc: spec.sc };
  return g;
}

function updateWyrm(group, t, opts) {
  const u = group.userData;
  if (!u || !u.wyrm) return;
  const dt = (opts && opts.dt) || 0.016;
  if (opts && opts.dist != null) {
    const want = Math.atan2(opts.dx, opts.dz);
    let cur = group.rotation.y, d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    group.rotation.y = cur + d * Math.min(1, dt * 1.6);
  }
  const dead = u.dead;
  const aggro = !dead && opts && opts.dist != null && opts.dist < 14;
  u.phase += dt * (aggro ? 1.7 : 1.0) * (1 + ((u.enrage || 1) - 1) * 0.4);
  const ph = u.phase, H = dead ? 0.7 : u.headHeight, span = u.span;
  for (let i = 0; i < u.segs.length; i++) {
    const s = u.segs[i], p = s.u;
    const rear = H * Math.pow(Math.max(0, 1 - p * 1.7), 1.7);
    const ripple = dead ? 0 : Math.sin(p * 5.2 - ph * 2.4) * (0.3 + p * 0.8);
    const sway = dead ? Math.sin(p * 3) * 0.6 : Math.sin(p * 3.8 - ph * 2.1) * (0.5 + p * 2.4);
    s.m.position.set(sway, Math.max(s.r * 0.45, rear + ripple), -p * span - (dead ? 0 : Math.sin(p * 2.6 - ph * 1.6) * 0.4));
    s.m.rotation.y = Math.cos(p * 3.8 - ph * 2.1) * 0.35;
    s.m.rotation.z = Math.sin(p * 4 - ph * 2.2) * 0.18;
  }
  const h0 = u.segs[0].m.position;
  u.head.position.set(h0.x * 0.6, h0.y + 0.5, h0.z + 1.6);
  u.head.rotation.x = -0.4 + Math.sin(ph * 1.3) * 0.08 + (aggro ? -0.18 : 0);
  u.head.rotation.y = Math.sin(ph * 0.9) * 0.12;
  u.head.rotation.z = Math.sin(ph * 1.05) * 0.06;
  u.jaw.rotation.x = dead ? 0.05 : (aggro ? 0.4 + Math.abs(Math.sin(ph * 3.6)) * 0.6 : 0.14 + Math.abs(Math.sin(ph * 1.2)) * 0.13);
  if (dead) group.rotation.z = Math.min(1.1, (group.rotation.z || 0) + dt * 0.7);
  else group.rotation.z += (0 - group.rotation.z) * Math.min(1, dt * 3);
}

function _bossMk(par, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; }

function makeBipedBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7, colossus = spec.world === 4;
  const skin = matStd(0x0d1118, { roughness: 0.85, metalness: 0.42 });
  const plate = matStd(0x161d28, { roughness: 0.58, metalness: 0.56 });
  const acc = matStd(P, { roughness: 0.4, metalness: 0.5, emissive: P, emissiveIntensity: 0.4 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk;
  // legs + feet (wide, heavy)
  [-1, 1].forEach(s => {
    mk(g, roughen(new THREE.CylinderGeometry(0.4 * sc, 0.54 * sc, 1.95 * sc, 8), 0.08 * sc, sd + s + 1), plate, s * 0.64 * sc, 0.98 * sc, 0);
    mk(g, roughen(new THREE.BoxGeometry(0.74 * sc, 0.42 * sc, 1.05 * sc), 0.06 * sc, sd + s + 5), plate, s * 0.64 * sc, 0.2 * sc, 0.16 * sc);
  });
  // torso
  const torso = mk(body, roughen(new THREE.DodecahedronGeometry(1.5 * sc, 0), 0.2 * sc, sd + 11), plate, 0, 2.95 * sc, 0);
  torso.scale.set(1.18, 1.3, 0.95);
  mk(body, new THREE.IcosahedronGeometry(0.52 * sc, 0), core, 0, 3.0 * sc, 0.88 * sc); // chest core
  const halo = new THREE.PointLight(P, 1.3, 9 * sc, 2); halo.position.set(0, 3.0 * sc, 0.88 * sc); body.add(halo);
  // shoulders + pauldron spikes
  [-1, 1].forEach(s => {
    mk(body, roughen(new THREE.IcosahedronGeometry(0.72 * sc, 0), 0.14 * sc, sd + 20 + s), plate, s * 1.55 * sc, 3.75 * sc, 0);
    const sp = mk(body, new THREE.ConeGeometry(0.26 * sc, 1.0 * sc, 5), acc, s * 1.68 * sc, 4.25 * sc, 0); sp.rotation.z = s * 0.5;
  });
  // arms + fists (colossus: a second, lower pair)
  (colossus ? [{ y: 3.45, len: 2.1 }, { y: 2.5, len: 1.8 }] : [{ y: 3.45, len: 2.1 }]).forEach(ap => [-1, 1].forEach(s => {
    const arm = mk(body, roughen(new THREE.CylinderGeometry(0.27 * sc, 0.36 * sc, ap.len * sc, 7), 0.06 * sc, sd + 30 + s + Math.round(ap.y)), skin, s * 1.78 * sc, ap.y * sc, 0); arm.rotation.z = s * 0.16;
    mk(body, roughen(new THREE.BoxGeometry(0.64 * sc, 0.64 * sc, 0.64 * sc), 0.08 * sc, sd + 40 + s + Math.round(ap.y)), plate, s * 2.05 * sc, (ap.y - ap.len * 0.55) * sc, 0);
  }));
  // head + eye visor
  const head = mk(body, roughen(new THREE.IcosahedronGeometry(0.62 * sc, 1), 0.1 * sc, sd + 50), plate, 0, 4.2 * sc, 0.05 * sc);
  head.scale.set(0.92, 1.0, 1.05);
  for (let k = -1; k <= 1; k++) mk(body, new THREE.BoxGeometry(0.17 * sc, 0.1 * sc, 0.08 * sc), core, k * 0.23 * sc, 4.24 * sc, 0.52 * sc);
  if (colossus) { [-1, 1].forEach(s => { const h = mk(body, new THREE.ConeGeometry(0.18 * sc, 1.15 * sc, 6), plate, s * 0.42 * sc, 4.78 * sc, 0); h.rotation.set(-0.3, 0, s * 0.42); }); }
  else { mk(body, roughen(new THREE.BoxGeometry(1.05 * sc, 0.42 * sc, 0.95 * sc), 0.1 * sc, sd + 60), plate, 0, 4.78 * sc, 0); }
  body.userData.bobY = 0.05 * sc;
  g.userData = { body, core, anim: { arch: 'biped', head }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeObeliskBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7, W = spec.world;
  const stone = matStd(0x10141d, { roughness: 0.7, metalness: 0.5 });
  const acc = matStd(P, { roughness: 0.35, metalness: 0.55, emissive: P, emissiveIntensity: 0.45 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk;
  const trunk = mk(body, roughen(new THREE.CylinderGeometry(0.72 * sc, 1.15 * sc, 5.0 * sc, 6), 0.12 * sc, sd + 1), stone, 0, 2.7 * sc, 0);
  trunk.rotation.y = 0.4;
  mk(body, new THREE.BoxGeometry(0.2 * sc, 3.3 * sc, 0.2 * sc), core, 0, 2.8 * sc, 0.98 * sc); // core seam
  mk(body, new THREE.IcosahedronGeometry(0.56 * sc, 0), core, 0, 3.1 * sc, 0);
  const halo = new THREE.PointLight(P, 1.4, 12 * sc, 2); halo.position.set(0, 3.1 * sc, 0); body.add(halo);
  const ringHolder = new THREE.Group(); ringHolder.position.set(0, 3.1 * sc, 0); body.add(ringHolder);
  const rl = [];
  for (let i = 0; i < 3; i++) { const tr = new THREE.Mesh(new THREE.TorusGeometry((1.45 + 0.55 * i) * sc, 0.08 * sc, 8, 30), acc); tr.rotation.x = Math.PI / 2 + i * 0.5; ringHolder.add(tr); rl.push(tr); }
  mk(body, roughen(new THREE.ConeGeometry(0.72 * sc, 1.5 * sc, 6), 0.1 * sc, sd + 9), acc, 0, 5.5 * sc, 0); // apex
  if (W === 3) { // hierarch — orbiting module-blocks
    for (let i = 0; i < 3; i++) mk(ringHolder, roughen(new THREE.BoxGeometry(0.52 * sc, 0.52 * sc, 0.52 * sc), 0.06 * sc, sd + 20 + i), stone, Math.cos(i * 2.1) * 1.95 * sc, 0, Math.sin(i * 2.1) * 1.95 * sc);
  } else if (W === 5) { // tyrant — clock face + hands
    const face = mk(body, new THREE.CylinderGeometry(1.15 * sc, 1.15 * sc, 0.14 * sc, 24), stone, 0, 4.0 * sc, 0.9 * sc); face.rotation.x = Math.PI / 2;
    mk(body, new THREE.IcosahedronGeometry(0.13 * sc, 0), core, 0, 4.0 * sc, 1.0 * sc);
    const hh = mk(body, new THREE.BoxGeometry(0.09 * sc, 0.72 * sc, 0.05 * sc), acc, 0, 4.3 * sc, 1.0 * sc);
    const mh = mk(body, new THREE.BoxGeometry(0.07 * sc, 1.0 * sc, 0.05 * sc), acc, 0.4 * sc, 4.1 * sc, 1.0 * sc); mh.rotation.z = 1.15;
  } else if (W === 7) { // silicon prime — chip-die crown with traces
    mk(body, new THREE.BoxGeometry(1.85 * sc, 0.2 * sc, 1.85 * sc), stone, 0, 5.7 * sc, 0);
    for (let i = -1; i <= 1; i++) { mk(body, new THREE.BoxGeometry(1.6 * sc, 0.06 * sc, 0.08 * sc), core, 0, 5.82 * sc, i * 0.52 * sc); mk(body, new THREE.BoxGeometry(0.08 * sc, 0.06 * sc, 1.6 * sc), core, i * 0.52 * sc, 5.82 * sc, 0); }
  }
  body.userData.bobY = 0.05 * sc;
  g.userData = { body, core, anim: { arch: 'obelisk', rings: rl, ringHolder }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeFloaterBoss(spec, coreMat) {
  const g = new THREE.Group();
  const P = spec.accent, sc = spec.sc, sd = (spec.seed >>> 0) || 7;
  const shell = matStd(0x0e131c, { roughness: 0.6, metalness: 0.55 });
  const acc = matStd(P, { roughness: 0.35, metalness: 0.5, emissive: P, emissiveIntensity: 0.5 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const body = new THREE.Group(); g.add(body);
  const mk = _bossMk, cy = 2.05 * sc;
  mk(body, new THREE.IcosahedronGeometry(0.98 * sc, 1), core, 0, cy, 0); // brain core
  const halo = new THREE.PointLight(P, 1.6, 13 * sc, 2); halo.position.set(0, cy, 0); body.add(halo);
  const s1 = mk(body, roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.18 * sc, sd + 1), shell, 0, cy + 0.72 * sc, 0); s1.scale.set(1, 0.55, 1);
  const s2 = mk(body, roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.18 * sc, sd + 2), shell, 0, cy - 0.72 * sc, 0); s2.scale.set(1, 0.55, 1);
  const ring = new THREE.Group(); ring.position.set(0, cy, 0); body.add(ring);
  const sl = []; const Nn = 6;
  for (let i = 0; i < Nn; i++) { const ang = i / Nn * Math.PI * 2; sl.push(mk(ring, roughen(new THREE.OctahedronGeometry(0.42 * sc, 0), 0.06 * sc, sd + 10 + i), acc, Math.cos(ang) * 2.35 * sc, Math.sin(i * 1.7) * 0.4 * sc, Math.sin(ang) * 2.35 * sc)); }
  body.userData.bobY = 0.18 * sc;
  g.userData = { body, core, anim: { arch: 'floater', ring, shards: sl, float: true }, phase: (spec.seed % 628) / 100, dead: false, sc, boss: true };
  return g;
}

function makeCreature(spec, coreMat) {
  if (spec.boss && spec.arch === 'serpent') return makeWyrmBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'biped') return makeBipedBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'obelisk') return makeObeliskBoss(spec, coreMat);
  if (spec.boss && spec.arch === 'floater') return makeFloaterBoss(spec, coreMat);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const P = spec.accent;
  const sc = spec.sc;
  const matBody = matStd(0x0c1016, { roughness: 0.82, metalness: 0.32 });
  const matAcc = matStd(P, { roughness: 0.45, metalness: 0.5, emissive: P, emissiveIntensity: 0.32 });
  const core = coreMat || new THREE.MeshBasicMaterial({ color: P });
  const anim = { arch: spec.arch };
  let _si = (spec.seed >>> 0) || 11;
  const rg = (geo, amt) => { _si = (_si * 1664525 + 1013904223) >>> 0; return roughen(geo, amt, _si); };

  const mesh = (parent, geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  if (spec.arch === 'biped') {
    mesh(g, rg(new THREE.CylinderGeometry(0.26 * sc, 0.3 * sc, 1.35 * sc, 7), 0.06 * sc), matBody, -0.42 * sc, 0.68 * sc, 0);
    mesh(g, rg(new THREE.CylinderGeometry(0.26 * sc, 0.3 * sc, 1.35 * sc, 7), 0.06 * sc), matBody, 0.42 * sc, 0.68 * sc, 0);
    const torso = mesh(body, rg(new THREE.DodecahedronGeometry(0.95 * sc, 0), 0.16 * sc), matBody, 0, 2.05 * sc, 0);
    torso.scale.set(0.92, 1.25, 0.78);
    mesh(body, rg(new THREE.CylinderGeometry(0.2 * sc, 0.24 * sc, 1.5 * sc, 6), 0.06 * sc), matBody, -1.0 * sc, 2.1 * sc, 0);
    mesh(body, rg(new THREE.CylinderGeometry(0.2 * sc, 0.24 * sc, 1.5 * sc, 6), 0.06 * sc), matBody, 1.0 * sc, 2.1 * sc, 0);
    const head = mesh(body, rg(new THREE.IcosahedronGeometry(0.55 * sc, 1), 0.1 * sc), matBody, 0, 3.25 * sc, 0);
    mesh(body, new THREE.IcosahedronGeometry(0.16 * sc, 0), core, -0.18 * sc, 3.28 * sc, 0.42 * sc);
    mesh(body, new THREE.IcosahedronGeometry(0.16 * sc, 0), core, 0.18 * sc, 3.28 * sc, 0.42 * sc);
    mesh(body, new THREE.OctahedronGeometry(0.32 * sc, 0), core, 0, 2.2 * sc, 0.5 * sc);
    anim.head = head;
    body.userData.bobY = 0.06 * sc;
  } else if (spec.arch === 'serpent') {
    const seglist = [];
    for (let i = 0; i < spec.segs; i++) {
      const r = Math.max(0.18, (0.64 - 0.036 * i) * sc);
      const yy = (1.0 + Math.sin(i * 0.6) * 0.5) * sc;
      const zz = (-i * 0.92) * sc;
      const s = mesh(body, rg(new THREE.IcosahedronGeometry(r, 1), r * 0.28), i === 0 ? matAcc : matBody, 0, yy, zz);
      seglist.push({ m: s, y0: yy, i });
    }
    const head = mesh(body, rg(new THREE.ConeGeometry(0.52 * sc, 1.05 * sc, 7), 0.07 * sc), matBody, 0, 1.05 * sc, 0.85 * sc);
    head.rotation.x = Math.PI / 2;
    mesh(body, new THREE.IcosahedronGeometry(0.18 * sc, 0), core, 0.2 * sc, 1.18 * sc, 1.05 * sc);
    mesh(body, new THREE.IcosahedronGeometry(0.18 * sc, 0), core, -0.2 * sc, 1.18 * sc, 1.05 * sc);
    anim.segs = seglist; anim.head = head;
    body.userData.bobY = 0.05 * sc;
  } else if (spec.arch === 'floater') {
    const bodyMesh = mesh(body, rg(new THREE.IcosahedronGeometry(0.82 * sc, 1), 0.16 * sc), matBody, 0, 1.5 * sc, 0);
    mesh(body, new THREE.IcosahedronGeometry(0.3 * sc, 0), core, 0, 1.55 * sc, 0.72 * sc);
    const ring = new THREE.Group(); ring.position.set(0, 1.5 * sc, 0); body.add(ring);
    const sl = [];
    for (let i = 0; i < spec.shards; i++) {
      const ang = i / Math.max(1, spec.shards) * Math.PI * 2;
      sl.push(mesh(ring, rg(new THREE.OctahedronGeometry(0.3 * sc, 0), 0.05 * sc), matAcc, Math.cos(ang) * 1.4 * sc, 0, Math.sin(ang) * 1.4 * sc));
    }
    anim.ring = ring; anim.shards = sl; anim.bodyMesh = bodyMesh; anim.float = true;
    body.userData.bobY = 0.16 * sc;
  } else { // obelisk
    const trunk = mesh(body, rg(new THREE.OctahedronGeometry(0.92 * sc, 1), 0.12 * sc), matBody, 0, 1.5 * sc, 0);
    trunk.scale.y = 2.2;
    mesh(body, new THREE.IcosahedronGeometry(0.3 * sc, 0), core, 0, 2.0 * sc, 0.55 * sc);
    mesh(body, rg(new THREE.ConeGeometry(0.55 * sc, 0.9 * sc, 5), 0.08 * sc), matAcc, 0, 3.5 * sc, 0);
    const ringHolder = new THREE.Group(); ringHolder.position.set(0, 2.0 * sc, 0); body.add(ringHolder);
    const rl = [];
    for (let i = 0; i < spec.rings; i++) {
      const tr = new THREE.Mesh(new THREE.TorusGeometry((1.0 + 0.5 * i) * sc, 0.06 * sc, 8, 28), matAcc);
      tr.rotation.x = Math.PI / 2 + i * 0.4;
      ringHolder.add(tr); rl.push(tr);
    }
    anim.rings = rl; anim.ringHolder = ringHolder;
    body.userData.bobY = 0.07 * sc;
  }

  g.userData = { body, core, anim, phase: (spec.seed % 628) / 100, dead: false, sc, boss: spec.boss };
  return g;
}

function updateCreature(group, t, opts) {
  if (group.userData && group.userData.wyrm) { updateWyrm(group, t, opts); return; }
  const u = group.userData;
  if (!u || !u.body) return;
  const body = u.body, a = u.anim;
  const dt = (opts && opts.dt) || 0.016;

  if (opts && opts.dist != null && opts.dist < 16) {
    const want = Math.atan2(opts.dx, opts.dz);
    let cur = group.rotation.y, d = want - cur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    group.rotation.y = cur + d * Math.min(1, dt * 3);
  }

  if (u.dead) {
    body.rotation.x += (0.7 - body.rotation.x) * Math.min(1, dt * 4);
    body.position.y += (-0.5 * u.sc - body.position.y) * Math.min(1, dt * 4);
    return;
  }

  const ph = u.phase;
  const by = body.userData.bobY || 0.06;
  const aggro = opts && opts.dist != null && opts.dist < 10;
  const sp = (aggro ? 1.8 : 1) * (1 + ((u.enrage || 1) - 1) * 0.4);
  body.position.y = Math.sin(t * 1.6 * sp + ph) * by;
  body.rotation.z = Math.sin(t * 1.05 * sp + ph) * 0.04;
  body.rotation.x += ((aggro ? 0.16 : 0) - body.rotation.x) * Math.min(1, dt * 4);
  if (u.hitT) { const _k = Math.max(0, 1 - (t - u.hitT) / 0.3); if (_k > 0) { body.rotation.x -= _k * 0.5; body.position.y -= _k * 0.3 * u.sc; } }
  if (a.float) body.position.y += 0.12 * u.sc + Math.sin(t * 0.9 + ph) * 0.06 * u.sc;
  if (a.ring) a.ring.rotation.y += dt * (aggro ? 1.6 : 0.7);
  if (a.shards) for (let i = 0; i < a.shards.length; i++) { a.shards[i].rotation.x += dt * 1.2; a.shards[i].rotation.y += dt * 0.9; }
  if (a.ringHolder) a.ringHolder.rotation.y += dt * (aggro ? 1.2 : 0.5);
  if (a.segs) for (let i = 0; i < a.segs.length; i++) { const s = a.segs[i]; s.m.position.y = s.y0 + Math.sin(t * 2.2 * sp + s.i * 0.5 + ph) * 0.12 * u.sc; }
  if (a.head) a.head.rotation.z = Math.sin(t * 1.3 * sp + ph) * 0.08;
}

function makeViewModel(weaponId) {
  const g = new THREE.Group();
  const T = ({
    w_iron:   { shaft: 0x9aa0a8, glow: 0x223040, gi: 0.0,  len: 0.60, prongs: 0, hook: false },
    w_copper: { shaft: 0xc8823c, glow: 0xffae5c, gi: 0.20, len: 0.64, prongs: 0, hook: false },
    w_lance:  { shaft: 0xc2cad6, glow: 0x9ee6ff, gi: 0.24, len: 0.72, prongs: 0, hook: true  },
    w_kelvin: { shaft: 0xe6eff6, glow: 0x7defff, gi: 0.55, len: 0.78, prongs: 4, hook: false },
  })[weaponId] || { shaft: 0x9aa0a8, glow: 0x223040, gi: 0.0, len: 0.60, prongs: 0, hook: false };
  const metal = matStd(T.shaft, { roughness: 0.3, metalness: 0.86, emissive: T.glow, emissiveIntensity: T.gi });
  const grip = matStd(0x14181f, { roughness: 0.72, metalness: 0.5 });
  const tipMat = matStd(T.shaft, { roughness: 0.18, metalness: 0.92, emissive: T.glow, emissiveIntensity: Math.max(0.3, T.gi) });
  const mk = (geo, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); m.castShadow = false; g.add(m); return m; };
  const tipZ = 0.05 - T.len;
  mk(new THREE.CylinderGeometry(0.05, 0.058, 0.26, 8), grip, 0, 0, 0.18, Math.PI / 2, 0);          // grip (near camera)
  mk(new THREE.CylinderGeometry(0.022, 0.032, T.len, 7), metal, 0, 0, 0.05 - T.len / 2, Math.PI / 2, 0); // shaft
  if (T.prongs > 0) {
    for (let i = 0; i < T.prongs; i++) { const a = i / T.prongs * Math.PI * 2; mk(new THREE.ConeGeometry(0.012, 0.16, 5), tipMat, Math.cos(a) * 0.034, Math.sin(a) * 0.034, tipZ - 0.05, -Math.PI / 2, 0); }
    const o = new THREE.PointLight(T.glow, 0.7, 2.4, 2); o.position.set(0, 0, tipZ - 0.08); g.add(o);
  } else {
    mk(new THREE.ConeGeometry(0.032, 0.17, 6), tipMat, 0, 0, tipZ - 0.04, -Math.PI / 2, 0);          // tip
  }
  if (T.hook) mk(new THREE.TorusGeometry(0.05, 0.012, 6, 10), metal, 0, 0.052, tipZ + 0.16, 0, 0);    // salvage hook (lance)
  g.position.set(0.34, -0.30, -0.42);
  g.rotation.set(0.26, 0.5, 0.12);
  g.userData = { weaponId, bx: 0.34, by: -0.30, bz: -0.42, rx: 0.26, rz: 0.12 };
  return g;
}

function updateViewModel(vm, now, moving, jabT) {
  const u = vm.userData; if (!u) return;
  const jk = Math.max(0, 1 - (now - jabT) / 240);
  const bobk = moving ? 1 : 0.35;
  vm.position.x = u.bx + Math.sin(now / 540) * 0.010 * bobk;
  vm.position.y = u.by + Math.sin(now / 300) * 0.013 * bobk - jk * 0.05;
  vm.position.z = u.bz - jk * 0.22;
  vm.rotation.x = u.rx - jk * 0.6;
  vm.rotation.z = u.rz + Math.sin(now / 820) * 0.02 * bobk;
}

export {
  creatureHash, CREATURE_PALETTE, WORLD_ARCH, creatureSpec,
  makeCreature, updateCreature, makeViewModel, updateViewModel,
};

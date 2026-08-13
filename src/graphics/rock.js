import * as THREE from "three";

function caveTextures() {
  if (caveTextures._c) return caveTextures._c;
  const N = 256;
  function tile(freq, seed) {
    const grid = new Float32Array(freq * freq);
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const out = new Float32Array(N * N);
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * freq, fy = y / N * freq;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy);
      const x0 = ix % freq, y0 = iy % freq, x1 = (ix + 1) % freq, y1 = (iy + 1) % freq;
      const v00 = grid[y0 * freq + x0], v10 = grid[y0 * freq + x1], v01 = grid[y1 * freq + x0], v11 = grid[y1 * freq + x1];
      const a = v00 + (v10 - v00) * tx, bb = v01 + (v11 - v01) * tx;
      out[y * N + x] = a + (bb - a) * ty;
    }
    return out;
  }
  const H = new Float32Array(N * N);
  const layers = [[4, 1.0, 11], [8, 0.5, 23], [16, 0.27, 47], [32, 0.14, 91], [64, 0.08, 131]];
  let amp = 0; layers.forEach(l => amp += l[1]);
  layers.forEach(([f, a, sd]) => { const t = tile(f, sd); for (let i = 0; i < H.length; i++) H[i] += t[i] * a; });
  for (let i = 0; i < H.length; i++) { let v = H[i] / amp; H[i] = Math.min(1, Math.max(0, (v - 0.5) * 1.4 + 0.5)); }
  const M = tile(6, 271), crevN = tile(11, 313);
  function mk(drawer, sRGB) {
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(N, N); drawer(img.data); ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.userData = { ...(t.userData || {}), shared: true };
    return t;
  }
  const crev = [44, 33, 21], mid = [96, 79, 52], ridge = [158, 134, 88];
  const colorMap = mk(d => {
    for (let i = 0; i < N * N; i++) {
      const h = H[i];
      const dark = 1 - Math.min(0.7, (1 - crevN[i]) * 1.3);
      const mot = 0.82 + M[i] * 0.42;
      let r, g, b2;
      if (h < 0.5) { const t = h / 0.5; r = crev[0] + (mid[0] - crev[0]) * t; g = crev[1] + (mid[1] - crev[1]) * t; b2 = crev[2] + (mid[2] - crev[2]) * t; }
      else { const t = (h - 0.5) / 0.5; r = mid[0] + (ridge[0] - mid[0]) * t; g = mid[1] + (ridge[1] - mid[1]) * t; b2 = mid[2] + (ridge[2] - mid[2]) * t; }
      const o = i * 4; d[o] = Math.min(255, r * mot * dark); d[o + 1] = Math.min(255, g * mot * dark); d[o + 2] = Math.min(255, b2 * mot * dark); d[o + 3] = 255;
    }
  }, true);
  const roughMap = mk(d => { for (let i = 0; i < N * N; i++) { const r = Math.max(0, Math.min(255, 255 * (0.97 - H[i] * 0.3))); const o = i * 4; d[o] = d[o + 1] = d[o + 2] = r; d[o + 3] = 255; } }, false);
  const NS = 2.4;
  const normalMap = mk(d => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const xl = H[y * N + ((x - 1 + N) % N)], xr = H[y * N + ((x + 1) % N)];
      const yt = H[((y - 1 + N) % N) * N + x], yb = H[((y + 1) % N) * N + x];
      let nx = (xl - xr) * NS, ny = (yt - yb) * NS, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const o = (y * N + x) * 4; d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }, false);
  const dispMap = mk(d => { for (let i = 0; i < N * N; i++) { const v = H[i] * 255; const o = i * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; } }, false);
  caveTextures._c = { map: colorMap, normalMap, roughnessMap: roughMap, displacementMap: dispMap };
  return caveTextures._c;
}

function rockMaterial(o) {
  o = o || {};
  const t = caveTextures();
  const rep = o.repeat || [2, 2];
  const R = (tex) => { const c = tex.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rep[0], rep[1]); return c; };
  const m = new THREE.MeshStandardMaterial({
    map: R(t.map), normalMap: R(t.normalMap), roughnessMap: R(t.roughnessMap),
    roughness: 1, metalness: 0, color: o.tint == null ? 0xffffff : o.tint,
    normalScale: new THREE.Vector2(o.normal == null ? 1.3 : o.normal, o.normal == null ? 1.3 : o.normal),
  });
  if (o.disp) { m.displacementMap = R(t.displacementMap); m.displacementScale = o.disp; m.displacementBias = o.dispBias == null ? -o.disp * 0.5 : o.dispBias; }
  return m;
}

function caveDressing(scene, model) {
  const matBoulder = rockMaterial({ repeat: [1.3, 1.3], normal: 1.1 });
  const matSpire = rockMaterial({ repeat: [1, 2], normal: 1.0, tint: 0xc9bba0 });
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const irregular = (g, a) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (rnd() - 0.5) * a; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } p.needsUpdate = true; g.computeVertexNormals(); return g; };
  // overhead stalactites along the shaft (clip-free)
  for (let z = 56; z > -52; z -= 4 + rnd() * 5) {
    const h = 0.9 + rnd() * 2.0;
    const m = new THREE.Mesh(irregular(new THREE.ConeGeometry(0.28 + rnd() * 0.34, h, 7, 2), 0.4), matSpire);
    m.position.set((rnd() - 0.5) * 6.2, 5.15 - h / 2, z);
    m.rotation.set(Math.PI + (rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.3);
    m.castShadow = true; scene.add(m);
  }
  // rocks bulging from the shaft walls (just past the walkable band, clip-free)
  for (let z = 57; z > -52; z -= 3.5 + rnd() * 4) {
    const side = (z | 0) % 2 ? -1 : 1, sx = 4.9 + rnd() * 0.5;
    if (rnd() < 0.6) {
      const r = 0.55 + rnd() * 0.8;
      const m = new THREE.Mesh(irregular(new THREE.IcosahedronGeometry(r, 1), 0.6), matBoulder);
      m.position.set(side * sx, r * 0.7, z); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      m.castShadow = m.receiveShadow = true; scene.add(m);
    } else {
      const h = 1.0 + rnd() * 2.0;
      const m = new THREE.Mesh(irregular(new THREE.ConeGeometry(0.3 + rnd() * 0.4, h, 7, 2), 0.4), matSpire);
      m.position.set(side * sx, h / 2, z); m.rotation.set((rnd() - 0.5) * 0.2, rnd() * 6, (rnd() - 0.5) * 0.2);
      m.castShadow = true; scene.add(m);
    }
  }
  // floor pebbles (tiny, clip-negligible)
  for (let i = 0; i < 55; i++) {
    const r = 0.12 + rnd() * 0.26;
    const m = new THREE.Mesh(irregular(new THREE.IcosahedronGeometry(r, 0), 0.7), matBoulder);
    m.position.set((rnd() - 0.5) * 7, r * 0.5, 70 - rnd() * 128); m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    m.receiveShadow = true; scene.add(m);
  }
}

function rockNoise(x, y, z) {
  return (
    0.5 * Math.sin(x * 0.45 + z * 0.33) +
    0.32 * Math.cos(z * 0.8 - y * 0.5) +
    0.22 * Math.sin(x * 0.9 + y * 0.4 + 1.7) +
    0.16 * Math.sin(z * 1.5 + x * 1.2 + 4.2) +
    0.1 * Math.cos(x * 2.1 - z * 1.8 + 2.1)
  );
}

function rockWall(sx, sy, sz, mat, cx, cz) {
  const segX = Math.max(2, Math.min(16, Math.round(sx / 2.5)));
  const segZ = Math.max(2, Math.min(16, Math.round(sz / 2.5)));
  const geo = new THREE.BoxGeometry(sx, sy, sz, segX, 8, segZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const wx = cx + vx, wy = sy / 2 + vy, wz = cz + vz;
    const top = Math.min(1, Math.max(0, (vy + sy / 2) / sy)); // 0 base -> 1 top
    const baseW = 0.35 + 0.65 * top;
    const dx = Math.max(-0.42, Math.min(0.42, rockNoise(wx, wy, wz) * 0.5)) * baseW;
    const dz = Math.max(-0.42, Math.min(0.42, rockNoise(wz + 50, wy, wx + 50) * 0.5)) * baseW;
    const dy = rockNoise(wx + 13, wz + 13, wy) * 0.85 * (0.3 + 0.7 * top);
    p.setXYZ(i, vx + dx, vy + dy, vz + dz);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function roughen(geo, amt, seed) {
  const p = geo.attributes.position;
  const S = (seed >>> 0) || 1;
  // Hash the vertex POSITION (not its index): primitives are non-indexed, so a
  // shared corner appears once per touching face. Offsetting by position means
  // those duplicates get the SAME offset and the surface stays welded (lumpy
  // rock) instead of tearing into disconnected shards.
  const off = (a, b, c, salt) => {
    let n = (S ^ salt) >>> 0;
    n = Math.imul(n ^ (Math.round(a * 16) | 0), 2654435761) >>> 0;
    n = Math.imul(n ^ (Math.round(b * 16) | 0), 2246822519) >>> 0;
    n = Math.imul(n ^ (Math.round(c * 16) | 0), 3266489917) >>> 0;
    n ^= n >>> 13; n = Math.imul(n, 3266489917) >>> 0; n ^= n >>> 16;
    return (n / 4294967295 - 0.5) * amt;
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + off(x, y, z, 1), y + off(x, y, z, 2), z + off(x, y, z, 3));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function plinthRock(scene, x, z, sc) {
  const mat = rockMaterial({ repeat: [2, 2], normal: 1.2, tint: 0x6a6256 });
  const g = roughen(new THREE.IcosahedronGeometry(1.55 * sc, 1), 0.4 * sc, ((x * 7 + z * 13) >>> 0) || 5);
  const m = new THREE.Mesh(g, mat);
  m.scale.y = 0.42; m.position.set(x, 0.3, z); m.rotation.y = x + z;
  m.receiveShadow = true; m.castShadow = true;
  scene.add(m);
  return m;
}

function fieldNoteProp(scene, x, z, accentHex) {
  const rockMat = rockMaterial({ repeat: [1.6, 1.6], normal: 1.15, tint: 0x5c5346 });
  const seed = ((x * 5 + z * 9) >>> 0) || 7;
  const base = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(0.8, 1), 0.13, seed), rockMat);
  base.scale.set(1.05, 0.68, 1.05); base.position.set(x, 0.42, z); base.rotation.y = x * 0.7;
  base.castShadow = base.receiveShadow = true; scene.add(base);
  const shoulder = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(0.5, 1), 0.1, seed + 17), rockMat);
  shoulder.scale.set(1, 0.7, 1); shoulder.position.set(x + 0.45, 0.3, z - 0.2); shoulder.castShadow = true; scene.add(shoulder);

  // glowing rune-crystal: faceted icosahedron + emissive so it reads as a gem from any angle
  const bookMat = new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.15 });
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), bookMat);
  crystal.position.set(x, 1.18, z); crystal.rotation.set(0.3, x, 0.15); crystal.scale.set(0.85, 1.4, 0.85);
  crystal.castShadow = true; scene.add(crystal);
  const halo = new THREE.PointLight(accentHex, 0.6, 6.5, 2.0);
  halo.position.set(x, 1.45, z); scene.add(halo);
  return { bookMat, crystal };
}

function spawnShatter(scene, x, y, z, colorHex) {
  if (!scene || typeof THREE === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  const grp = new THREE.Group(); grp.position.set(x, y, z); scene.add(grp);
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const s = 0.18 + Math.random() * 0.34;
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(s), new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.55, roughness: 0.55, metalness: 0.35, transparent: true }));
    const a = Math.random() * Math.PI * 2;
    m.userData.v = { x: Math.cos(a) * (2 + Math.random() * 3.5), y: 2.4 + Math.random() * 3.2, z: Math.sin(a) * (2 + Math.random() * 3.5) };
    m.userData.spin = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 };
    grp.add(m); parts.push(m);
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7CE7A2 : 0xFFD27A, transparent: true }));
    const a = Math.random() * Math.PI * 2;
    m.userData.v = { x: Math.cos(a) * 1.6, y: 3 + Math.random() * 2.2, z: Math.sin(a) * 1.6 }; m.userData.orb = true;
    grp.add(m); parts.push(m);
  }
  const light = new THREE.PointLight(colorHex, 3.2, 16, 2); grp.add(light);
  let life = 0, raf = 0, active = true; const dur = 1.25;
  const dispose = () => {
    if (!active) return;
    active = false;
    if (raf) cancelAnimationFrame(raf);
    scene.remove(grp);
    grp.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  };
  (scene.userData.disposers = scene.userData.disposers || []).push(dispose);
  const step = () => {
    if (!active) return;
    const d = 0.016; life += d; const k = Math.min(1, life / dur);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], v = p.userData.v;
      p.position.x += v.x * d; p.position.y += v.y * d; p.position.z += v.z * d;
      v.y -= (p.userData.orb ? 3.5 : 9) * d;
      if (p.userData.spin) { p.rotation.x += p.userData.spin.x * d; p.rotation.y += p.userData.spin.y * d; }
      if (p.material) p.material.opacity = 1 - k;
    }
    light.intensity = 3.2 * (1 - k);
    if (life < dur) raf = requestAnimationFrame(step);
    else dispose();
  };
  raf = requestAnimationFrame(step);
  return dispose;
}

export {
  caveTextures, rockMaterial, caveDressing, rockNoise,
  rockWall, roughen, plinthRock, fieldNoteProp,
  spawnShatter,
};

import * as THREE from "three";

function tuneRenderer(renderer, low) {
  try {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  } catch (e) { }
}

function fxCone(hex, r, h, op, x, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x || 0, h / 2, z || 0);
  m.renderOrder = 5;
  return m;
}

const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const POST_BRIGHT_FS = [
  'uniform sampler2D tex; uniform float thresh; varying vec2 vUv;',
  'void main(){ vec4 c = texture2D(tex, vUv);',
  '  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));',
  '  float k = smoothstep(thresh, thresh + 0.34, l);',
  '  gl_FragColor = vec4(c.rgb * k, 1.0); }',
].join('\n');

const POST_BLUR_FS = [
  'uniform sampler2D tex; uniform vec2 dir; uniform vec2 res; varying vec2 vUv;',
  'void main(){ vec2 px = dir / res;',
  '  vec3 s = texture2D(tex, vUv).rgb * 0.227027;',
  '  s += (texture2D(tex, vUv + px * 1.3846).rgb + texture2D(tex, vUv - px * 1.3846).rgb) * 0.3162162;',
  '  s += (texture2D(tex, vUv + px * 3.2308).rgb + texture2D(tex, vUv - px * 3.2308).rgb) * 0.0702703;',
  '  gl_FragColor = vec4(s, 1.0); }',
].join('\n');

const POST_COMP_FS = [
  'uniform sampler2D tex; uniform sampler2D bloomTex; uniform float strength; uniform float t; varying vec2 vUv;',
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'void main(){',
  '  vec2 uv = vUv; vec2 cc = uv - 0.5; float r2 = dot(cc, cc);',
  '  float ca = 0.0014 + r2 * 0.0042;',
  '  vec3 base;',
  '  base.r = texture2D(tex, uv + cc * ca).r;',
  '  base.g = texture2D(tex, uv).g;',
  '  base.b = texture2D(tex, uv - cc * ca).b;',
  '  vec3 c = base + texture2D(bloomTex, uv).rgb * strength;',
  '  float vig = 1.0 - smoothstep(0.32, 1.05, r2 * 1.9);',
  '  c *= mix(0.68, 1.0, vig);',
  '  c += vec3((hash(uv * vec2(1613.0, 1021.0) + vec2(mod(t, 10.0) * 61.0)) - 0.5) * 0.028);',
  '  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));',
  '  gl_FragColor = vec4(c, 1.0); }',
].join('\n');

function makePostFX(renderer, cssW, cssH) {
  const pr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
  const dims = (w, h) => ({ W: Math.max(2, Math.floor(w * pr)), H: Math.max(2, Math.floor(h * pr)) });
  let { W, H } = dims(cssW, cssH);
  const pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(W, H, pars);
  const rtA = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false, depthBuffer: false });
  const rtB = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false, depthBuffer: false });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bright = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, thresh: { value: 0.5 } }, vertexShader: POST_VS, fragmentShader: POST_BRIGHT_FS, depthTest: false, depthWrite: false });
  const blur = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(W >> 1, H >> 1) } }, vertexShader: POST_VS, fragmentShader: POST_BLUR_FS, depthTest: false, depthWrite: false });
  const comp = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, bloomTex: { value: null }, strength: { value: 0.9 }, t: { value: 0 } }, vertexShader: POST_VS, fragmentShader: POST_COMP_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };
  // Warm-up: force-compile all three programs NOW and verify they built.
  // If any shader fails on this GPU, throw — callers fall back to plain
  // rendering instead of a black screen.
  try {
    [bright, blur, comp].forEach(m => pass(m, rtA));
    renderer.setRenderTarget(null);
    const progs = (renderer.info && renderer.info.programs) || [];
    if (progs.some(p => p && p.diagnostics)) throw new Error('post shader failed to compile');
  } catch (e) {
    try { rtScene.dispose(); rtA.dispose(); rtB.dispose(); } catch (e2) { }
    throw e;
  }
  return {
    setStrength(v) { comp.uniforms.strength.value = v; },
    render(scene, camera) {
      try {
        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);
        bright.uniforms.tex.value = rtScene.texture; pass(bright, rtA);
        blur.uniforms.tex.value = rtA.texture; blur.uniforms.dir.value.set(1, 0); pass(blur, rtB);
        blur.uniforms.tex.value = rtB.texture; blur.uniforms.dir.value.set(0, 1); pass(blur, rtA);
        blur.uniforms.tex.value = rtA.texture; blur.uniforms.dir.value.set(2.4, 0); pass(blur, rtB);
        blur.uniforms.tex.value = rtB.texture; blur.uniforms.dir.value.set(0, 2.4); pass(blur, rtA);
        comp.uniforms.tex.value = rtScene.texture;
        comp.uniforms.bloomTex.value = rtA.texture;
        comp.uniforms.t.value = (Date.now() % 100000) / 1000;
        pass(comp, null);
      } catch (e) {
        try { renderer.setRenderTarget(null); } catch (e2) { }
        renderer.render(scene, camera);
      }
    },
    resize(w, h) {
      const d = dims(w, h);
      rtScene.setSize(d.W, d.H);
      rtA.setSize(d.W >> 1, d.H >> 1);
      rtB.setSize(d.W >> 1, d.H >> 1);
      blur.uniforms.res.value.set(d.W >> 1, d.H >> 1);
    },
    dispose() {
      try { rtScene.dispose(); rtA.dispose(); rtB.dispose(); } catch (e) { }
    },
  };
}

function glowTexture() {
  if (glowTexture._t) return glowTexture._t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  glowTexture._t = t; return t;
}

function glowSprite(hex, size, opacity) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opacity == null ? 0.85 : opacity });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}

function dustField(bounds, hex, count) {
  const n = count || 130;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const b = bounds;
  let seed = 99;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    pos[i * 3] = b.minX + rnd() * (b.maxX - b.minX);
    pos[i * 3 + 1] = 0.4 + rnd() * 4.6;
    pos[i * 3 + 2] = b.minZ + rnd() * (b.maxZ - b.minZ);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: glowTexture(), color: hex, size: 0.5, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

function keyLight(scene, hex, bounds, intensity) {
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  const dir = new THREE.DirectionalLight(hex, intensity == null ? 0.85 : intensity);
  dir.position.set(cx + span * 0.32, span * 0.75, cz + span * 0.22);
  dir.target.position.set(cx, 0, cz);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const d = span * 0.7 + 14;
  const c = dir.shadow.camera;
  c.left = -d; c.right = d; c.top = d; c.bottom = -d; c.near = 1; c.far = span * 2.2 + 40;
  c.updateProjectionMatrix();
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 0.7;
  scene.add(dir); scene.add(dir.target);
  return dir;
}

function lightScene(scene, bounds, opts) {
  opts = opts || {};
  const low = typeof window !== 'undefined' && 'ontouchstart' in window;
  const pls = [];
  scene.traverse(o => {
    if (o.isMesh) { const _tr = o.material && o.material.transparent; o.castShadow = !_tr; o.receiveShadow = true; }
    else if (o.isPointLight) pls.push(o);
  });
  pls.forEach(L => {
    const sp = glowSprite(L.color.getHex(), opts.glowSize || 4.4, opts.glowOpacity == null ? 0.8 : opts.glowOpacity);
    sp.position.copy(L.position);
    scene.add(sp);
  });
  if (opts.ceil === false) {
    keyLight(scene, opts.sky || 0xbfd0ff, bounds, low ? 0.45 : (opts.skyI == null ? 0.85 : opts.skyI));
  } else if (!low) {
    pls.slice().sort((a, b) => b.intensity - a.intensity).slice(0, opts.shadowLights || 3).forEach(L => {
      L.castShadow = true;
      L.shadow.mapSize.set(1024, 1024);
      L.shadow.bias = -0.004;
      L.shadow.camera.near = 0.4;
      L.shadow.camera.far = (L.distance || 20) + 4;
    });
  }
  if (!opts.noDust) scene.add(dustField(bounds, opts.dust || 0x88a0c0, low ? 55 : (opts.dustN || 130)));
}

function applyGfx(ctx, g) {
  if (!ctx) return;
  const { renderer, scene } = ctx;
  try {
    renderer.toneMappingExposure = g.exposure;
    if (ctx.post && ctx.post.setStrength) ctx.post.setStrength(g.bloom == null ? 0.9 : g.bloom);
    if (scene.fog) scene.fog.density = g.fog;
    scene.traverse(o => {
      if (o.isAmbientLight || o.isHemisphereLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.intensity = o.userData.base * g.ambient;
      } else if (o.isPointLight || o.isSpotLight || o.isDirectionalLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.userData.gfxIntensity = o.userData.base * g.lights;
        o.intensity = o.userData.gfxIntensity;
      } else if (o.isSprite && o.material && o.material.blending === THREE.AdditiveBlending) {
        o.material.opacity = g.glow;
      } else if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m.normalScale) m.normalScale.set(g.normal, g.normal); });
      }
    });
  } catch (e) { }
}

function disposeScene(scene) {
  if (!scene) return;
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  scene.traverse((object) => {
    if (object.geometry && !disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry);
      try { object.geometry.dispose(); } catch (error) { }
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      try { material.dispose(); } catch (error) { }
    }
  });
}

export {
  POST_VS, POST_BRIGHT_FS, POST_BLUR_FS, POST_COMP_FS,
  tuneRenderer, fxCone, makePostFX, glowTexture,
  glowSprite, dustField, keyLight, lightScene,
  applyGfx, disposeScene,
};

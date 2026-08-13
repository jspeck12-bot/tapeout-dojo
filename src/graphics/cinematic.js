import * as THREE from "three";
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const QUALITY_PRESETS = {
  low: {
    label: 'LOW', renderScale: 0.66, dpr: 1, aoScale: 0.42, aoSamples: 6,
    aoDenoise: 4, bloom: 0.42, bloomRadius: 0.18, dof: false, shadow: 768,
  },
  medium: {
    label: 'MEDIUM', renderScale: 0.8, dpr: 1.25, aoScale: 0.5, aoSamples: 8,
    aoDenoise: 6, bloom: 0.52, bloomRadius: 0.24, dof: false, shadow: 1024,
  },
  high: {
    label: 'HIGH', renderScale: 1, dpr: 1.5, aoScale: 0.5, aoSamples: 12,
    aoDenoise: 8, bloom: 0.58, bloomRadius: 0.3, dof: true, shadow: 2048,
  },
  ultra: {
    label: 'ULTRA', renderScale: 1, dpr: 2, aoScale: 0.62, aoSamples: 16,
    aoDenoise: 10, bloom: 0.62, bloomRadius: 0.34, dof: true, shadow: 2048,
  },
};

const POST_PROCESS_ORDER = [
  'RenderPass',
  'GTAOPass',
  'UnrealBloomPass',
  'BokehPass',
  'LUTPass',
  'GrainVignettePass',
  'SMAAPass',
  'OutputPass',
];

function qualityPreset(value) {
  if (typeof value === 'string' && QUALITY_PRESETS[value]) return QUALITY_PRESETS[value];
  if (value && typeof value === 'object' && QUALITY_PRESETS[value.preset]) return QUALITY_PRESETS[value.preset];
  if (value === true) return QUALITY_PRESETS.low;
  return QUALITY_PRESETS.high;
}

function tuneRenderer(renderer, quality = 'high') {
  const preset = qualityPreset(quality);
  try {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = quality === 'low' || quality === true ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min((typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), preset.dpr) * preset.renderScale);
    renderer.shadowMap.autoUpdate = true;
  } catch (e) { }
}

function fxCone(hex, r, h, op, x, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x || 0, h / 2, z || 0);
  m.renderOrder = 5;
  return m;
}

const POST_VS = [
  'varying vec2 vUv;',
  'void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
].join('\n');

const POST_COMP_FS = [
  'uniform sampler2D tDiffuse; uniform float time; uniform float grain;',
  'uniform float vignette; uniform float movement; varying vec2 vUv;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
  'void main(){',
  '  vec2 uv=vUv; vec2 centered=uv-0.5; float radius2=dot(centered,centered);',
  '  vec3 color=texture2D(tDiffuse,uv).rgb;',
  '  float edge=smoothstep(0.18,0.72,radius2);',
  '  color*=1.0-edge*vignette;',
  '  float noise=hash(uv*vec2(1733.0,977.0)+vec2(mod(time,13.0)*41.0));',
  '  color+=(noise-0.5)*grain*(1.0+movement*0.35);',
  '  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);',
  '}',
].join('\n');

const GRAIN_VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.022 },
    vignette: { value: 0.38 },
    movement: { value: 0 },
  },
  vertexShader: POST_VS,
  fragmentShader: POST_COMP_FS,
};

function createGradeLUT(grade = {}, size = 16) {
  const data = new Uint8Array(size * size * size * 4);
  const tint = new THREE.Color(grade.tint == null ? 0xffffff : grade.tint);
  const saturation = grade.saturation ?? 1;
  const contrast = grade.contrast ?? 1;
  const lift = grade.lift ?? 0;
  const gamma = Math.max(0.25, grade.gamma ?? 1);
  const gain = grade.gain ?? 1;
  let offset = 0;
  for (let blue = 0; blue < size; blue++) {
    for (let green = 0; green < size; green++) {
      for (let red = 0; red < size; red++) {
        let r = red / (size - 1);
        let g = green / (size - 1);
        let b = blue / (size - 1);
        const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = luminance + (r - luminance) * saturation;
        g = luminance + (g - luminance) * saturation;
        b = luminance + (b - luminance) * saturation;
        r = Math.pow(Math.max(0, ((r - 0.5) * contrast + 0.5 + lift) * gain), 1 / gamma) * tint.r;
        g = Math.pow(Math.max(0, ((g - 0.5) * contrast + 0.5 + lift) * gain), 1 / gamma) * tint.g;
        b = Math.pow(Math.max(0, ((b - 0.5) * contrast + 0.5 + lift) * gain), 1 / gamma) * tint.b;
        data[offset++] = Math.round(Math.min(1, r) * 255);
        data[offset++] = Math.round(Math.min(1, g) * 255);
        data[offset++] = Math.round(Math.min(1, b) * 255);
        data[offset++] = 255;
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function installEnvironment(renderer, scene, world = 0, quality = 'high') {
  if (!renderer || !scene || scene.userData.environment) return scene?.userData?.environment || null;
  const preset = qualityPreset(quality);
  const environmentScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(environmentScene, world === 1 ? 0.02 : 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = world === 1 ? 0.48
    : world === 6 || world === 7 ? 0.62
      : world === 2 || world === 4 ? 0.82 : 0.72;
  const state = {
    kind: 'PMREM RoomEnvironment',
    quality: preset.label.toLowerCase(),
    texture: target.texture,
    dispose() {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
      environmentScene.dispose();
      pmrem.dispose();
    },
  };
  scene.userData.environment = state;
  (scene.userData.disposers = scene.userData.disposers || []).push(() => state.dispose());
  return state;
}

function makePostFX(renderer, scene, camera, cssW, cssH, options = {}) {
  if (!renderer || !scene || !camera) throw new Error('post-processing requires renderer, scene, and camera');
  let qualityName = QUALITY_PRESETS[options.preset] ? options.preset : 'high';
  let preset = QUALITY_PRESETS[qualityName];
  let width = Math.max(2, cssW || 2);
  let height = Math.max(2, cssH || 2);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const gtao = new GTAOPass(scene, camera, Math.max(2, width * preset.aoScale), Math.max(2, height * preset.aoScale));
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (nextWidth, nextHeight) =>
    gtaoSetSize(Math.max(2, Math.floor(nextWidth * preset.aoScale)), Math.max(2, Math.floor(nextHeight * preset.aoScale)));
  gtao.blendIntensity = 0.92;
  gtao.updateGtaoMaterial({
    radius: 0.24,
    distanceExponent: 1.6,
    thickness: 1.2,
    distanceFallOff: 0.9,
    scale: 1.05,
    samples: preset.aoSamples,
    screenSpaceRadius: true,
  });
  gtao.updatePdMaterial({
    lumaPhi: 8,
    depthPhi: 2,
    normalPhi: 3,
    radius: 7,
    radiusExponent: 1.8,
    rings: 2,
    samples: preset.aoDenoise,
  });
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), preset.bloom, preset.bloomRadius, 0.82);
  bloom.threshold = 0.86;
  bloom.strength = options.bloom ?? preset.bloom;
  bloom.radius = preset.bloomRadius;
  const bokeh = new BokehPass(scene, camera, {
    focus: options.focus || 22,
    aperture: 0.000012,
    maxblur: 0.0022,
  });
  bokeh.enabled = preset.dof;
  let lutTexture = createGradeLUT(options.grade);
  const lut = new LUTPass({ lut: lutTexture, intensity: 0.88 });
  const finish = new ShaderPass(GRAIN_VIGNETTE_SHADER);
  const smaa = new SMAAPass();
  const output = new OutputPass();

  [renderPass, gtao, bloom, bokeh, lut, finish, smaa, output].forEach(pass => composer.addPass(pass));
  let sceneStats = { calls: 0, triangles: 0, quality: qualityName, renderScale: preset.renderScale };
  let moving = false;
  let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const updateResolution = () => {
    const dpr = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), preset.dpr) * preset.renderScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  };
  updateResolution();

  return {
    kind: 'EffectComposer',
    passes: POST_PROCESS_ORDER.slice(),
    setStrength(value) {
      bloom.strength = Number.isFinite(value) ? value : preset.bloom;
    },
    setGrade(grade) {
      if (!grade) return;
      const replacement = createGradeLUT(grade);
      lut.lut = replacement;
      lutTexture.dispose();
      lutTexture = replacement;
      if (grade.exposure != null) renderer.toneMappingExposure = grade.exposure;
    },
    setMoving(value) {
      moving = !!value;
      finish.uniforms.movement.value = moving ? 1 : 0;
      if (bokeh.enabled) bokeh.uniforms.maxblur.value = moving ? 0.00065 : 0.0022;
    },
    setQuality(name) {
      if (!QUALITY_PRESETS[name] || name === qualityName) return;
      qualityName = name;
      preset = QUALITY_PRESETS[name];
      gtao.updateGtaoMaterial({ samples: preset.aoSamples });
      gtao.updatePdMaterial({ samples: preset.aoDenoise });
      bloom.radius = preset.bloomRadius;
      bokeh.enabled = preset.dof;
      updateResolution();
    },
    getStats() { return sceneStats; },
    render(_scene, _camera, delta) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = Number.isFinite(delta) ? delta : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      finish.uniforms.time.value = now / 1000;
      composer.render(dt);
      sceneStats = {
        calls: renderer.info?.render?.calls || 0,
        triangles: renderer.info?.render?.triangles || 0,
        quality: qualityName,
        renderScale: preset.renderScale,
        moving,
      };
    },
    resize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth || 2);
      height = Math.max(2, nextHeight || 2);
      updateResolution();
    },
    dispose() {
      lutTexture.dispose();
      [renderPass, gtao, bloom, bokeh, lut, finish, smaa, output].forEach(pass => {
        try { pass.dispose?.(); } catch (error) { }
      });
      composer.dispose();
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
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { ...(t.userData || {}), shared: true };
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
    pls.slice().sort((a, b) => b.intensity - a.intensity).slice(0, opts.shadowLights || 1).forEach(L => {
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
    if (Number.isFinite(g.exposure)) renderer.toneMappingExposure = g.exposure;
    if (ctx.post && ctx.post.setStrength) ctx.post.setStrength(g.bloom == null ? 0.9 : g.bloom);
    if (ctx.post && ctx.post.setQuality && g.preset) ctx.post.setQuality(g.preset);
    if (scene.fog && scene.fog.isFogExp2) {
      if (scene.userData.baseFogDensity == null) scene.userData.baseFogDensity = scene.fog.density;
      scene.fog.density = scene.userData.baseFogDensity * (Number.isFinite(g.fog) ? g.fog : 1);
    }
    const preset = qualityPreset(g.preset || 'high');
    scene.traverse(o => {
      if (o.isAmbientLight || o.isHemisphereLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.intensity = o.userData.base * (Number.isFinite(g.ambient) ? g.ambient : 1);
      } else if (o.isPointLight || o.isSpotLight || o.isDirectionalLight) {
        if (o.userData.base == null) o.userData.base = o.intensity;
        o.userData.gfxIntensity = o.userData.base * (Number.isFinite(g.lights) ? g.lights : 1);
        o.intensity = o.userData.gfxIntensity;
        if (o.castShadow && o.shadow?.mapSize) {
          const size = o.isPointLight ? Math.min(1024, preset.shadow) : preset.shadow;
          if (o.shadow.mapSize.width !== size) {
            o.shadow.mapSize.set(size, size);
            if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
          }
        }
      } else if (o.isSprite && o.material && o.material.blending === THREE.AdditiveBlending) {
        o.material.opacity = Number.isFinite(g.glow) ? g.glow : 0.7;
      } else if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          if (m.normalScale && Number.isFinite(g.normal)) m.normalScale.set(g.normal, g.normal);
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) m.envMapIntensity = (m.userData.surface === 'wetRock' ? 1.3 : 0.9) * (g.ambient || 1);
        });
      }
    });
  } catch (e) { }
}

function disposeScene(scene) {
  if (!scene) return;
  for (const dispose of [...(scene.userData.disposers || [])]) {
    try { dispose(); } catch (error) { }
  }
  scene.userData.disposers = [];
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const disposedTextures = new Set();
  scene.traverse((object) => {
    if (object.geometry && !object.geometry.userData?.shared && !disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry);
      try { object.geometry.dispose(); } catch (error) { }
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const value of Object.values(material)) {
        if (!value || !value.isTexture || (value.userData && value.userData.shared) || disposedTextures.has(value)) continue;
        disposedTextures.add(value);
        try { value.dispose(); } catch (error) { }
      }
      try { material.dispose(); } catch (error) { }
    }
  });
}

export {
  QUALITY_PRESETS, POST_PROCESS_ORDER, POST_VS, POST_COMP_FS, GRAIN_VIGNETTE_SHADER,
  qualityPreset, tuneRenderer, createGradeLUT, installEnvironment,
  fxCone, makePostFX, glowTexture,
  glowSprite, dustField, keyLight, lightScene,
  applyGfx, disposeScene,
};

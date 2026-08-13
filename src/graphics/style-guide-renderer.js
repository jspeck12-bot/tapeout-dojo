import * as THREE from 'three';
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

const STYLE_GUIDE_QUALITY = {
  low: {
    label: 'LOW',
    renderScale: 0.66,
    dpr: 1,
    aoScale: 0.42,
    aoSamples: 6,
    aoDenoise: 4,
    bloom: 0.28,
    bloomRadius: 0.18,
    dof: false,
    shadow: 768,
  },
  medium: {
    label: 'MEDIUM',
    renderScale: 0.8,
    dpr: 1.25,
    aoScale: 0.5,
    aoSamples: 8,
    aoDenoise: 6,
    bloom: 0.34,
    bloomRadius: 0.22,
    dof: false,
    shadow: 1024,
  },
  high: {
    label: 'HIGH',
    renderScale: 1,
    dpr: 1.5,
    aoScale: 0.5,
    aoSamples: 12,
    aoDenoise: 8,
    bloom: 0.38,
    bloomRadius: 0.28,
    dof: true,
    shadow: 1536,
  },
  ultra: {
    label: 'ULTRA',
    renderScale: 1,
    dpr: 2,
    aoScale: 0.62,
    aoSamples: 16,
    aoDenoise: 10,
    bloom: 0.43,
    bloomRadius: 0.32,
    dof: true,
    shadow: 2048,
  },
};

const STYLE_GUIDE_POST_ORDER = [
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
  return STYLE_GUIDE_QUALITY[value] || STYLE_GUIDE_QUALITY.high;
}

function configureStyleGuideRenderer(renderer, quality = 'high') {
  const preset = qualityPreset(quality);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality === 'low'
    ? THREE.PCFSoftShadowMap
    : THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, preset.dpr) * preset.renderScale,
  );
}

function installStyleGuideEnvironment(renderer, scene, quality = 'high') {
  if (scene.userData.environment) return scene.userData.environment;
  const environmentScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromScene(environmentScene, 0.025);
  scene.environment = target.texture;
  scene.environmentIntensity = quality === 'low' ? 0.68 : 0.82;
  const state = {
    kind: 'PMREM RoomEnvironment',
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

const FULLSCREEN_VS = [
  'varying vec2 vUv;',
  'void main(){',
  '  vUv=uv;',
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
  '}',
].join('\n');

const FINISH_FS = [
  'uniform sampler2D tDiffuse;',
  'uniform float time;',
  'uniform float grain;',
  'uniform float vignette;',
  'uniform float movement;',
  'varying vec2 vUv;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
  'void main(){',
  '  vec2 centered=vUv-0.5;',
  '  float radius2=dot(centered,centered);',
  '  vec3 color=texture2D(tDiffuse,vUv).rgb;',
  '  float edge=smoothstep(0.18,0.72,radius2);',
  '  color*=1.0-edge*vignette;',
  '  float noise=hash(vUv*vec2(1733.0,977.0)+vec2(mod(time,13.0)*41.0));',
  '  color+=(noise-0.5)*grain*(1.0+movement*0.25);',
  '  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);',
  '}',
].join('\n');

const FINISH_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.018 },
    vignette: { value: 0.3 },
    movement: { value: 0 },
  },
  vertexShader: FULLSCREEN_VS,
  fragmentShader: FINISH_FS,
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

function makeStyleGuidePostFX(renderer, scene, camera, cssWidth, cssHeight, options = {}) {
  let qualityName = STYLE_GUIDE_QUALITY[options.preset] ? options.preset : 'high';
  let preset = qualityPreset(qualityName);
  let width = Math.max(2, cssWidth || 2);
  let height = Math.max(2, cssHeight || 2);
  const previousAutoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const gtao = new GTAOPass(
    scene,
    camera,
    Math.max(2, Math.floor(width * preset.aoScale)),
    Math.max(2, Math.floor(height * preset.aoScale)),
  );
  const gtaoSetSize = gtao.setSize.bind(gtao);
  gtao.setSize = (nextWidth, nextHeight) => gtaoSetSize(
    Math.max(2, Math.floor(nextWidth * preset.aoScale)),
    Math.max(2, Math.floor(nextHeight * preset.aoScale)),
  );
  gtao.blendIntensity = 0.86;
  gtao.updateGtaoMaterial({
    radius: 0.22,
    distanceExponent: 1.7,
    thickness: 1.05,
    distanceFallOff: 0.88,
    scale: 1,
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

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    preset.bloom,
    preset.bloomRadius,
    0.9,
  );
  bloom.threshold = 0.96;
  bloom.strength = options.bloom ?? preset.bloom;
  bloom.radius = preset.bloomRadius;

  const bokeh = new BokehPass(scene, camera, {
    focus: options.focus || 39,
    aperture: 0.000008,
    maxblur: 0.0014,
  });
  bokeh.enabled = options.dof == null ? preset.dof : !!options.dof;
  let lutTexture = createGradeLUT(options.grade);
  const lut = new LUTPass({ lut: lutTexture, intensity: 0.82 });
  const finish = new ShaderPass(FINISH_SHADER);
  const smaa = new SMAAPass();
  const output = new OutputPass();
  [renderPass, gtao, bloom, bokeh, lut, finish, smaa, output]
    .forEach(pass => composer.addPass(pass));

  let moving = false;
  let stats = {
    calls: 0,
    triangles: 0,
    quality: qualityName,
    renderScale: preset.renderScale,
  };

  const updateResolution = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, preset.dpr) * preset.renderScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  };
  updateResolution();

  return {
    kind: 'EffectComposer',
    passes: STYLE_GUIDE_POST_ORDER.slice(),
    getStats() {
      return stats;
    },
    setBloom(value) {
      bloom.strength = Number.isFinite(value) ? value : preset.bloom;
    },
    setStrength(value) {
      bloom.strength = Number.isFinite(value) ? value : preset.bloom;
    },
    setMoving(value) {
      moving = Boolean(value);
      finish.uniforms.movement.value = moving ? 1 : 0;
      if (bokeh.enabled) bokeh.uniforms.maxblur.value = moving ? 0.0004 : 0.0014;
    },
    setQuality(name) {
      if (!STYLE_GUIDE_QUALITY[name] || name === qualityName) return;
      qualityName = name;
      preset = qualityPreset(name);
      gtao.updateGtaoMaterial({ samples: preset.aoSamples });
      gtao.updatePdMaterial({ samples: preset.aoDenoise });
      bloom.radius = preset.bloomRadius;
      bokeh.enabled = options.dof == null ? preset.dof : !!options.dof;
      scene.environmentIntensity = name === 'low' ? 0.68 : 0.82;
      renderer.shadowMap.type = name === 'low'
        ? THREE.PCFSoftShadowMap
        : THREE.VSMShadowMap;
      scene.traverse(object => {
        if (!object.castShadow || !object.shadow?.mapSize) return;
        object.shadow.mapSize.set(preset.shadow, preset.shadow);
        if (object.shadow.map) {
          object.shadow.map.dispose();
          object.shadow.map = null;
        }
      });
      updateResolution();
    },
    render(sceneOrDelta, camera) {
      let delta = 1 / 60;
      if (typeof sceneOrDelta === 'number') {
        delta = sceneOrDelta;
      } else if (sceneOrDelta?.isScene && camera) {
        renderPass.scene = sceneOrDelta;
        renderPass.camera = camera;
      }
      renderer.info.reset();
      finish.uniforms.time.value = performance.now() / 1000;
      composer.render(delta);
      stats = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        quality: qualityName,
        renderScale: preset.renderScale,
        moving,
      };
      return stats;
    },
    resize(nextWidth, nextHeight) {
      width = Math.max(2, nextWidth || 2);
      height = Math.max(2, nextHeight || 2);
      updateResolution();
    },
    dispose() {
      renderer.info.autoReset = previousAutoReset;
      lutTexture.dispose();
      [renderPass, gtao, bloom, bokeh, lut, finish, smaa, output].forEach(pass => {
        try {
          pass.dispose?.();
        } catch (error) {
          // Best-effort GPU cleanup across Three.js pass implementations.
        }
      });
      composer.dispose();
    },
  };
}

export {
  STYLE_GUIDE_QUALITY,
  STYLE_GUIDE_POST_ORDER,
  FULLSCREEN_VS,
  FINISH_FS,
  FINISH_SHADER,
  qualityPreset,
  configureStyleGuideRenderer,
  installStyleGuideEnvironment,
  createGradeLUT,
  makeStyleGuidePostFX,
};

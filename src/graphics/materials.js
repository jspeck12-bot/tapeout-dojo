import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SURFACE_PROFILES = {
  wetRock: { seed: 17, base: 118, contrast: 72, rough: 178, roughVar: 58, normal: 2.8, scratch: 0.08, metalness: 0.02 },
  sandstone: { seed: 29, base: 174, contrast: 48, rough: 220, roughVar: 30, normal: 2.1, scratch: 0.04, metalness: 0.02 },
  concrete: { seed: 43, base: 164, contrast: 38, rough: 205, roughVar: 36, normal: 1.65, scratch: 0.12, metalness: 0.04 },
  wornSteel: { seed: 61, base: 176, contrast: 32, rough: 136, roughVar: 70, normal: 1.2, scratch: 0.34, metalness: 0.82 },
  brass: { seed: 79, base: 190, contrast: 34, rough: 126, roughVar: 62, normal: 1.05, scratch: 0.3, metalness: 0.78 },
  silicon: { seed: 97, base: 154, contrast: 28, rough: 118, roughVar: 48, normal: 0.72, scratch: 0.18, metalness: 0.64 },
  paintedMetal: { seed: 113, base: 188, contrast: 30, rough: 154, roughVar: 64, normal: 1.0, scratch: 0.28, metalness: 0.52 },
};

const textureCache = new Map();
const roundedBoxCache = new Map();

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function profileOf(surface) {
  return SURFACE_PROFILES[surface] || SURFACE_PROFILES.concrete;
}

function textureRepeatBucket(repeat) {
  const value = Math.max(1, Number(repeat) || 1);
  if (value >= 7) return 8;
  if (value >= 3.5) return 4;
  if (value >= 1.5) return 2;
  return 1;
}

function makeDataTexture(data, size, srgb, repeat) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.userData = { ...(texture.userData || {}), shared: true, procedural: true };
  return texture;
}

function buildSurfaceTextures(surface, repeat) {
  const profile = profileOf(surface);
  const size = 128;
  const random = seeded(profile.seed * 4099 + repeat * 131);
  const height = new Float32Array(size * size);
  const coarse = new Float32Array(16 * 16);
  for (let index = 0; index < coarse.length; index++) coarse[index] = random();
  const smooth = (value) => value * value * (3 - 2 * value);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / 8;
      const fy = y / 8;
      const x0 = Math.floor(fx) % 16;
      const y0 = Math.floor(fy) % 16;
      const x1 = (x0 + 1) % 16;
      const y1 = (y0 + 1) % 16;
      const tx = smooth(fx - Math.floor(fx));
      const ty = smooth(fy - Math.floor(fy));
      const a = coarse[y0 * 16 + x0] * (1 - tx) + coarse[y0 * 16 + x1] * tx;
      const b = coarse[y1 * 16 + x0] * (1 - tx) + coarse[y1 * 16 + x1] * tx;
      const fine = random() * 0.22;
      height[y * size + x] = (a * (1 - ty) + b * ty) * 0.78 + fine;
    }
  }

  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const offset = index * 4;
      const h = height[index];
      const scratch = ((x * 17 + y * 31 + profile.seed) % 97) < profile.scratch * 10
        || ((x + profile.seed * 3) % 61 === 0 && y % 5 < 4);
      const value = profile.base + (h - 0.5) * profile.contrast - (scratch ? 34 : 0);
      albedo[offset] = clampByte(value * 0.97);
      albedo[offset + 1] = clampByte(value);
      albedo[offset + 2] = clampByte(value * 1.025);
      albedo[offset + 3] = 255;

      const roughValue = profile.rough + (0.5 - h) * profile.roughVar + (scratch ? 22 : 0);
      roughness[offset] = roughness[offset + 1] = roughness[offset + 2] = clampByte(roughValue);
      roughness[offset + 3] = 255;

      const left = height[y * size + ((x - 1 + size) % size)];
      const right = height[y * size + ((x + 1) % size)];
      const top = height[((y - 1 + size) % size) * size + x];
      const bottom = height[((y + 1) % size) * size + x];
      let nx = (left - right) * profile.normal;
      let ny = (top - bottom) * profile.normal;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      normal[offset] = clampByte((nx * 0.5 + 0.5) * 255);
      normal[offset + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normal[offset + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;
    }
  }

  return {
    map: makeDataTexture(albedo, size, true, repeat),
    roughnessMap: makeDataTexture(roughness, size, false, repeat),
    normalMap: makeDataTexture(normal, size, false, repeat),
  };
}

function surfaceTextures(surface = 'concrete', repeat = 1) {
  const bucket = textureRepeatBucket(repeat);
  const key = `${surface}:${bucket}`;
  if (!textureCache.has(key)) textureCache.set(key, buildSurfaceTextures(surface, bucket));
  return textureCache.get(key);
}

function estimateRepeat(object) {
  const parameters = object?.geometry?.parameters;
  if (!parameters) return 1;
  const dimensions = [
    parameters.width || parameters.radius * 2 || 1,
    parameters.height || parameters.radius * 2 || 1,
    parameters.depth || parameters.radius * 2 || 1,
  ];
  return textureRepeatBucket(Math.max(...dimensions) / 6);
}

function inferSurface(material, world = 0) {
  if (material?.userData?.surface) return material.userData.surface;
  if ((material?.metalness || 0) > 0.68) return world === 5 || world === 7 ? 'brass' : 'wornSteel';
  if ((material?.metalness || 0) > 0.32) return world === 0 || world === 7 ? 'silicon' : 'paintedMetal';
  if (world === 1) return 'wetRock';
  if (world === 2 || world === 4) return 'sandstone';
  return 'concrete';
}

function applySurfaceMaps(material, surface, repeat = 1) {
  if (!material || (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial)) return material;
  const textures = surfaceTextures(surface, repeat);
  if (!material.map) material.map = textures.map;
  if (!material.roughnessMap) material.roughnessMap = textures.roughnessMap;
  if (!material.normalMap) material.normalMap = textures.normalMap;
  if (!material.normalScale) material.normalScale = new THREE.Vector2(1, 1);
  material.normalScale.setScalar(surface === 'wetRock' ? 1.15 : surface === 'sandstone' ? 0.92 : 0.72);
  material.envMapIntensity = surface === 'wetRock' ? 1.35 : material.metalness > 0.45 ? 1.2 : 0.82;
  material.flatShading = false;
  material.userData = { ...(material.userData || {}), surface, textured: true };
  material.needsUpdate = true;
  return material;
}

function pbrMaterial(surface, color, options = {}) {
  const profile = profileOf(surface);
  const repeat = options.repeat || 1;
  const materialOptions = { ...options };
  delete materialOptions.repeat;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: materialOptions.roughness ?? profile.rough / 255,
    metalness: materialOptions.metalness ?? profile.metalness,
    ...materialOptions,
  });
  material.userData = { ...(material.userData || {}), surface };
  return applySurfaceMaps(material, surface, repeat);
}

function roundedBoxGeometry(width, height, depth, radius, segments = 2) {
  const shortest = Math.min(width, height, depth);
  const edge = Math.max(0.015, Math.min(radius ?? 0.14, shortest * 0.22));
  const key = [width, height, depth, edge, segments].map(value => Number(value).toFixed(3)).join(':');
  if (!roundedBoxCache.has(key)) {
    const geometry = new RoundedBoxGeometry(width, height, depth, segments, edge);
    geometry.userData = { ...(geometry.userData || {}), shared: true, beveled: true };
    roundedBoxCache.set(key, geometry);
  }
  return roundedBoxCache.get(key);
}

function shouldBevel(object) {
  const geometry = object?.geometry;
  if (!geometry || geometry.type !== 'BoxGeometry' || geometry.userData?.beveled) return false;
  const { width = 0, height = 0, depth = 0 } = geometry.parameters || {};
  return Math.min(width, height, depth) >= 0.16 && Math.max(width, height, depth) <= 320;
}

function finalizeWorldMaterials(scene, world = 0) {
  const materials = new Set();
  let standard = 0;
  let textured = 0;
  let beveled = 0;
  scene.traverse((object) => {
    if (object.isMesh && shouldBevel(object)) {
      const { width, height, depth } = object.geometry.parameters;
      object.geometry = roundedBoxGeometry(width, height, depth, undefined, Math.max(width, height, depth) > 80 ? 1 : 2);
      beveled++;
    }
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        standard++;
        const surface = inferSurface(material, world);
        applySurfaceMaps(material, surface, estimateRepeat(object));
        if (material.map && material.roughnessMap && material.normalMap) textured++;
      }
    }
    if (object.isMesh && object.material && !object.material.transparent) {
      object.receiveShadow = true;
      object.castShadow = object.castShadow || object.position.y > 0.12;
    }
  });
  const coverage = { standard, textured, beveled, complete: standard === textured };
  scene.userData.materialCoverage = coverage;
  return coverage;
}

export {
  SURFACE_PROFILES,
  surfaceTextures,
  inferSurface,
  applySurfaceMaps,
  pbrMaterial,
  roundedBoxGeometry,
  finalizeWorldMaterials,
};

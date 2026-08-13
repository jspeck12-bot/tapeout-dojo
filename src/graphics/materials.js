import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SURFACE_PROFILES = {
  wetRock: {
    seed: 17, base: 112, contrast: 88, rough: 158, roughVar: 76,
    normal: 3.2, scratch: 0.04, metalness: 0.02,
  },
  concrete: {
    seed: 43, base: 166, contrast: 42, rough: 208, roughVar: 42,
    normal: 1.8, scratch: 0.08, metalness: 0.03,
  },
  wornSteel: {
    seed: 61, base: 182, contrast: 34, rough: 132, roughVar: 84,
    normal: 1.3, scratch: 0.34, metalness: 0.84,
  },
  brass: {
    seed: 79, base: 194, contrast: 42, rough: 120, roughVar: 78,
    normal: 1.15, scratch: 0.28, metalness: 0.8,
  },
  silicon: {
    seed: 97, base: 168, contrast: 36, rough: 102, roughVar: 62,
    normal: 0.82, scratch: 0.15, metalness: 0.68,
  },
  paintedMetal: {
    seed: 113, base: 186, contrast: 36, rough: 148, roughVar: 72,
    normal: 1.1, scratch: 0.3, metalness: 0.5,
  },
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

function repeatBucket(repeat) {
  const value = Math.max(1, Number(repeat) || 1);
  if (value >= 10) return 12;
  if (value >= 6) return 8;
  if (value >= 3) return 4;
  if (value >= 1.5) return 2;
  return 1;
}

function makeDataTexture(data, size, srgb, repeat) {
  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  texture.userData = {
    ...(texture.userData || {}),
    shared: true,
    procedural: true,
    surfaceResolution: size,
  };
  return texture;
}

function valueNoise(random, cells, size) {
  const grid = new Float32Array(cells * cells);
  for (let index = 0; index < grid.length; index++) grid[index] = random();
  const result = new Float32Array(size * size);
  const smooth = value => value * value * (3 - 2 * value);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size * cells;
      const fy = y / size * cells;
      const x0 = Math.floor(fx) % cells;
      const y0 = Math.floor(fy) % cells;
      const x1 = (x0 + 1) % cells;
      const y1 = (y0 + 1) % cells;
      const tx = smooth(fx - Math.floor(fx));
      const ty = smooth(fy - Math.floor(fy));
      const a = grid[y0 * cells + x0] * (1 - tx) + grid[y0 * cells + x1] * tx;
      const b = grid[y1 * cells + x0] * (1 - tx) + grid[y1 * cells + x1] * tx;
      result[y * size + x] = a * (1 - ty) + b * ty;
    }
  }
  return result;
}

function buildSurfaceTextures(surface, repeat) {
  const profile = profileOf(surface);
  const size = 256;
  const random = seeded(profile.seed * 4099 + repeat * 131);
  const broad = valueNoise(random, 8, size);
  const medium = valueNoise(random, 24, size);
  const fine = valueNoise(random, 64, size);
  const height = new Float32Array(size * size);
  for (let index = 0; index < height.length; index++) {
    height[index] = broad[index] * 0.56 + medium[index] * 0.29 + fine[index] * 0.15;
  }

  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const offset = index * 4;
      const h = height[index];
      const longScratch = (x + profile.seed * 3) % 73 === 0 && y % 7 < 5;
      const pitted = ((x * 17 + y * 31 + profile.seed) % 211) < profile.scratch * 18;
      const scratch = longScratch || pitted;
      const mottled = (medium[index] - 0.5) * profile.contrast * 0.45;
      const value = profile.base + (h - 0.5) * profile.contrast + mottled - (scratch ? 38 : 0);
      albedo[offset] = clampByte(value * 0.96);
      albedo[offset + 1] = clampByte(value);
      albedo[offset + 2] = clampByte(value * 1.035);
      albedo[offset + 3] = 255;

      const roughValue = profile.rough + (0.5 - h) * profile.roughVar + (scratch ? 30 : 0);
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
  const bucket = repeatBucket(repeat);
  const key = `${surface}:${bucket}`;
  if (!textureCache.has(key)) textureCache.set(key, buildSurfaceTextures(surface, bucket));
  return textureCache.get(key);
}

function applySurfaceMaps(material, surface, repeat = 1) {
  if (!material || (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial)) {
    return material;
  }
  const textures = surfaceTextures(surface, repeat);
  if (!material.map) material.map = textures.map;
  if (!material.roughnessMap) material.roughnessMap = textures.roughnessMap;
  if (!material.normalMap) material.normalMap = textures.normalMap;
  material.normalScale.setScalar(
    surface === 'wetRock' ? 1.25 : surface === 'concrete' ? 0.85 : 0.68,
  );
  material.envMapIntensity = surface === 'wetRock'
    ? 1.45
    : material.metalness > 0.45 ? 1.25 : 0.86;
  material.flatShading = false;
  material.userData = {
    ...(material.userData || {}),
    surface,
    textured: true,
  };
  material.needsUpdate = true;
  return material;
}

function pbrMaterial(surface, color, options = {}) {
  const profile = profileOf(surface);
  const repeat = options.repeat || 1;
  const materialOptions = { ...options };
  delete materialOptions.repeat;
  const usePhysical = surface === 'silicon'
    || surface === 'wetRock'
    || materialOptions.physical;
  delete materialOptions.physical;
  const Material = usePhysical
    ? THREE.MeshPhysicalMaterial
    : THREE.MeshStandardMaterial;
  if (surface === 'silicon') {
    materialOptions.clearcoat ??= 0.48;
    materialOptions.clearcoatRoughness ??= 0.26;
    materialOptions.iridescence ??= 0.24;
    materialOptions.iridescenceIOR ??= 1.8;
  }
  if (surface === 'wetRock') {
    materialOptions.clearcoat ??= 0.58;
    materialOptions.clearcoatRoughness ??= 0.34;
    materialOptions.ior ??= 1.33;
  }
  const material = new Material({
    color,
    roughness: materialOptions.roughness ?? profile.rough / 255,
    metalness: materialOptions.metalness ?? profile.metalness,
    ...materialOptions,
  });
  material.userData = { ...(material.userData || {}), surface };
  return applySurfaceMaps(material, surface, repeat);
}

function roundedBoxGeometry(width, height, depth, radius, segments = 3) {
  const shortest = Math.min(width, height, depth);
  const edge = Math.max(0.015, Math.min(radius ?? 0.16, shortest * 0.22));
  const key = [width, height, depth, edge, segments]
    .map(value => Number(value).toFixed(3))
    .join(':');
  if (!roundedBoxCache.has(key)) {
    const geometry = new RoundedBoxGeometry(width, height, depth, segments, edge);
    geometry.userData = {
      ...(geometry.userData || {}),
      shared: true,
      beveled: true,
    };
    roundedBoxCache.set(key, geometry);
  }
  return roundedBoxCache.get(key);
}

function materialCoverage(scene) {
  const materials = new Set();
  let pbr = 0;
  let textured = 0;
  scene.traverse(object => {
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        pbr++;
        if (material.map && material.roughnessMap && material.normalMap) textured++;
      }
    }
  });
  return { pbr, textured, complete: pbr === textured };
}

export {
  SURFACE_PROFILES,
  surfaceTextures,
  applySurfaceMaps,
  pbrMaterial,
  roundedBoxGeometry,
  materialCoverage,
};

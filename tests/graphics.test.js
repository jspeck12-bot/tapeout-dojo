import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
  GRAIN_VIGNETTE_SHADER,
  POST_PROCESS_ORDER,
  POST_COMP_FS,
  POST_VS,
  QUALITY_PRESETS,
  createGradeLUT,
  disposeScene,
  qualityPreset,
} from '../src/graphics/cinematic.js';
import {
  finalizeWorldMaterials,
  pbrMaterial,
  roundedBoxGeometry,
} from '../src/graphics/materials.js';
import { spawnShatter } from '../src/graphics/rock.js';

function delimiterBalance(source, open, close) {
  let depth = 0;
  for (const character of source) {
    if (character === open) depth++;
    if (character === close) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe('post-processing pipeline', () => {
  test('keeps the composer order and final shader structurally complete', () => {
    expect(POST_PROCESS_ORDER).toEqual([
      'RenderPass',
      'GTAOPass',
      'UnrealBloomPass',
      'BokehPass',
      'LUTPass',
      'GrainVignettePass',
      'SMAAPass',
      'OutputPass',
    ]);
    const shaders = [POST_VS, POST_COMP_FS];
    for (const shader of shaders) {
      expect(shader).toContain('void main()');
      expect(delimiterBalance(shader, '{', '}')).toBe(true);
      expect(delimiterBalance(shader, '(', ')')).toBe(true);
      expect(shader).not.toMatch(/undefined|NaN/);
    }
    expect(POST_VS).toContain('varying vec2 vUv');
    expect(POST_COMP_FS).toMatch(/uniform sampler2D tDiffuse.*uniform float time.*uniform float grain/);
    expect(POST_COMP_FS).toMatch(/uniform float vignette.*uniform float movement/);
    expect(GRAIN_VIGNETTE_SHADER.uniforms.tDiffuse.value).toBeNull();
  });

  test('defines four bounded quality presets with AO and SMAA retained', () => {
    expect(Object.keys(QUALITY_PRESETS)).toEqual(['low', 'medium', 'high', 'ultra']);
    for (const [name, preset] of Object.entries(QUALITY_PRESETS)) {
      expect(qualityPreset(name)).toBe(preset);
      expect(preset.renderScale).toBeGreaterThanOrEqual(0.6);
      expect(preset.renderScale).toBeLessThanOrEqual(1);
      expect(preset.aoScale).toBeGreaterThan(0);
      expect(preset.aoSamples).toBeGreaterThanOrEqual(6);
    }
    expect(QUALITY_PRESETS.low.dof).toBe(false);
    expect(QUALITY_PRESETS.high.dof).toBe(true);
  });

  test('generates a finite 3D color-grade LUT', () => {
    const lut = createGradeLUT({
      saturation: 0.92,
      contrast: 1.12,
      tint: 0xffdfc0,
      lift: -0.02,
      gamma: 0.96,
      gain: 1.02,
    }, 8);
    expect(lut.isData3DTexture).toBe(true);
    expect(lut.image.width).toBe(8);
    expect(lut.image.data).toHaveLength(8 * 8 * 8 * 4);
    expect([...lut.image.data].every(Number.isFinite)).toBe(true);
    lut.dispose();
  });

  test('textures PBR surfaces and bevels hard box edges', () => {
    const scene = new THREE.Scene();
    const material = pbrMaterial('wornSteel', 0x59636e, { metalness: 0.78 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), material);
    mesh.position.y = 1;
    scene.add(mesh);
    const coverage = finalizeWorldMaterials(scene, 3);
    expect(coverage).toMatchObject({ standard: 1, textured: 1, beveled: 1, complete: true });
    expect(mesh.geometry.type).toBe('RoundedBoxGeometry');
    expect(mesh.material.map).toBeTruthy();
    expect(mesh.material.roughnessMap).toBeTruthy();
    expect(mesh.material.normalMap).toBeTruthy();
    expect(roundedBoxGeometry(4, 2, 3)).toBe(roundedBoxGeometry(4, 2, 3));
  });

  test('disposes unique scene geometries and materials exactly once', () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    let geometryDisposals = 0;
    let materialDisposals = 0;
    let textureDisposals = 0;
    let sharedTextureDisposals = 0;
    const texture = new THREE.Texture();
    const sharedTexture = new THREE.Texture();
    sharedTexture.userData = { shared: true };
    geometry.userData = { shared: true };
    texture.dispose = () => { textureDisposals++; };
    sharedTexture.dispose = () => { sharedTextureDisposals++; };
    material.map = texture;
    material.alphaMap = sharedTexture;
    geometry.dispose = () => { geometryDisposals++; };
    material.dispose = () => { materialDisposals++; };
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.Mesh(geometry, material));

    disposeScene(scene);

    expect(geometryDisposals).toBe(0);
    expect(materialDisposals).toBe(1);
    expect(textureDisposals).toBe(1);
    expect(sharedTextureDisposals).toBe(0);
  });

  test('cancels transient shatter animation when a scene is disposed', () => {
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    const cancel = vi.fn();
    globalThis.requestAnimationFrame = vi.fn(() => 42);
    globalThis.cancelAnimationFrame = cancel;
    try {
      const scene = new THREE.Scene();
      spawnShatter(scene, 0, 1, 0, 0xff0000);
      expect(scene.userData.disposers).toHaveLength(1);
      expect(scene.children.length).toBe(1);

      disposeScene(scene);

      expect(cancel).toHaveBeenCalledWith(42);
      expect(scene.children.length).toBe(0);
      expect(scene.userData.disposers).toEqual([]);
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});

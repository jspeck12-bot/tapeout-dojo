import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import {
  POST_BLUR_FS,
  POST_BRIGHT_FS,
  POST_COMP_FS,
  POST_VS,
  disposeScene,
  makePostFX,
} from '../src/graphics/cinematic.js';

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
  test('keeps shader contracts structurally complete', () => {
    const shaders = [POST_VS, POST_BRIGHT_FS, POST_BLUR_FS, POST_COMP_FS];
    for (const shader of shaders) {
      expect(shader).toContain('void main()');
      expect(delimiterBalance(shader, '{', '}')).toBe(true);
      expect(delimiterBalance(shader, '(', ')')).toBe(true);
      expect(shader).not.toMatch(/undefined|NaN/);
    }
    expect(POST_VS).toContain('varying vec2 vUv');
    expect(POST_BRIGHT_FS).toMatch(/uniform sampler2D tex.*uniform float thresh/);
    expect(POST_BLUR_FS).toMatch(/uniform sampler2D tex.*uniform vec2 dir.*uniform vec2 res/);
    expect(POST_COMP_FS).toMatch(/uniform sampler2D tex.*uniform sampler2D bloomTex.*uniform float strength.*uniform float t/);
  });

  test('constructs, renders, resizes, and disposes the complete pass graph', () => {
    let renderCalls = 0;
    let targetCalls = 0;
    const renderer = {
      info: { programs: [] },
      getPixelRatio: () => 1,
      setRenderTarget: () => { targetCalls++; },
      render: () => { renderCalls++; },
    };
    const post = makePostFX(renderer, 1280, 720);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    expect(() => post.setStrength(0.75)).not.toThrow();
    expect(() => post.resize(640, 360)).not.toThrow();
    expect(() => post.render(scene, camera)).not.toThrow();
    expect(renderCalls).toBe(10);
    expect(targetCalls).toBe(11);
    expect(() => post.dispose()).not.toThrow();
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
    texture.dispose = () => { textureDisposals++; };
    sharedTexture.dispose = () => { sharedTextureDisposals++; };
    material.map = texture;
    material.alphaMap = sharedTexture;
    geometry.dispose = () => { geometryDisposals++; };
    material.dispose = () => { materialDisposals++; };
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.Mesh(geometry, material));

    disposeScene(scene);

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
    expect(textureDisposals).toBe(1);
    expect(sharedTextureDisposals).toBe(0);
  });
});

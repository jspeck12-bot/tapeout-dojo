import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import {
  pbrMaterial,
  roundedBoxGeometry,
  surfaceTextures,
} from '../src/graphics/materials.js';
import {
  PALETTE,
  STYLE_GUIDE_MODEL,
  buildStyleGuideScene,
} from '../src/graphics/style-guide.js';
import {
  FINISH_FS,
  FULLSCREEN_VS,
  STYLE_GUIDE_POST_ORDER,
  STYLE_GUIDE_QUALITY,
  createGradeLUT,
} from '../src/graphics/style-guide-renderer.js';

describe('Silicon Gothic style guide', () => {
  test('defines the approved post order and four bounded quality tiers', () => {
    expect(STYLE_GUIDE_POST_ORDER).toEqual([
      'RenderPass',
      'GTAOPass',
      'UnrealBloomPass',
      'BokehPass',
      'LUTPass',
      'GrainVignettePass',
      'SMAAPass',
      'OutputPass',
    ]);
    expect(Object.keys(STYLE_GUIDE_QUALITY)).toEqual([
      'low',
      'medium',
      'high',
      'ultra',
    ]);
    Object.values(STYLE_GUIDE_QUALITY).forEach(preset => {
      expect(preset.renderScale).toBeGreaterThanOrEqual(0.6);
      expect(preset.renderScale).toBeLessThanOrEqual(1);
      expect(preset.aoScale).toBeGreaterThan(0);
      expect(preset.aoSamples).toBeGreaterThanOrEqual(6);
    });
    expect(STYLE_GUIDE_QUALITY.low.dof).toBe(false);
    expect(STYLE_GUIDE_QUALITY.ultra.dof).toBe(true);
    expect(FULLSCREEN_VS).toContain('void main()');
    expect(FINISH_FS).toContain('void main()');
  });

  test('builds a finite grade LUT', () => {
    const lut = createGradeLUT({
      saturation: 0.92,
      contrast: 1.1,
      tint: 0xe8f3ff,
      lift: -0.018,
      gamma: 1.02,
      gain: 1.01,
    }, 8);
    expect(lut.isData3DTexture).toBe(true);
    expect(lut.image.width).toBe(8);
    expect(lut.image.data).toHaveLength(8 * 8 * 8 * 4);
    expect([...lut.image.data].every(Number.isFinite)).toBe(true);
    lut.dispose();
  });

  test('caches beveled geometry and complete procedural PBR maps', () => {
    const geometry = roundedBoxGeometry(4, 2, 3, 0.25, 3);
    expect(roundedBoxGeometry(4, 2, 3, 0.25, 3)).toBe(geometry);
    expect(geometry.userData).toMatchObject({ shared: true, beveled: true });
    const textures = surfaceTextures('wornSteel', 4);
    expect(textures.map.image.width).toBe(256);
    expect(textures.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(textures.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    const material = pbrMaterial('silicon', 0x536575);
    expect(material.isMeshPhysicalMaterial).toBe(true);
    expect(material.map).toBeTruthy();
    expect(material.roughnessMap).toBeTruthy();
    expect(material.normalMap).toBeTruthy();
    const wet = pbrMaterial('wetRock', 0x6a5846);
    expect(wet.isMeshPhysicalMaterial).toBe(true);
    expect(wet.clearcoat).toBeGreaterThan(0.4);
  });

  test('composes the review scene by hand around an unobstructed wafer landmark', () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
      createElement() {
        const canvas = { width: 300, height: 150 };
        const context = {
          canvas,
          font: '',
          fillStyle: '',
          strokeStyle: '',
          globalAlpha: 1,
          textAlign: '',
          textBaseline: '',
          measureText: text => ({ width: String(text).length * 18 }),
          fillRect() {},
          strokeRect() {},
          fillText() {},
        };
        canvas.getContext = () => context;
        return canvas;
      },
    };
    try {
      const scene = new THREE.Scene();
      const result = buildStyleGuideScene(scene);
      const art = result.worldArt;
      expect(result.model).toBe(STYLE_GUIDE_MODEL);
      expect(scene.userData.worldArt).toBe(art);
      expect(art.palette).toBe(PALETTE);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.landmark.position.z).toBeLessThan(-45);
      expect(art.frame.userData.foregroundFrame).toBe(true);
      expect(art.pathLighting.userData.pathLighting).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.shaft.castShadow).toBe(false);
      expect(art.key.userData.lightRole).toBe('key');
      expect(art.rim.userData.lightRole).toBe('rim');
      expect(art.materialCoverage.complete).toBe(true);
      expect(result.samples.map(sample => sample.userData.materialSample)).toEqual([
        'wetRock',
        'wornSteel',
        'concrete',
        'brass',
        'silicon',
      ]);
      const shadowPointLights = [];
      scene.traverse(object => {
        if (object.isPointLight && object.castShadow) shadowPointLights.push(object);
        for (const vector of [object.position, object.rotation, object.scale]) {
          if (!vector) continue;
          expect([vector.x, vector.y, vector.z].every(Number.isFinite)).toBe(true);
        }
      });
      expect(shadowPointLights).toEqual([]);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

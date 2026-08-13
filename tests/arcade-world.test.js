import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { buildArcadeWorld } from '../src/graphics/world-builders.js';
import { ARCADE_PALETTE, MARQUEE } from '../src/graphics/arcade-world.js';
import { arcadeModel } from '../src/world/arcade.js';

function stubDocument() {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      const canvas = { width: 256, height: 256 };
      const context = {
        canvas,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        textAlign: '',
        textBaseline: '',
        lineWidth: 1,
        lineCap: '',
        measureText: text => ({ width: String(text).length * 18 }),
        fillRect() {},
        strokeRect() {},
        fillText() {},
        clearRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fill() {},
        arc() {},
        createImageData(width = 256, height = 256) {
          return {
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
          };
        },
        putImageData() {},
        createRadialGradient() {
          return { addColorStop() {} };
        },
        createLinearGradient() {
          return { addColorStop() {} };
        },
      };
      canvas.getContext = () => context;
      return canvas;
    },
  };
  return () => { globalThis.document = originalDocument; };
}

describe('Silicon Gothic Arcade', () => {
  test('composes a neon cabinet hall with PBR, path lighting, and unshadowed point lights', () => {
    const restore = stubDocument();
    try {
      const scene = new THREE.Scene();
      const model = arcadeModel();
      const api = buildArcadeWorld(scene, model);
      const art = api.worldArt;
      expect(art).toBe(scene.userData.worldArt);
      expect(art.palette).toBe(ARCADE_PALETTE);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.landmark.position.x).toBe(MARQUEE.x);
      expect(art.landmark.position.z).toBe(MARQUEE.z);
      expect(art.landmark.position.z).toBeLessThan(model.spawn.z);
      expect(art.frame.userData.foregroundFrame).toBe(true);
      expect(art.pathLighting.userData.pathLighting).toBe(true);
      expect(art.shaft.userData.lightShaft).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.lighting.key.userData.lightRole).toBe('key');
      expect(art.lighting.rim.userData.lightRole).toBe('rim');
      expect(art.lighting.rim.castShadow).toBe(false);
      expect(api.spin).toBeTruthy();
      expect(Object.keys(api.cabinets).length).toBe(
        model.interactables.filter(item => item.kind === 'arcade').length,
      );

      const shadowPointLights = [];
      let brass = 0;
      let silicon = 0;
      scene.traverse(object => {
        if (object.isPointLight && object.castShadow) shadowPointLights.push(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (material?.userData?.surface === 'brass') brass += 1;
          if (material?.userData?.surface === 'silicon') silicon += 1;
        });
        for (const vector of [object.position, object.rotation, object.scale]) {
          if (!vector) continue;
          expect([vector.x, vector.y, vector.z].every(Number.isFinite)).toBe(true);
        }
      });
      expect(shadowPointLights).toEqual([]);
      expect(brass).toBeGreaterThan(2);
      expect(silicon).toBeGreaterThan(4);
      expect(art.materialCoverage.pbr).toBeGreaterThan(8);
      expect(art.materialCoverage.textured).toBeGreaterThan(8);
    } finally {
      restore();
    }
  });
});

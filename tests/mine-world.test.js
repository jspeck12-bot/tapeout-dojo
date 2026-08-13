import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { LESSONS } from '../src/game/content.js';
import { buildMineWorld } from '../src/graphics/world-builders.js';
import { MINE_PALETTE, SHAFT_SPLIT } from '../src/graphics/mine-world.js';
import { mineModel } from '../src/world/mine.js';

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

describe('Silicon Gothic Bit Mines', () => {
  test('composes a cathedral cavern with wet PBR and unshadowed point lights', () => {
    const restore = stubDocument();
    try {
      const scene = new THREE.Scene();
      const model = mineModel((LESSONS[1] || []).map(lesson => lesson.id));
      const api = buildMineWorld(scene, model);
      const art = api.worldArt;
      expect(art).toBe(scene.userData.worldArt);
      expect(art.palette).toBe(MINE_PALETTE);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.landmark.position.z).toBeLessThan(SHAFT_SPLIT);
      expect(art.frame.userData.foregroundFrame).toBe(true);
      expect(art.pathLighting.userData.pathLighting).toBe(true);
      expect(art.chandelier.userData.shaftLandmark).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.shaft.castShadow).toBe(false);
      expect(art.lighting.key.userData.lightRole).toBe('key');
      expect(art.lighting.rim.userData.lightRole).toBe('rim');
      expect(art.lighting.key.castShadow).toBe(true);
      expect(api.gateGrp).toBeTruthy();
      expect(api.nextGrp).toBeTruthy();
      expect(Object.keys(api.totems).length).toBe(
        model.interactables.filter(item => item.kind === 'fight').length,
      );

      const shadowPointLights = [];
      let wetRock = 0;
      scene.traverse(object => {
        if (object.isPointLight && object.castShadow) shadowPointLights.push(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (material?.userData?.surface === 'wetRock') wetRock += 1;
        });
        for (const vector of [object.position, object.rotation, object.scale]) {
          if (!vector) continue;
          expect([vector.x, vector.y, vector.z].every(Number.isFinite)).toBe(true);
        }
      });
      expect(shadowPointLights).toEqual([]);
      expect(wetRock).toBeGreaterThan(3);
      expect(art.materialCoverage.pbr).toBeGreaterThan(8);
      expect(art.materialCoverage.textured).toBeGreaterThan(8);
    } finally {
      restore();
    }
  });
});

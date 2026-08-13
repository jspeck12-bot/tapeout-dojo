import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { LESSONS } from '../src/game/content.js';
import { challengesOf } from '../src/world/challenges.js';
import { dungeonModel } from '../src/world/dungeon.js';
import { buildDungeonWorld } from '../src/graphics/world-builders.js';
import { VALLEY_PALETTE } from '../src/graphics/valley-world.js';

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

describe('Silicon Gothic Gate Valley', () => {
  test('composes a night basin with wet PBR, path lighting, and unshadowed point lights', () => {
    const restore = stubDocument();
    try {
      const scene = new THREE.Scene();
      const lessonIds = (LESSONS[2] || []).map(lesson => lesson.id);
      const model = dungeonModel(2, challengesOf(2), lessonIds);
      const api = buildDungeonWorld(scene, model, model.theme);
      const art = api.worldArt;
      expect(art).toBe(scene.userData.worldArt);
      expect(art.palette).toBe(VALLEY_PALETTE);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.landmark.position.z).toBe(model.gateZ);
      expect(art.frame.userData.foregroundFrame).toBe(true);
      expect(art.pathLighting.userData.pathLighting).toBe(true);
      expect(art.shaft.userData.lightShaft).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.lighting.key.userData.lightRole).toBe('key');
      expect(art.lighting.rim.userData.lightRole).toBe('rim');
      expect(art.lighting.rim.castShadow).toBe(false);
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

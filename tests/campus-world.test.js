import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { buildCampusWorld, applyCampusProgress, buildFabUltra } from '../src/graphics/world-builders.js';
import { CAMPUS_PALETTE } from '../src/graphics/campus-world.js';
import { campusModel, campusProgress } from '../src/world/campus.js';

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

describe('Silicon Gothic Fab Campus', () => {
  test('composes a night plaza with silicon PBR, path lighting, and unshadowed point lights', () => {
    const restore = stubDocument();
    try {
      const scene = new THREE.Scene();
      const model = campusModel();
      const api = buildCampusWorld(scene, model);
      buildFabUltra(scene, model, api);
      const art = api.worldArt;
      expect(art).toBe(scene.userData.worldArt);
      expect(art.palette).toBe(CAMPUS_PALETTE);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.frame.userData.foregroundFrame).toBe(true);
      expect(art.pathLighting.userData.pathLighting).toBe(true);
      expect(art.shaft.userData.lightShaft).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.lighting.key.userData.lightRole).toBe('key');
      expect(art.lighting.rim.userData.lightRole).toBe('rim');
      expect(art.lighting.rim.castShadow).toBe(false);
      expect(Object.keys(api.gates).length).toBe(model.gates.length);
      expect(Object.keys(api.beacons).length).toBe(model.districts.length);

      const shadowPointLights = [];
      let silicon = 0;
      scene.traverse(object => {
        if (object.isPointLight && object.castShadow) shadowPointLights.push(object);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (material?.userData?.surface === 'silicon') silicon += 1;
        });
        for (const vector of [object.position, object.rotation, object.scale]) {
          if (!vector) continue;
          expect([vector.x, vector.y, vector.z].every(Number.isFinite)).toBe(true);
        }
      });
      expect(shadowPointLights).toEqual([]);
      expect(silicon).toBeGreaterThan(3);
      expect(art.materialCoverage.pbr).toBeGreaterThan(8);
      expect(art.materialCoverage.textured).toBeGreaterThan(8);

      const progress = campusProgress({
        done: {}, doneNg: {}, lessons: {}, tapeoutDone: false, ngplus: false,
      });
      applyCampusProgress(api, model, progress);
      expect(api.gates[1].collider.off).toBe(true);
      expect(api.gates[2].collider.off).toBeFalsy();
    } finally {
      restore();
    }
  });
});

import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { WORLD_ART, buildWorldArt } from '../src/graphics/art-direction.js';

const model = {
  bounds: { minX: -40, maxX: 40, minZ: -60, maxZ: 20 },
  path: [{ x: 0, z: 10 }, { x: 0, z: -20 }, { x: 0, z: -45 }],
};

describe('cinematic art-direction layer', () => {
  test('defines a complete, distinct palette for campus and all seven worlds', () => {
    expect(Object.keys(WORLD_ART).map(Number).sort((a, b) => a - b))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(Object.values(WORLD_ART).map((entry) => entry.name)).size).toBe(8);
    Object.values(WORLD_ART).forEach((entry) => {
      expect(entry.density).toBeGreaterThanOrEqual(40);
      expect(Number.isInteger(entry.key)).toBe(true);
    });
  });

  test('builds one idempotent landmark, instanced-detail, atmosphere, and shaft layer', () => {
    for (let world = 0; world <= 7; world++) {
      const scene = new THREE.Scene();
      const art = buildWorldArt(scene, model, world);
      expect(scene.userData.worldArt).toBe(art);
      expect(art.landmark.userData.landmark).toBe(true);
      expect(art.detail.isInstancedMesh).toBe(true);
      expect(art.atmosphere.isPoints).toBe(true);
      expect(art.shaft.material.transparent).toBe(true);
      expect(art.shaft.castShadow).toBe(false);
      expect(art.grade.saturation).toBeGreaterThan(0.8);
      expect(Number.isInteger(art.grade.tint)).toBe(true);
      expect(buildWorldArt(scene, model, world)).toBe(art);
    }
  });

  test('registers finite animation and transform data', () => {
    const scene = new THREE.Scene();
    const art = buildWorldArt(scene, model, 5);
    expect(scene.userData.anims.length).toBeGreaterThan(0);
    scene.userData.anims.forEach((animate) => animate(1, 1 / 60));
    scene.traverse((object) => {
      expect(Number.isFinite(object.position.x)).toBe(true);
      expect(Number.isFinite(object.position.y)).toBe(true);
      expect(Number.isFinite(object.position.z)).toBe(true);
    });
    expect(art.landmark.children.length).toBeGreaterThan(2);
  });
});

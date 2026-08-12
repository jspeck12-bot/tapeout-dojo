import { describe, expect, test } from 'vitest';
import { LESSONS, WORLDS } from '../src/game/content.js';
import { normalizeSave } from '../src/app/save.js';
import { challengesOf } from '../src/world/challenges.js';
import { dungeonModel } from '../src/world/dungeon.js';
import {
  WORLD_LORE,
  elevationAt,
  featureComplete,
} from '../src/world/exploration.js';
import { mineModel } from '../src/world/mine.js';

function modelOf(world) {
  const lessonIds = (LESSONS[world] || []).map((lesson) => lesson.id);
  return world === 1
    ? mineModel(lessonIds)
    : dungeonModel(world, challengesOf(world), lessonIds);
}

describe('shared world exploration contract', () => {
  test('adds one grace, two history terminals, and three secrets to every world', () => {
    for (const world of WORLDS) {
      const model = modelOf(world.id);
      const features = model.exploration.features;
      expect(features.filter((feature) => feature.kind === 'grace')).toHaveLength(1);
      expect(features.filter((feature) => feature.kind === 'lore')).toHaveLength(2);
      expect(features.filter((feature) => feature.kind === 'cache')).toHaveLength(3);
      expect(new Set(features.map((feature) => feature.id)).size).toBe(6);
      expect(model.exploration.landmark.length).toBeGreaterThan(5);
    }
  });

  test('keeps every exploration feature inside walkable geometry and away from stations', () => {
    for (const world of WORLDS) {
      const model = modelOf(world.id);
      for (const feature of model.exploration.features) {
        expect(model.rects.some((rect) =>
          feature.x > rect.x1 && feature.x < rect.x2 &&
          feature.z > rect.z1 && feature.z < rect.z2)).toBe(true);
        expect(model.interactables.filter((item) => item.ord).every((station) =>
          Math.hypot(feature.x - station.x, feature.z - station.z) >= 5)).toBe(true);
      }
    }
  });

  test('provides smooth deterministic elevation metadata', () => {
    const model = modelOf(4);
    const zone = model.exploration.elevationZones[0];
    expect(elevationAt(model, zone.x, zone.z)).toBeCloseTo(zone.height);
    expect(elevationAt(model, zone.x + zone.radius, zone.z)).toBe(0);
    expect(elevationAt(model, zone.x + zone.radius / 2, zone.z))
      .toBeGreaterThan(0);
  });

  test('tracks discovery kinds independently and uses real history', () => {
    const model = modelOf(2);
    const save = normalizeSave(null);
    const [grace] = model.exploration.features.filter((feature) => feature.kind === 'grace');
    const [lore] = model.exploration.features.filter((feature) => feature.kind === 'lore');
    const [cache] = model.exploration.features.filter((feature) => feature.kind === 'cache');
    save.exploration.graces[grace.id] = true;
    save.exploration.lore[lore.id] = true;

    expect(featureComplete(save, grace)).toBe(true);
    expect(featureComplete(save, lore)).toBe(true);
    expect(featureComplete(save, cache)).toBe(false);
    expect(Object.values(WORLD_LORE).flat()).toHaveLength(14);
    expect(Object.values(WORLD_LORE).flat().some((entry) => /MOSFET/.test(entry.title))).toBe(true);
  });
});

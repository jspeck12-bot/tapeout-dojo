'use strict';

// Minimum scene-graph envelopes captured from the pre-modularization builders.
// Floors are intentionally 80% of the baseline so additions remain harmless
// while a gutted or accidentally disconnected scene fails immediately.
module.exports = {
  campus: { direct: 272, total: 303, rendered: 283, lights: 4 },
  mines: { direct: 259, total: 346, rendered: 306, lights: 22 },
  arcade: { direct: 48, total: 49, rendered: 40, lights: 7 },
  'dungeon-2': { direct: 144, total: 234, rendered: 204, lights: 15 },
  'dungeon-3': { direct: 210, total: 266, rendered: 229, lights: 16 },
  'dungeon-4': { direct: 118, total: 229, rendered: 189, lights: 19 },
  'dungeon-5': { direct: 219, total: 278, rendered: 236, lights: 19 },
  'dungeon-6': { direct: 175, total: 217, rendered: 192, lights: 12 },
  'dungeon-7': { direct: 153, total: 184, rendered: 169, lights: 8 },
};

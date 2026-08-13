'use strict';

// Minimum scene-graph envelopes captured from the pre-modularization builders.
// Floors are intentionally 80% of the baseline so additions remain harmless
// while a gutted or accidentally disconnected scene fails immediately.
module.exports = {
  campus: { direct: 272, total: 320, rendered: 290, lights: 11 },
  mines: { direct: 153, total: 328, rendered: 253, lights: 33 },
  arcade: { direct: 48, total: 49, rendered: 40, lights: 7 },
  'style-guide': { direct: 18, total: 70, rendered: 55, lights: 7 },
  'dungeon-2': { direct: 144, total: 234, rendered: 204, lights: 15 },
  'dungeon-3': { direct: 112, total: 266, rendered: 229, lights: 16 },
  'dungeon-4': { direct: 118, total: 229, rendered: 189, lights: 19 },
  'dungeon-5': { direct: 114, total: 278, rendered: 236, lights: 19 },
  'dungeon-6': { direct: 175, total: 217, rendered: 192, lights: 12 },
  'dungeon-7': { direct: 153, total: 184, rendered: 169, lights: 8 },
};

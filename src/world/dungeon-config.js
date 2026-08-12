const DUNGEON_CFG = {
  2: {
    zone: 'GATE VALLEY', bossZone: 'GOLEM GROUNDS',
    theme: { bg: 0x0a1206, fog: 0.026, floorCol: 0x10180a, gridCol: 0x3a5a1a, wallCol: 0x1c2a12, accent: 0xa3e635, ambient: 0.85, ceil: false, prop: 'arch' },
    descend: { label: 'ENTER GATE VALLEY', sub: 'Cross the valley. The gates judge every step. A golem waits at the far end.' },
  },
  3: {
    trail: { legs: 3, Lv: 48, H: 58, W: 24 }, chamberW: 40, chamberD: 34,
    zone: 'THE FOUNDRY FLOOR', bossZone: 'HIERARCH CORE',
    theme: { bg: 0x04101a, fog: 0.03, floorCol: 0x081722, gridCol: 0x155e6b, wallCol: 0x0c2630, accent: 0x22d3ee, ambient: 0.7, ceil: true, prop: 'pipe' },
    descend: { label: 'ENTER THE FOUNDRY', sub: 'Walk the foundry floor. Compile under heat. The Hierarch presides over the core.' },
  },
  4: {
    zone: 'THE CANYON', bossZone: 'COLOSSUS MESA',
    theme: { bg: 0x140a04, fog: 0.022, floorCol: 0x1c1108, gridCol: 0x7a4a1a, wallCol: 0x3a2412, accent: 0xfb923c, ambient: 0.88, ceil: false, prop: 'mesa' },
    descend: { label: 'DESCEND INTO THE CANYON', sub: 'Pick through the canyon. Pure logic, no memory. A colossus blocks the pass.' },
  },
  5: {
    trail: { legs: 4, Lv: 42, H: 48, W: 20 }, chamberW: 40, chamberD: 34,
    zone: 'THE CLOCKWORKS', bossZone: "THE TYRANT'S MOVEMENT",
    theme: { bg: 0x0c081a, fog: 0.03, floorCol: 0x140e22, gridCol: 0x5a3aa0, wallCol: 0x201838, accent: 0xa78bfa, ambient: 0.72, ceil: true, prop: 'gear' },
    descend: { label: 'CLIMB THE CLOCK TOWER', sub: 'Wind through the clockworks. Mind the rising edges. The Tyrant keeps time.' },
  },
  6: {
    trail: { legs: 2, Lv: 58, H: 70, W: 28 }, chamberW: 44, chamberD: 36,
    zone: 'FORTRESS HALLS', bossZone: 'THE THRONE STATE',
    theme: { bg: 0x12060a, fog: 0.03, floorCol: 0x1a0c10, gridCol: 0x7a2a3a, wallCol: 0x2e1820, accent: 0xfb7185, ambient: 0.76, ceil: true, prop: 'crenel' },
    descend: { label: 'STORM THE FORTRESS', sub: 'Breach the fortress halls. Every room is a state. The engine rules them all.' },
  },
  7: {
    trail: { legs: 2, Lv: 36, H: 44, W: 24 }, chamberW: 40, chamberD: 32,
    zone: 'THE TAPEOUT FLOOR', bossZone: 'THE ALTAR',
    theme: { bg: 0x12100a, fog: 0.02, floorCol: 0x1a1608, gridCol: 0x7a6310, wallCol: 0x2e2810, accent: 0xfacc15, ambient: 0.92, ceil: true, prop: 'altar' },
    descend: { label: 'WALK TO TAPEOUT', sub: 'One floor. One altar. One shot at silicon.' },
  },
};

export { DUNGEON_CFG };

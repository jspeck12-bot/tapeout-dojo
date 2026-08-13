import { mkBox } from './collision.js';
import { activeDone, challengesOf, worldUnlockedEx } from './challenges.js';

const CAMPUS_SIZE = 260;
const COURT_HALF = 28;
const CAMPUS_DISTRICTS = [
  { w: 1, name: 'Bit Mines', x: -75, z: 62, color: 0xFFB86B },
  { w: 2, name: 'Gate Valley', x: 75, z: 62, color: 0x7DEFFF },
  { w: 3, name: 'Module Foundry', x: -95, z: 0, color: 0xFB923C },
  { w: 4, name: 'Combinational Canyon', x: 95, z: 0, color: 0xA3E635 },
  { w: 5, name: 'Clock Tower', x: -75, z: -62, color: 0x22D3EE },
  { w: 6, name: 'FSM Fortress', x: 75, z: -62, color: 0xC4B5FD },
  { w: 7, name: 'TAPEOUT', x: 0, z: -95, color: 0xFACC15 },
];

function districtFacing(d) {
  const dx = -d.x, dz = -d.z;
  if (Math.abs(dx) >= Math.abs(dz)) return { fx: dx > 0 ? 1 : -1, fz: 0, side: dx > 0 ? '+x' : '-x' };
  return { fx: 0, fz: dz > 0 ? 1 : -1, side: dz > 0 ? '+z' : '-z' };
}

// Build the full walkable model: colliders, gates, interactables, layout anchors.
function campusModel() {
  const colliders = [];
  const gates = [];
  const interactables = [];
  const anchors = {}; // per-district placement info for builders

  // die edge (keep player on the platform)
  const H = CAMPUS_SIZE / 2, T = 6;
  colliders.push(mkBox(0, -H - T / 2, CAMPUS_SIZE + T * 2, T, 'edge'));
  colliders.push(mkBox(0, H + T / 2, CAMPUS_SIZE + T * 2, T, 'edge'));
  colliders.push(mkBox(-H - T / 2, 0, T, CAMPUS_SIZE + T * 2, 'edge'));
  colliders.push(mkBox(H + T / 2, 0, T, CAMPUS_SIZE + T * 2, 'edge'));

  const OPEN = 14;  // gate opening width
  const WT = 1.6;   // wall thickness

  CAMPUS_DISTRICTS.forEach(d => {
    const f = districtFacing(d);
    const C = COURT_HALF;
    // wall segments: 3 solid sides + flanks around the opening on the facing side
    const sides = ['+x', '-x', '+z', '-z'];
    sides.forEach(side => {
      const horiz = side === '+z' || side === '-z'; // wall runs along X
      const off = side === '+x' ? { x: C, z: 0 } : side === '-x' ? { x: -C, z: 0 } : side === '+z' ? { x: 0, z: C } : { x: 0, z: -C };
      const wx = d.x + off.x, wz = d.z + off.z;
      if (side === f.side) {
        // two flank segments leaving an OPEN gap in the middle
        const span = C * 2, flank = (span - OPEN) / 2;
        if (horiz) {
          colliders.push(mkBox(d.x - (OPEN / 2 + flank / 2), wz, flank, WT, 'wall' + d.w));
          colliders.push(mkBox(d.x + (OPEN / 2 + flank / 2), wz, flank, WT, 'wall' + d.w));
        } else {
          colliders.push(mkBox(wx, d.z - (OPEN / 2 + flank / 2), WT, flank, 'wall' + d.w));
          colliders.push(mkBox(wx, d.z + (OPEN / 2 + flank / 2), WT, flank, 'wall' + d.w));
        }
        // gate collider sits in the opening; toggled by progression
        const gateBox = horiz ? mkBox(d.x, wz, OPEN, WT, 'gate' + d.w) : mkBox(wx, d.z, WT, OPEN, 'gate' + d.w);
        colliders.push(gateBox);
        gates.push({ w: d.w, x: horiz ? d.x : wx, z: horiz ? wz : d.z, horiz, collider: gateBox, name: d.name });
      } else {
        if (horiz) colliders.push(mkBox(d.x, wz, C * 2 + WT, WT, 'wall' + d.w));
        else colliders.push(mkBox(wx, d.z, WT, C * 2 + WT, 'wall' + d.w));
      }
    });

    // placement anchors inside the courtyard
    const consolePos = { x: d.x + f.fx * 10, z: d.z + f.fz * 10 };
    const landmarkPos = { x: d.x - f.fx * 9, z: d.z - f.fz * 9 };
    const px = f.fz !== 0 ? 1 : 0, pz = f.fx !== 0 ? 1 : 0; // perpendicular axis
    const padPos = { x: d.x + px * 17 + f.fx * 16, z: d.z + pz * 17 + f.fz * 16 };
    anchors[d.w] = { facing: f, consolePos, landmarkPos, padPos };

    interactables.push({
      id: 'console' + d.w, kind: 'console', w: d.w,
      x: consolePos.x, z: consolePos.z, r: 3.4,
      prompt: 'OPEN ' + d.name.toUpperCase() + ' CONSOLE',
      target: { name: 'world', w: d.w },
    });
    interactables.push({
      id: 'pad' + d.w, kind: 'pad', w: d.w,
      x: padPos.x, z: padPos.z, r: 2.6,
      prompt: 'FAST TRAVEL',
      target: { name: 'fasttravel' },
    });
  });

  // plaza kiosks (always-reachable hub at origin)
  const plazaItems = [
    { id: 'k_training', label: 'TRAINING GROUNDS', x: -22, z: 16, target: { name: 'training' }, needsW3: true },
    { id: 'k_blitz', label: 'BINARY BLITZ', x: 22, z: 16, target: { name: 'blitz' } },
    { id: 'k_bugs', label: 'BUG BOUNTY', x: -22, z: -14, target: { name: 'bugs' }, needsW3: true },
    { id: 'k_ach', label: 'SERVICE RECORD', x: 22, z: -14, target: { name: 'ach' } },
    { id: 'k_manual', label: 'FIELD MANUAL', x: 7, z: 30, target: { name: 'manual' } },
    { id: 'k_shop', label: 'SCRAP EXCHANGE', x: -7, z: 30, target: { name: 'shop' } },
  ];
  plazaItems.forEach(k => {
    colliders.push(mkBox(k.x, k.z, 2.2, 2.2, k.id));
    interactables.push({ id: k.id, kind: 'arcade', x: k.x, z: k.z, r: 3.4, prompt: 'OPEN ' + k.label, target: k.target, needsW3: !!k.needsW3, label: k.label });
  });
  interactables.push({ id: 'pad_plaza', kind: 'pad', w: 0, x: 0, z: 44, r: 2.6, prompt: 'FAST TRAVEL', target: { name: 'fasttravel' } });

  return {
    colliders, gates, interactables, anchors,
    districts: CAMPUS_DISTRICTS,
    bounds: { minX: -CAMPUS_SIZE / 2, maxX: CAMPUS_SIZE / 2, minZ: -CAMPUS_SIZE / 2, maxZ: CAMPUS_SIZE / 2 },
    spawn: { x: 0, z: 96, yaw: 0 },
    padSpots: [{ w: 0, name: 'Central Plaza', x: 0, z: 44 }].concat(CAMPUS_DISTRICTS.map(d => ({ w: d.w, name: d.name, x: anchors[d.w].padPos.x, z: anchors[d.w].padPos.z }))),
  };
}

function campusProgress(save) {
  const perWorld = {};
  for (let w = 1; w <= 7; w++) {
    const chs = challengesOf(w);
    const dmap = activeDone(save);
    const done = chs.filter(c => dmap[c.id]).length;
    perWorld[w] = {
      unlocked: worldUnlockedEx(w, save),
      complete: chs.length > 0 && done === chs.length,
      frac: chs.length ? done / chs.length : 0,
    };
  }
  return { perWorld, tapeoutDone: save.tapeoutDone, ngplus: save.ngplus };
}

export {
  CAMPUS_SIZE, COURT_HALF, CAMPUS_DISTRICTS, districtFacing, campusModel,
  campusProgress,
};

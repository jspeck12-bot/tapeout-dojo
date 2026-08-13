const BOSS_SPECS = {
  b6: {
    world: 1,
    name: 'OVERFLOW OMEN',
    epithet: 'The Sign That Turned Against Itself',
    phases: ['TRUE RANGE', 'WRAPAROUND', 'SIGN REVERSAL'],
    mechanic: ['Read the width before the value.', 'Results now wrap at eight bits.', 'Trust the encoded sign, not the unbounded sum.'],
    reward: 'r_overflow',
  },
  g6: {
    world: 2,
    name: 'THE BUBBLE PUSHER',
    epithet: 'Universal Form, Inverted',
    phases: ['TRUTH TABLE', 'DE MORGAN', 'ALL-NAND FORM'],
    mechanic: ['Read every input row.', 'Push inversions through the gate.', 'Recognize equivalent hardware under pressure.'],
    reward: 'r_bubble',
  },
  m6: {
    world: 3,
    name: 'THE HIERARCH',
    epithet: 'Keeper of Ports and Wires',
    phases: ['INTERFACE', 'BUS ORDER', 'HIERARCHY'],
    mechanic: ['Match the module contract.', 'Wire every bit in the intended order.', 'One wrong connection corrupts the whole structure.'],
    reward: 'r_hierarch',
  },
  c7: {
    world: 4,
    name: 'PRIORITY ENCODER COLOSSUS',
    epithet: 'Only the Highest Strike Lands',
    phases: ['ONE-HOT', 'CONTENTION', 'PRIORITY'],
    mechanic: ['One request is simple.', 'Multiple requests assert together.', 'The highest-priority input must win.'],
    reward: 'r_encoder',
  },
  s7: {
    world: 5,
    name: 'THE SATURATING TYRANT',
    epithet: 'Lord of the Rising Edge',
    phases: ['CLOCK EDGE', 'NON-BLOCKING', 'SATURATION'],
    mechanic: ['Act on clock boundaries.', 'Every register samples old state together.', 'Clamp at the limit instead of wrapping.'],
    reward: 'r_tyrant',
  },
  f3: {
    world: 6,
    name: 'SEQUENCE DETECTOR 101',
    epithet: 'The Throne Remembers',
    phases: ['STATE TRACE', 'OVERLAP', 'PREDICTION'],
    mechanic: ['Infer the hidden state.', 'Preserve useful suffix history.', 'Predict the next transition to strike.'],
    reward: 'r_sequence',
  },
  chip1: {
    world: 7,
    name: 'CHIP-1',
    epithet: 'Silicon Prime · Final Sign-Off',
    phases: ['INTEGRATION', 'TIMING CLOSURE', 'TAPEOUT DEADLINE'],
    mechanic: ['State, control, and arithmetic must agree.', 'Every cycle is part of the contract.', 'Final phase: no hints, only verification.'],
    reward: 'r_tapeout',
  },
};

function bossSpec(id) {
  return BOSS_SPECS[id] || null;
}

function grantRemembrance(save, id) {
  const spec = bossSpec(id);
  if (!spec || save.remembrances[id]) return null;
  save.remembrances[id] = true;
  if (!save.owned.includes(spec.reward)) save.owned.push(spec.reward);
  return spec.reward;
}

export { BOSS_SPECS, bossSpec, grantRemembrance };

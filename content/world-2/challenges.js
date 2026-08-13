// ---------- truth-table challenge ----------
const TRUTH_CHALLENGES = [
  {
    id: 'g2', world: 2, title: 'Truth Forge', xp: 35,
    intro: "Fill in the complete truth table for the expression. Click the Y cells to toggle. Every row must be right — the table is the circuit's entire identity.",
    pool: [
      { label: 'Y = (A ^ B) & C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A ^ B) & C },
      { label: 'Y = (A | B) & ~C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A | B) & (C ? 0 : 1) },
      { label: 'Y = ~(A & B) | C', vars: ['A', 'B', 'C'], fn: (A, B, C) => ((A & B) ^ 1) | C },
      { label: 'Y = (A & B) ^ C', vars: ['A', 'B', 'C'], fn: (A, B, C) => (A & B) ^ C },
      { label: 'Y = A & (B | C)', vars: ['A', 'B', 'C'], fn: (A, B, C) => A & (B | C) },
    ]
  }
];

export { TRUTH_CHALLENGES };

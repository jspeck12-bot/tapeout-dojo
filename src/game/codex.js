const NOTE_RECALL = {
  L1a: { topic: 'numbers', prompt: 'Why can digital hardware represent information reliably with 0 and 1?', options: ['Transistors provide two stable operating regions', 'Binary needs no physical circuitry', 'Every voltage is exactly zero or one'], correct: 0 },
  L1b: { topic: 'numbers', prompt: 'One hexadecimal digit represents how many binary bits?', options: ['2', '4', '8'], correct: 1 },
  L1c: { topic: 'numbers', prompt: "To negate a two's-complement bit pattern, what operation is used?", options: ['Shift left once', 'Invert every bit, then add one', 'Clear the sign bit'], correct: 1 },
  L1d: { topic: 'numbers', prompt: "What is the signed range of an 8-bit two's-complement value?", options: ['−128…127', '−127…128', '0…255'], correct: 0 },
  L2a: { topic: 'gates', prompt: 'When are two combinational circuits logically equivalent?', options: ['They use the same gate symbols', 'Their truth tables match for every input', 'They contain the same number of wires'], correct: 1 },
  L2b: { topic: 'boolean', prompt: 'Why is NAND called universal?', options: ['It stores one bit', 'Any Boolean circuit can be built from NAND gates', 'It has no propagation delay'], correct: 1 },
  L2c: { topic: 'boolean', prompt: "De Morgan transforms ~(A & B) into which expression?", options: ['~A & ~B', '~A | ~B', 'A | B'], correct: 1 },
  L2d: { topic: 'boolean', prompt: 'What does A | (A & B) simplify to?', options: ['A', 'B', 'A & B'], correct: 0 },
  L3a: { topic: 'wiring', prompt: 'What does a Verilog module describe?', options: ['A sequence of CPU instructions', 'Hardware with named ports and internal logic', 'Only a simulation test'], correct: 1 },
  L3b: { topic: 'gates', prompt: 'What hardware does `assign y = a & b;` create?', options: ['A permanent combinational connection through an AND gate', 'A command that runs once', 'A flip-flop'], correct: 0 },
  L3c: { topic: 'wiring', prompt: 'What does `{a, b}` do in Verilog?', options: ['Adds a and b', 'Concatenates their bits into a wider bus', 'Compares their widths'], correct: 1 },
  L3d: { topic: 'wiring', prompt: "In `8'hA5`, what does 8 specify?", options: ['Decimal base', 'Signal delay', 'Bit width'], correct: 2 },
  L4a: { topic: 'mux', prompt: 'What selects which mux input reaches its output?', options: ['The clock period', 'The select signal', 'The output width'], correct: 1 },
  L4b: { topic: 'arith', prompt: 'A full adder produces which two outputs?', options: ['sum and carry', 'data and clock', 'address and enable'], correct: 0 },
  L4c: { topic: 'decode', prompt: 'A 2-to-4 decoder normally asserts how many outputs for one valid input?', options: ['One', 'Two', 'Four'], correct: 0 },
  L4d: { topic: 'mux', prompt: 'How do you avoid an unintended latch in `always @(*)`?', options: ['Use non-blocking assignments', 'Assign every output on every path', 'Remove the sensitivity list'], correct: 1 },
  L5a: { topic: 'seq', prompt: 'When does a positive-edge D flip-flop sample D?', options: ['Continuously', 'At the rising clock edge', 'Only while reset is high'], correct: 1 },
  L5b: { topic: 'seq', prompt: 'Which assignment operator belongs in clocked sequential logic?', options: ['=', '<=', '=='], correct: 1 },
  L5c: { topic: 'seq', prompt: 'What does an enable do when it is low?', options: ['Forces every register high', 'Lets the register hold its prior value', 'Inverts the clock'], correct: 1 },
  L5d: { topic: 'seq', prompt: 'Why does a 4-bit counter wrap after 15?', options: ['Its next value is truncated to four stored bits', 'The clock stops', 'Addition becomes subtraction'], correct: 0 },
  L6a: { topic: 'fsm', prompt: 'What stores an FSM’s current state?', options: ['A combinational decoder', 'A register', 'A continuous assignment'], correct: 1 },
  L6b: { topic: 'fsm', prompt: 'What default is commonly assigned in next-state logic?', options: ['Stay in the current state', 'Always return to reset', 'An unknown value'], correct: 0 },
  L6c: { topic: 'fsm', prompt: 'What does sequence-detector state remember?', options: ['Every prior input bit verbatim', 'How much of the target pattern has matched', 'Only the clock count'], correct: 1 },
  L7a: { topic: 'integration', prompt: 'What makes CHIP-1 more than a standalone ALU?', options: ['It combines state, control, and arithmetic in one datapath', 'It uses decimal signals', 'It has no clock'], correct: 0 },
  L7b: { topic: 'integration', prompt: 'What does tapeout mean in a real chip project?', options: ['The design is released for fabrication', 'The simulator is opened', 'The clock is disabled'], correct: 0 },
};

const NOTE_HOOKS = {
  numbers: 'These bit patterns appear in register maps, waveforms, and every hardware debugger you will use.',
  gates: 'This expression becomes physical transistors and propagation delay after synthesis.',
  boolean: 'Equivalent Boolean forms let synthesis remove gates, shorten paths, and cut power.',
  wiring: 'Most RTL bugs are wrong widths or wrong connections—not difficult algorithms.',
  mux: 'Datapaths are networks of choices; muxes decide which value moves forward.',
  arith: 'Arithmetic operators hide real carry chains, width growth, and timing cost.',
  decode: 'Decoders turn compact control fields into one-hot physical actions.',
  seq: 'Clocked state is what lets a circuit remember one cycle and act in the next.',
  fsm: 'Controllers reduce history to state, then use that state to make the next decision.',
  integration: 'Real chips become useful when arithmetic, state, and control are wired together.',
};

const NOTE_WIDGET = {
  numbers: 'number',
  gates: 'gate',
  boolean: 'gate',
  wiring: 'compiler',
  mux: 'mux',
  arith: 'mux',
  decode: 'mux',
  seq: 'wave',
  fsm: 'wave',
  integration: 'pipeline',
};

function noteMeta(lessonId) {
  const recall = NOTE_RECALL[lessonId];
  if (!recall) throw new Error(`Missing Codex recall metadata for ${lessonId}`);
  return {
    ...recall,
    hook: NOTE_HOOKS[recall.topic],
    widget: NOTE_WIDGET[recall.topic],
  };
}

export { NOTE_HOOKS, NOTE_RECALL, NOTE_WIDGET, noteMeta };

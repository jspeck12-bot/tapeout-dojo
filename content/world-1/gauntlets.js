import { genB1, genB2, genB3, genB4, genB5, genB6 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'b1', world: 1, title: 'Binary Bedrock', xp: 30, gen: genB1, intro: 'Five conversions between binary and decimal, 4 bits at a time. The pickaxe work every engineer starts with.' },
  { id: 'b2', world: 1, title: 'Heavy Bits', xp: 30, gen: genB2, intro: 'Same game, full bytes. 8-bit conversions — learn to see 128s and 64s at a glance.' },
  { id: 'b3', world: 1, title: 'Hex Runes', xp: 30, gen: genB3, intro: 'Hex is binary with the boring parts compressed. One digit per nibble — never do math across the boundary.' },
  { id: 'b4', world: 1, title: 'The Sign Bit', xp: 35, gen: genB4, intro: "Two's complement reading. The MSB is negative; everything else is normal. Decode the values." },
  { id: 'b5', world: 1, title: 'Negation Ritual', xp: 35, gen: genB5, intro: 'Invert every bit, add one. Encode negative numbers the way the silicon does.' },
  { id: 'b6', world: 1, title: 'Overflow Omen', xp: 35, gen: genB6, intro: 'Ranges and the wraparound that ate a rocket. Know exactly where the cliff edge is.' },
];

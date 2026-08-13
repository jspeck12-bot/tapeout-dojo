import { genG1, genG3, genG4, genG5, genG6, genG7 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'g1', world: 2, title: 'Meet the Gates', xp: 30, gen: genG1, intro: "A truth table is a gate's fingerprint. Identify the suspect from its prints." },
  { id: 'g3', world: 2, title: 'Universal Workshop', xp: 30, gen: genG3, intro: 'NAND and NOR can build anything — including each other. Work the inverted gates.' },
  { id: 'g4', world: 2, title: "De Morgan's Mirror", xp: 30, gen: genG4, intro: 'Break the bar, flip the operator. The most-used identity in all of digital design.' },
  { id: 'g5', world: 2, title: 'Boolean Cleanup', xp: 30, gen: genG5, intro: 'Fewer gates, same truth table. Simplify like a synthesis tool.' },
  { id: 'g6', world: 2, title: 'Bubble Pusher', xp: 35, gen: genG6, intro: 'Slide inversion bubbles through gates and watch AND and OR trade places.' },
  { id: 'g7', world: 2, title: 'Karnaugh Forge', xp: 35, gen: genG7, intro: 'Fewer gates, same truth. Spot the minimal form the way a Karnaugh map (and a synthesis tool) would.' },
];

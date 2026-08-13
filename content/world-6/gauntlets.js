import { genF1, genF4 } from '../gens.js';

export const GAUNTLETS = [
  { id: 'f1', world: 6, title: 'State Tracer', xp: 35, gen: genF1, intro: 'Before you build state machines, learn to BE one. Trace this "detect 10" Moore machine by hand, cycle by cycle.' },
  { id: 'f4', world: 6, title: 'Encoding Vault', xp: 40, gen: genF4, intro: 'Binary or one-hot? Count the flip-flops and weigh the trade. Moore versus Mealy while you are in here.' },
];

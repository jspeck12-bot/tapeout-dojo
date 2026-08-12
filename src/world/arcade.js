import { mineWalls } from './layout.js';

function arcadeModel() {
  const rects = [
    { x1: -22, z1: -22, x2: 22, z2: 26, zone: 'THE ARCADE' },
    { x1: -4, z1: 26, x2: 4, z2: 32, zone: 'ARCADE LANDING' },
  ];
  const { walls, bounds } = mineWalls(rects);
  const cabs = [
    { id: 'a_training', x: -14, z: -18, target: { name: 'training' }, label: 'TRAINING GROUNDS', accent: '#7DEFFF' },
    { id: 'a_blitz', x: 0, z: -18, target: { name: 'blitz' }, label: 'BINARY BLITZ', accent: '#FF7DF0' },
    { id: 'a_bugs', x: 14, z: -18, target: { name: 'bugs' }, label: 'BUG BOUNTY', accent: '#FFC76B' },
    { id: 'a_ach', x: -18, z: -2, target: { name: 'ach' }, label: 'SERVICE RECORD', accent: '#A3E635' },
    { id: 'a_saves', x: -18, z: 10, target: { name: 'profiles' }, label: 'SAVE TERMINAL', accent: '#7DEFFF' },
    { id: 'a_manual', x: 18, z: -2, target: { name: 'manual' }, label: 'FIELD MANUAL', accent: '#9FB4FF' },
    { id: 'a_shop', x: 18, z: 10, target: { name: 'shop' }, label: 'SCRAP EXCHANGE', accent: '#FFE27A' },
  ];
  const interactables = cabs.map(c => ({ ...c, kind: 'arcade', r: 3.0 }));
  interactables.push({ id: 'lift', kind: 'exit', x: 0, z: 29, r: 2.6, target: { name: 'menu' }, label: 'MAIN MENU', accent: '#FF8B82' });
  return { rects, colliders: walls, interactables, bounds, spawn: { x: 0, z: 20, yaw: 0 } };
}

export { arcadeModel };

const ITEMS = [
  { id: 'w_iron', slot: 'weapon', name: 'Iron Probe', cost: 0, atk: 10, blurb: 'Standard issue. Pokes logic.' },
  { id: 'w_copper', slot: 'weapon', name: 'Copper Probe', cost: 120, atk: 25, blurb: 'Low resistance, firm contact. Every good run buys more quiet.' },
  { id: 'w_lance', slot: 'weapon', name: 'Logic Lance', cost: 300, atk: 40, scrapMult: 1.10, blurb: 'Salvage hook on the shaft — +10% scrap.' },
  { id: 'w_kelvin', slot: 'weapon', name: 'Kelvin Probe', cost: 650, atk: 60, lifesteal: 8, blurb: 'Four-wire precision. Recover 8 HP on every improving run.' },
  { id: 'a_cloth', slot: 'armor', name: 'Cotton Coat', cost: 0, hp: 0, def: 0, blurb: 'It has pockets.' },
  { id: 'a_wrap', slot: 'armor', name: 'Static Wrap', cost: 100, hp: 20, def: 0.10, blurb: 'Grounded at the wrist. +20 HP, −10% damage taken.' },
  { id: 'a_bunny', slot: 'armor', name: 'Bunny Suit', cost: 280, hp: 50, def: 0.20, blurb: 'Cleanroom rated. The particles fear you. +50 HP, −20%.' },
  { id: 'a_mail', slot: 'armor', name: 'Faraday Mail', cost: 600, hp: 90, def: 0.30, blurb: 'A walking ground plane. +90 HP, −30%.' },
  { id: 't_sink', slot: 'tool', name: 'Heatsink Charm', cost: 250, timer: 1.25, blurb: '+25% on boss timers. Thermal headroom is time.' },
  { id: 't_scope', slot: 'tool', name: 'Pocket Scope', cost: 220, hint: 1, blurb: '+1 hint charge in every fight, any difficulty.' },
  { id: 't_jtag', slot: 'tool', name: 'JTAG Talisman', cost: 180, slow: 1.15, blurb: 'Enemy attacks wind up 15% slower. You see them coming.' },
  { id: 'c_solder', slot: 'consumable', inv: 'potions', name: 'Solder Ration', cost: 30, heal: 40, blurb: 'Restores 40 HP mid-fight. Tastes like flux. Carry 5.' },
  { id: 'c_flux', slot: 'consumable', inv: 'flux', name: 'Flux Vial', cost: 25, blurb: 'Triples the suppression of your next improving run. Carry 5.' },
];
const ITEM_BY_ID = {};
ITEMS.forEach(i => { ITEM_BY_ID[i.id] = i; });

export { ITEMS, ITEM_BY_ID };

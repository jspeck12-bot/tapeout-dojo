// ============================================================
// RPG SPINE — levels, gear, enemies (pure, testable)
// ============================================================

const LEVEL_BASE = 80;
function levelFromXp(xp) {
  let l = 1, need = LEVEL_BASE, acc = 0;
  while ((xp || 0) >= acc + need && l < 60) { acc += need; l++; need = LEVEL_BASE * l; }
  return l;
}

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

function derivedStats(save) {
  const lvl = levelFromXp(save.xp || 0);
  const g = save.gear || {};
  const W = ITEM_BY_ID[g.weapon] || ITEM_BY_ID.w_iron;
  const A = ITEM_BY_ID[g.armor] || ITEM_BY_ID.a_cloth;
  const T = g.tool ? ITEM_BY_ID[g.tool] : null;
  return {
    lvl,
    maxHp: 100 + 14 * (lvl - 1) + (A.hp || 0),
    atk: 20 + 4 * (lvl - 1) + (W.atk || 0),
    defPct: Math.min(0.6, A.def || 0),
    scrapMult: W.scrapMult || 1,
    lifesteal: W.lifesteal || 0,
    timerMult: (T && T.timer) || 1,
    hintBonus: (T && T.hint) || 0,
    slowMult: (T && T.slow) || 1,
  };
}

const ENEMY_FAMILIES = {
  1: { fam: ['Bit Imp', 'Nibble Gnawer', 'Carry Beetle', 'Sign Wraith', 'Overflow Shade', 'Parity Rat'], boss: 'THE TWOS-COMPLEMENT WYRM' },
  2: { fam: ['Gate Hound', 'NAND Golem', 'Bubble Fiend', 'Truth Spider', 'DeMorgan Twin', 'Mux Mimic'], boss: 'THE UNIVERSAL GOLEM' },
  3: { fam: ['Port Gremlin', 'Wire Tangler', 'Module Shade', 'Instance Doppel', 'Testbench Husk'], boss: 'THE HIERARCH' },
  4: { fam: ['Adder Viper', 'Priority Stalker', 'Decoder Husk', 'Shift Serpent', 'Compare Wretch'], boss: 'THE COMBINATIONAL COLOSSUS' },
  5: { fam: ['Edge Phantom', 'Latch Leech', 'Counter Revenant', 'Reset Banshee', 'Enable Ghoul'], boss: 'THE CLOCK TYRANT' },
  6: { fam: ['State Husk', 'Moore Wisp', 'Mealy Stalker', 'Transition Fiend', 'Deadlock Shade'], boss: 'THE STATE ENGINE' },
  7: { fam: ['Fab Sentinel', 'Yield Reaper'], boss: 'SILICON PRIME' },
};

function enemyFor(id, world, xp, isBoss, mode, ng) {
  const fam = ENEMY_FAMILIES[world] || ENEMY_FAMILIES[1];
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const name = isBoss ? fam.boss : fam.fam[h % fam.fam.length];
  const m = mode === 'apprentice' ? { dmg: 0.6, int: 1.6 }
    : mode === 'architect' ? { dmg: 1.25, int: 0.9 }
      : { dmg: 1, int: 1 };
  const wM = 1 + 0.15 * (world - 1);
  const ngM = ng ? 1.5 : 1;
  return {
    id, name, world, boss: !!isBoss,
    hp: Math.round((40 + (xp || 30) * 1.8) * wM * (isBoss ? 2.4 : 1)),
    atk: Math.round((7 + world * 3) * m.dmg * ngM * (isBoss ? 1.7 : 1)),
    interval: Math.max(6, (17 - world) * m.int * (isBoss ? 0.8 : 1)),
    counter: Math.round((5 + world * 2) * m.dmg * ngM),
    scrap: Math.round((12 + (xp || 30) * 0.55) * wM * (isBoss ? 2.5 : 1) * ngM),
    grace: isBoss ? 10 : 8,
  };
}

// guarantee RPG fields on any loaded/imported save (covers legacy + retro grant)
function rpgFix(s) {
  if (s.scrap === undefined) s.scrap = (s.xp || 0) > 0 ? 150 + Math.floor((s.xp || 0) / 2) : 0;
  if (!s.gear || typeof s.gear !== 'object') s.gear = { weapon: 'w_iron', armor: 'a_cloth', tool: null };
  if (!ITEM_BY_ID[s.gear.weapon]) s.gear.weapon = 'w_iron';
  if (!ITEM_BY_ID[s.gear.armor]) s.gear.armor = 'a_cloth';
  if (s.gear.tool && !ITEM_BY_ID[s.gear.tool]) s.gear.tool = null;
  if (!Array.isArray(s.owned)) s.owned = [];
  ['w_iron', 'a_cloth'].forEach(x => { if (!s.owned.includes(x)) s.owned.push(x); });
  if (!s.inv || typeof s.inv !== 'object') s.inv = {};
  s.inv = { potions: Math.max(0, Math.min(5, s.inv.potions | 0)), flux: Math.max(0, Math.min(5, s.inv.flux | 0)) };
  if (!s.combat || typeof s.combat !== 'object') s.combat = {};
  s.combat = {
    kills: Math.max(0, s.combat.kills | 0),
    deaths: Math.max(0, s.combat.deaths | 0),
    flawless: Math.max(0, s.combat.flawless | 0),
  };
  if (s.lvlSeen === undefined) s.lvlSeen = levelFromXp(s.xp || 0);
  return s;
}

export {
  LEVEL_BASE,
  levelFromXp,
  ITEMS,
  ITEM_BY_ID,
  derivedStats,
  ENEMY_FAMILIES,
  enemyFor,
  rpgFix,
};

// ---------- achievements & ranks ----------
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Complete your first challenge', xp: 10 },
  { id: 'it_compiles', name: 'It Compiles', desc: 'Pass your first Verilog code challenge', xp: 25 },
  { id: 'w1_done', name: 'Bit Lord', desc: 'Clear The Bit Mines', xp: 30 },
  { id: 'w2_done', name: 'Gatekeeper', desc: 'Clear Gate Valley', xp: 30 },
  { id: 'w3_done', name: 'Forged', desc: 'Clear Module Foundry', xp: 30 },
  { id: 'w4_done', name: 'Canyon Crosser', desc: 'Clear Combinational Canyon', xp: 30 },
  { id: 'w5_done', name: 'Timekeeper', desc: 'Clear The Clock Tower', xp: 30 },
  { id: 'w6_done', name: 'State of Mind', desc: 'Clear FSM Fortress', xp: 30 },
  { id: 'tapeout', name: 'TAPEOUT', desc: 'Ship CHIP-1', xp: 150 },
  { id: 'blitz_15', name: 'Nibble Ninja', desc: 'Score 15+ in Binary Blitz', xp: 25 },
  { id: 'blitz_30', name: 'Byte Lord', desc: 'Score 30+ in Binary Blitz', xp: 50 },
  { id: 'combo_10', name: 'Overclocked', desc: 'Hit a 10× combo in Binary Blitz', xp: 25 },
  { id: 'bug_5', name: 'Exterminator', desc: 'Squash 5 bugs in Bug Bounty', xp: 20 },
  { id: 'bug_all', name: 'Lint Champion', desc: 'Squash all 12 bugs', xp: 40 },
  { id: 'stars_10', name: 'Perfectionist', desc: 'Earn 3★ on 10 challenges', xp: 40 },
  { id: 'streak_3', name: 'Back Again', desc: '3-day streak', xp: 15 },
  { id: 'streak_7', name: 'Week of Silicon', desc: '7-day streak', xp: 40 },
  { id: 'scholar', name: 'Scholar', desc: 'Read every lesson', xp: 30 },
  { id: 'second_silicon', name: 'Second Silicon', desc: 'Ship CHIP-2 in New Game+', xp: 100 },
  { id: 'iron_architect', name: 'Iron Architect', desc: 'Clear 10 challenges in Architect mode', xp: 60 },
  { id: 'daily_7', name: 'Range Regular', desc: 'Complete 7 daily benches', xp: 30 },
  { id: 'forge_25', name: 'Foundry Shift', desc: '25 training-ground clears', xp: 30 },
];

const RANKS = [
  ['Intern', 0],
  ['Junior RTL Engineer', 100],
  ['RTL Engineer I', 250],
  ['RTL Engineer II', 500],
  ['Senior RTL Engineer', 850],
  ['Staff Engineer', 1300],
  ['Principal Engineer', 1850],
  ['Distinguished Engineer', 2500],
  ['Chief Architect', 3300],
];

export { ACHIEVEMENTS, RANKS };

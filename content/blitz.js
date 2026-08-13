import { rInt, rPick, toBin, toHex, checkDec, checkBin, checkHex, checkBinOrHex } from './util.js';

// ---------- Binary Blitz ----------
function blitzGen(score, rng) {
  let pool;
  if (score < 6) pool = ['b2d4', 'd2b4'];
  else if (score < 13) pool = ['b2d4', 'd2b4', 'h2d', 'd2h', 'b2h', 'h2b'];
  else if (score < 21) pool = ['b2d8', 'd2b8', 'h2d', 'd2h', 'b2h', 'h2b'];
  else pool = ['b2d8', 'd2b8', 'h2d', 'd2h', 'b2h', 'h2b', 'twos', 'neg'];
  const t = rPick(rng, pool);
  switch (t) {
    case 'b2d4': { const v = rInt(rng, 1, 15); return { text: toBin(v, 4), sub: 'binary → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2b4': { const v = rInt(rng, 1, 15); return { text: String(v), sub: 'decimal → binary', check: checkBin(v), answer: toBin(v, 4) }; }
    case 'b2d8': { const v = rInt(rng, 16, 254); return { text: toBin(v, 8), sub: 'binary → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2b8': { const v = rInt(rng, 16, 254); return { text: String(v), sub: 'decimal → binary (8-bit)', check: checkBin(v), answer: toBin(v, 8) }; }
    case 'h2d': { const v = rInt(rng, 16, 255); return { text: '0x' + toHex(v, 8), sub: 'hex → decimal', check: checkDec(v), answer: String(v) }; }
    case 'd2h': { const v = rInt(rng, 16, 255); return { text: String(v), sub: 'decimal → hex', check: checkHex(v), answer: '0x' + toHex(v, 8) }; }
    case 'b2h': { const v = rInt(rng, 1, 255); return { text: toBin(v, 8), sub: 'binary → hex', check: checkHex(v), answer: '0x' + toHex(v, 8) }; }
    case 'h2b': { const v = rInt(rng, 1, 255); return { text: '0x' + toHex(v, 8), sub: 'hex → binary', check: checkBin(v), answer: toBin(v, 8) }; }
    case 'twos': { const v = rInt(rng, 128, 255); return { text: toBin(v, 8), sub: "8-bit two's comp → signed decimal", check: checkDec(v - 256), answer: String(v - 256) }; }
    default: { const n = rInt(rng, 5, 125); return { text: '−' + n, sub: "→ 8-bit two's comp (bin or hex)", check: checkBinOrHex(256 - n), answer: '0x' + toHex(256 - n, 8) }; }
  }
}

export { blitzGen };

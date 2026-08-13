// Shared authoring helpers — RNG, number checks, exhaustive combinational benches.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function rPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function toBin(v, w) {
  let s = (v >>> 0).toString(2).padStart(w, '0');
  if (w === 8) s = s.slice(0, 4) + '_' + s.slice(4);
  if (w === 16) s = s.match(/.{4}/g).join('_');
  return s;
}
function toHex(v, w) { return (v >>> 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0'); }
function normNum(str) { return (str || '').trim().toLowerCase().replace(/[\s_]/g, ''); }
function checkDec(target) {
  return (s) => {
    const t = normNum(s).replace(/^\+/, '');
    if (!/^-?\d+$/.test(t)) return false;
    return parseInt(t, 10) === target;
  };
}
function checkBin(target) {
  return (s) => {
    let t = normNum(s).replace(/^0b/, '').replace(/^'b/, '');
    if (!/^[01]+$/.test(t) || t.length > 33) return false;
    return parseInt(t, 2) === target;
  };
}
function checkHex(target) {
  return (s) => {
    let t = normNum(s).replace(/^0x/, '').replace(/^'h/, '');
    if (!/^[0-9a-f]+$/.test(t)) return false;
    return parseInt(t, 16) === target;
  };
}
function checkBinOrHex(target) {
  const b = checkBin(target), h = checkHex(target);
  return (s) => {
    const t = normNum(s);
    if (/^(0b|'b)/.test(t)) return b(s);
    if (/^(0x|'h)/.test(t)) return h(s);
    if (/^[01]+$/.test(t) && t.length >= 4) return b(s);
    return h(s) || b(s);
  };
}

// ---------- code challenge helpers ----------
function combVecs(inputs, ref, opts = {}) {
  const totalBits = inputs.reduce((s, p) => s + p.w, 0);
  const vectors = [];
  const addVec = (vals) => {
    const inObj = {};
    inputs.forEach((p, i) => { inObj[p.n] = vals[i]; });
    vectors.push({ in: inObj, out: ref(inObj) });
  };
  if (totalBits <= 8 && !opts.sample) {
    for (let x = 0; x < Math.pow(2, totalBits); x++) {
      let rem = x;
      const vals = inputs.map(p => { const v = rem % Math.pow(2, p.w); rem = Math.floor(rem / Math.pow(2, p.w)); return v; });
      addVec(vals);
    }
    return vectors;
  }
  const rng = mulberry32(opts.seed || 1337);
  const edgeOf = (w) => [0, 1, Math.pow(2, w) - 1, Math.pow(2, w - 1) % Math.pow(2, w), 0b10101010 % Math.pow(2, w), 0b01010101 % Math.pow(2, w)];
  const seen = new Set();
  const tryAdd = (vals) => { const k = vals.join(','); if (seen.has(k)) return; seen.add(k); addVec(vals); };
  for (let e = 0; e < 4; e++) tryAdd(inputs.map(p => edgeOf(p.w)[e % 6]));
  let guard = 0;
  while (vectors.length < (opts.n || 16) && guard++ < 500) tryAdd(inputs.map(p => rInt(rng, 0, Math.pow(2, p.w) - 1)));
  return vectors;
}

const m8w = (x) => ((x % 256) + 256) % 256;

export {
  mulberry32, rInt, rPick, toBin, toHex, normNum,
  checkDec, checkBin, checkHex, checkBinOrHex,
  combVecs, m8w,
};

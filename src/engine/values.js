// ============================================================
// FOUR-STATE LOGIC
//
// Encoding (two planes + Z mask), per bit:
//   0 : xz=0, z=0, v=0
//   1 : xz=0, z=0, v=1
//   X : xz=1, z=0, v=0   (unknown)
//   Z : xz=1, z=1, v=0   (high-impedance)
//
// Arithmetic on the value plane is only meaningful for known bits.
// This matches Verilator's aval/bval split, with Z distinguished from X
// so tri-state resolution can see Hi-Z.
// ============================================================

function maskW(v, w) { const m = Math.pow(2, w); return ((v % m) + m) % m; }
function maskBits(w) { return w >= 32 ? 0xFFFFFFFF : (Math.pow(2, w) - 1); }

function logic01(v, w) {
  return { v: maskW(v, w), xz: 0, z: 0, w };
}
function logicX(w) {
  const m = maskBits(w);
  return { v: 0, xz: m, z: 0, w };
}
function logicZ(w) {
  const m = maskBits(w);
  return { v: 0, xz: m, z: m, w };
}
function asLogic(x, w) {
  if (x && typeof x === 'object' && 'v' in x) {
    const srcW = x.w || 1;
    const ww = w || srcW;
    const srcM = maskBits(srcW);
    const m = maskBits(ww);
    return {
      v: (x.v & srcM) & m,
      xz: ((x.xz || 0) & srcM) & m,
      z: ((x.z || 0) & srcM) & m,
      w: ww,
    };
  }
  return logic01(x == null ? 0 : x, w || 1);
}
function logicSame(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const w = Math.max((a && a.w) || 1, (b && b.w) || 1);
  const A = asLogic(a, w), B = asLogic(b, w);
  return A.v === B.v && A.xz === B.xz && A.z === B.z;
}
function isFullyKnown(L) { return !L.xz; }
function isFullyX(L) { return L.xz === maskBits(L.w) && L.z === 0; }
function bitAt(L, i) {
  const bit = 1 << i;
  if (L.z & bit) return 'z';
  if (L.xz & bit) return 'x';
  return (L.v & bit) ? 1 : 0;
}
function logicFromBits(bits) {
  let v = 0, xz = 0, z = 0;
  const w = bits.length;
  for (let i = 0; i < w; i++) {
    const b = bits[i];
    const bit = 1 << i;
    if (b === 'z') { xz |= bit; z |= bit; }
    else if (b === 'x') xz |= bit;
    else if (b === 1 || b === '1') v |= bit;
  }
  return { v, xz, z, w };
}

function and1(a, b) {
  if (a === 0 || b === 0) return 0;
  if (a === 1 && b === 1) return 1;
  return 'x';
}
function or1(a, b) {
  if (a === 1 || b === 1) return 1;
  if (a === 0 && b === 0) return 0;
  return 'x';
}
function xor1(a, b) {
  if (a === 'x' || a === 'z' || b === 'x' || b === 'z') return 'x';
  return (a ? 1 : 0) ^ (b ? 1 : 0);
}
function not1(a) {
  if (a === 0) return 1;
  if (a === 1) return 0;
  return 'x';
}

function mapBits(a, b, w, fn) {
  const bits = [];
  const ww = w || Math.max(a.w, b ? b.w : 0);
  const A = asLogic(a, ww), B = b == null ? null : asLogic(b, ww);
  for (let i = 0; i < ww; i++) bits.push(fn(bitAt(A, i), B ? bitAt(B, i) : 0));
  return logicFromBits(bits);
}

function logicNot(a) { return mapBits(a, null, a.w, (x) => not1(x)); }
function logicAnd(a, b, w) { return mapBits(a, b, w, and1); }
function logicOr(a, b, w) { return mapBits(a, b, w, or1); }
function logicXor(a, b, w) { return mapBits(a, b, w, xor1); }
function logicXnor(a, b, w) { return mapBits(a, b, w, (x, y) => not1(xor1(x, y))); }

function reduction(L, fn, ident) {
  let acc = ident;
  for (let i = 0; i < L.w; i++) acc = fn(acc, bitAt(L, i));
  return logicFromBits([acc]);
}

function logicEqCase(a, b) {
  // === exact 4-state match, result always 0/1
  return logic01(logicSame(a, b) ? 1 : 0, 1);
}
function logicEq(a, b) {
  // == : X if any unknown, else 0/1
  const w = Math.max(a.w, b.w);
  const A = asLogic(a, w), B = asLogic(b, w);
  if (A.xz || B.xz) return logicX(1);
  return logic01(A.v === B.v ? 1 : 0, 1);
}
function logicNeq(a, b) {
  const eq = logicEq(a, b);
  if (eq.xz) return logicX(1);
  return logic01(eq.v ? 0 : 1, 1);
}
function logicNeqCase(a, b) {
  return logic01(logicSame(a, b) ? 0 : 1, 1);
}

function knownNumber(L) {
  if (!L || L.xz) return null;
  return L.v;
}

function logicArith(op, a, b, wOut) {
  if (a.xz || b.xz) return logicX(wOut);
  let n;
  switch (op) {
    case '+': n = a.v + b.v; break;
    case '-': n = a.v - b.v; break;
    case '*': n = a.v * b.v; break;
    case '/': n = b.v === 0 ? null : Math.floor(a.v / b.v); break;
    case '%': n = b.v === 0 ? null : a.v % b.v; break;
    default: n = 0;
  }
  if (n == null) return logicX(wOut);
  return logic01(n, wOut);
}

function logicShiftLeft(a, b, wOut) {
  if (b.xz) return logicX(wOut);
  const s = Math.min(b.v, 32);
  if (a.xz) {
    // shifting X: known zeros shift in from the bottom; X bits move
    const bits = [];
    for (let i = 0; i < wOut; i++) {
      if (i < s) bits.push(0);
      else if (i - s < a.w) bits.push(bitAt(a, i - s));
      else bits.push(0);
    }
    return logicFromBits(bits);
  }
  return logic01(maskW(a.v * Math.pow(2, s), wOut), wOut);
}
function logicShiftRight(a, b) {
  if (b.xz) return logicX(a.w);
  const s = Math.min(b.v, 40);
  if (a.xz) {
    const bits = [];
    for (let i = 0; i < a.w; i++) {
      const src = i + s;
      bits.push(src >= a.w ? 0 : bitAt(a, src));
    }
    return logicFromBits(bits);
  }
  return logic01(Math.floor(a.v / Math.pow(2, s)), a.w);
}

function logicTern(c, t, f) {
  const w = Math.max(t.w, f.w);
  const T = asLogic(t, w), F = asLogic(f, w);
  const C = asLogic(c, c.w || 1);
  if (!C.xz) return C.v !== 0 ? T : F;
  // X/Z select: bits that agree survive, others X (IEEE)
  const bits = [];
  for (let i = 0; i < w; i++) {
    const tb = bitAt(T, i), fb = bitAt(F, i);
    bits.push(tb === fb ? tb : 'x');
  }
  return logicFromBits(bits);
}

function logicLogNot(a) {
  const A = asLogic(a);
  let saw1 = false, sawX = false;
  for (let i = 0; i < A.w; i++) {
    const b = bitAt(A, i);
    if (b === 1) saw1 = true;
    else if (b === 'x' || b === 'z') sawX = true;
  }
  if (saw1) return logic01(0, 1);
  if (sawX) return logicX(1);
  return logic01(1, 1);
}
function logicLogAnd(a, b) {
  const A = asLogic(a), B = asLogic(b);
  const a0 = !A.xz && A.v === 0, b0 = !B.xz && B.v === 0;
  const a1 = !A.xz && A.v !== 0, b1 = !B.xz && B.v !== 0;
  if (a0 || b0) return logic01(0, 1);
  if (a1 && b1) return logic01(1, 1);
  return logicX(1);
}
function logicLogOr(a, b) {
  const A = asLogic(a), B = asLogic(b);
  const a1 = !A.xz && A.v !== 0, b1 = !B.xz && B.v !== 0;
  const a0 = !A.xz && A.v === 0, b0 = !B.xz && B.v === 0;
  if (a1 || b1) return logic01(1, 1);
  if (a0 && b0) return logic01(0, 1);
  return logicX(1);
}
function logicCmpRel(op, a, b) {
  const w = Math.max(a.w, b.w);
  const A = asLogic(a, w), B = asLogic(b, w);
  if (A.xz || B.xz) return logicX(1);
  let r = false;
  if (op === '<') r = A.v < B.v;
  else if (op === '<=') r = A.v <= B.v;
  else if (op === '>') r = A.v > B.v;
  else if (op === '>=') r = A.v >= B.v;
  return logic01(r ? 1 : 0, 1);
}
function concatLogic(parts) {
  const bits = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = asLogic(parts[i]);
    for (let b = 0; b < p.w; b++) bits.push(bitAt(p, b));
  }
  if (!bits.length) return logic01(0, 1);
  return logicFromBits(bits);
}
function sliceLogic(sig, msb, lsb) {
  const S = asLogic(sig);
  const bits = [];
  for (let i = lsb; i <= msb; i++) bits.push(i >= S.w || i < 0 ? 0 : bitAt(S, i));
  return logicFromBits(bits);
}
function bitSet(vec, i, bit) {
  const out = { v: vec.v, xz: vec.xz || 0, z: vec.z || 0, w: vec.w };
  const mask = 1 << i;
  const b = (bit && typeof bit === 'object') ? bitAt(asLogic(bit, 1), 0) : (bit ? 1 : 0);
  if (b === 'z') { out.xz |= mask; out.z |= mask; out.v &= ~mask; }
  else if (b === 'x') { out.xz |= mask; out.z &= ~mask; out.v &= ~mask; }
  else {
    out.xz &= ~mask; out.z &= ~mask;
    if (b) out.v |= mask; else out.v &= ~mask;
  }
  return out;
}
function partSet(vec, hi, lo, src) {
  let out = { v: vec.v, xz: vec.xz || 0, z: vec.z || 0, w: vec.w };
  const s = asLogic(src, hi - lo + 1);
  for (let i = 0; i <= hi - lo; i++) out = bitSet(out, lo + i, bitAt(s, i));
  return out;
}
function valuesEqual(got, exp) {
  const G = asLogic(got, (got && got.w) || 32);
  if (exp && typeof exp === 'object' && 'v' in exp) return logicSame(G, asLogic(exp, G.w));
  if (G.xz) return false;
  const n = (exp >>> 0);
  return (G.v >>> 0) === n;
}

function logicWiden(L, w) {
  return asLogic(L, w);
}

function resolveDrivers(drivers, w) {
  if (!drivers.length) return logicZ(w);
  if (drivers.length === 1) return asLogic(drivers[0], w);
  const bits = [];
  for (let i = 0; i < w; i++) {
    let saw0 = false, saw1 = false, sawX = false, sawZ = 0, n = 0;
    for (const d of drivers) {
      const L = asLogic(d, w);
      const b = bitAt(L, i);
      n++;
      if (b === 0) saw0 = true;
      else if (b === 1) saw1 = true;
      else if (b === 'x') sawX = true;
      else if (b === 'z') sawZ++;
    }
    if (sawX || (saw0 && saw1)) bits.push('x');
    else if (saw0) bits.push(0);
    else if (saw1) bits.push(1);
    else bits.push('z');
  }
  return logicFromBits(bits);
}

function parseLiteralDigits(width, base, digits) {
  const clean = digits.replace(/_/g, '');
  if (!clean.length) return { error: 'Literal is missing its digits (e.g. 4\'b1010).' };
  const radix = { b: 2, d: 10, h: 16, o: 8 }[base];
  const hasXZ = /[xXzZ?]/.test(clean);
  if (!hasXZ) {
    if (base !== 'd' && !/^[0-9a-fA-F]+$/.test(clean)) return { error: `Bad digits '${digits}' for base '${base}'.` };
    for (const ch of clean.toLowerCase()) {
      if (ch === 'x' || ch === 'z') continue;
      if (parseInt(ch, 16) >= radix) return { error: `Digit '${ch}' isn't valid in base '${base}'.` };
    }
    let v = parseInt(clean, radix);
    return { logic: logic01(v, width) };
  }
  if (base === 'd') {
    // 8'dx / 8'dz → all X / all Z
    if (/^[xX?]+$/.test(clean)) return { logic: logicX(width) };
    if (/^[zZ]+$/.test(clean)) return { logic: logicZ(width) };
    return { error: "Decimal literals can't mix x/z with digits." };
  }
  const bitsPer = base === 'b' ? 1 : base === 'o' ? 3 : 4;
  const bits = []; // lsb first
  for (let di = clean.length - 1; di >= 0; di--) {
    const ch = clean[di].toLowerCase();
    if (ch === 'x' || ch === '?') {
      for (let k = 0; k < bitsPer; k++) bits.push('x');
    } else if (ch === 'z') {
      for (let k = 0; k < bitsPer; k++) bits.push('z');
    } else {
      const n = parseInt(ch, 16);
      if (Number.isNaN(n) || n >= radix) return { error: `Digit '${ch}' isn't valid in base '${base}'.` };
      for (let k = 0; k < bitsPer; k++) bits.push((n >> k) & 1);
    }
  }
  while (bits.length < width) bits.push(0);
  if (bits.length > width) bits.length = width;
  return { logic: logicFromBits(bits) };
}

export {
  maskW, maskBits,
  logic01, logicX, logicZ, asLogic, logicSame, logicWiden,
  isFullyKnown, isFullyX, bitAt, logicFromBits,
  logicNot, logicAnd, logicOr, logicXor, logicXnor, reduction,
  logicEq, logicNeq, logicEqCase, logicNeqCase,
  logicArith, logicShiftLeft, logicShiftRight, logicTern,
  logicLogNot, logicLogAnd, logicLogOr, logicCmpRel,
  concatLogic, sliceLogic, bitSet, partSet, valuesEqual,
  resolveDrivers, parseLiteralDigits, knownNumber,
};

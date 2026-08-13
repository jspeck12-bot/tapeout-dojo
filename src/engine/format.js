// Shared display formatting for simulator diagnostics and the hardware view.
function formatValue(value, width) {
  if (value && typeof value === 'object' && 'v' in value) {
    return formatLogic(value, width);
  }
  if (width <= 1) return String(value);
  return "'h" + (value >>> 0).toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
}

function formatLogic(logic, width) {
  const w = width || logic.w || 1;
  if (!(logic.xz) && !(logic.z)) {
    if (w <= 1) return String(logic.v);
    return "'h" + (logic.v >>> 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0');
  }
  let out = '';
  for (let i = w - 1; i >= 0; i--) {
    const bit = 1 << i;
    if (logic.z & bit) out += 'z';
    else if (logic.xz & bit) out += 'x';
    else out += (logic.v & bit) ? '1' : '0';
  }
  if (w <= 1) return "1'b" + out;
  return w + "'b" + out;
}

function fmtVal(v, w) { return formatValue(v, w); }

export { formatValue, formatLogic, fmtVal };

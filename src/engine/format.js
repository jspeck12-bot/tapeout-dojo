// Shared display formatting for simulator diagnostics and the hardware view.
function formatValue(value, width) {
  if (width <= 1) return String(value);
  return "'h" + (value >>> 0).toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
}

export { formatValue };

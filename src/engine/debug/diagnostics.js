import { formatValue } from '../format.js';

// One-line diagnosis of the first expected/got mismatch in a result.
function firstDivergence(result, widths) {
  if (!result || result.pass) return null;
  const rows = result.kind === 'comb' ? result.rows : result.trace;
  if (!rows) return null;
  const index = rows.findIndex(row => !row.ok);
  if (index < 0) return null;
  const row = rows[index];
  const outputs = Object.keys(row.expect).filter(key => row.got[key] !== row.expect[key]);
  const widthOf = (key) => (widths && widths[key]) || 1;
  const detail = outputs.map(key =>
    `${key}: expected ${formatValue(row.expect[key], widthOf(key))}, ` +
    `got ${formatValue(row.got[key], widthOf(key))}`,
  ).join(' · ');
  const where = result.kind === 'comb'
    ? 'first mismatch — inputs ' + Object.entries(row.in).map(([key, value]) => key + '=' + value).join(' ')
    : 'first divergence at cycle ' + (index + 1);
  return where + ' → ' + detail;
}

function bossPhase(enemyHp, maximumHp) {
  const fraction = enemyHp / Math.max(1, maximumHp);
  return fraction > 0.66 ? 1 : fraction > 0.33 ? 2 : 3;
}

export { bossPhase, firstDivergence };

import { formatValue } from './format.js';
import { valuesEqual } from './core.js';

// One-line diagnosis of the first expected/got mismatch in a result.
function firstDivergence(result, widths) {
  if (!result || result.pass) return null;
  const rows = result.kind === 'comb' ? result.rows : result.trace;
  if (!rows) return null;
  const i = rows.findIndex(r => !r.ok);
  if (i < 0) return null;
  const r = rows[i];
  const outs = Object.keys(r.expect).filter(k => !valuesEqual(r.got[k], r.expect[k]));
  const wOf = (k) => (widths && widths[k]) || 1;
  const isX = (v) => v && typeof v === 'object' && v.xz && !v.z;
  const det = outs.map(k => {
    const got = formatValue(r.got[k], wOf(k));
    const exp = formatValue(r.expect[k], wOf(k));
    const extra = isX(r.got[k]) ? ' — register never reset' : '';
    return `${k}: expected ${exp}, got ${got}${extra}`;
  }).join(' · ');
  if (result.kind !== 'comb' && outs.some(k => isX(r.got[k]))) {
    return `${outs[0]} is X at cycle ${i + 1} — register never reset`;
  }
  const where = result.kind === 'comb'
    ? 'first mismatch — inputs ' + Object.entries(r.in).map(([k, v]) => k + '=' + v).join(' ')
    : 'first divergence at cycle ' + (i + 1);
  return where + ' → ' + det;
}

function bossPhase(ehp, maxHp) {
  const ef = ehp / Math.max(1, maxHp);
  return ef > 0.66 ? 1 : ef > 0.33 ? 2 : 3;
}

export { firstDivergence, bossPhase };

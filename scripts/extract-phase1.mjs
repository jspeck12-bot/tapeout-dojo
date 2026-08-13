#!/usr/bin/env node
/**
 * One-shot extractor: split the Verilog engine out of tapeout-rpg_4.jsx.
 * Not part of the runtime; safe to delete after the split lands.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(ROOT, 'tapeout-rpg_4.jsx'), 'utf8');
const lines = src.split('\n');

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}

const formatJs = `// Shared display formatting for simulator diagnostics and the hardware view.
function formatValue(value, width) {
  if (value && typeof value === 'object' && 'kind' in value) {
    return formatLogic(value, width);
  }
  if (width <= 1) return String(value);
  return "'h" + (value >>> 0).toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
}

function formatLogic(logic, width) {
  const w = width || logic.w || 1;
  if (logic.xz === 0 && logic.z === 0) return formatValue(logic.v, w);
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
`;

const coreBody = slice(136, 1143)
  .replace(/function fmtVal[\s\S]*?\n}/, '')
  .replace(/\bfmtVal\(/g, 'formatValue(');

const netlistBody = slice(1145, 1397)
  .replace(/\bfmtVal\(/g, 'formatValue(');

const diagBody = slice(1430, 1450)
  .replace(/\bfmtVal\(/g, 'formatValue(');

const rtlBody = slice(1491, 1573);

const coreJs = `// ============================================================
// VERILOG ENGINE CORE — lexer, parser, elaborator, simulator
// Pure synchronous module: no DOM, no React, no three.js, no Worker.
// Importable from Node (the gate) and from the Worker wrapper.
// ============================================================

import { formatValue } from './format.js';

${coreBody}

export {
  V_KEYWORDS,
  vErr,
  pow2,
  maskW,
  vTokenize,
  litValue,
  VParser,
  evalExpr,
  bitop,
  walkExprNames,
  walkStmt,
  lvalueNames,
  checkSemantics,
  VSim,
  vCompile,
  runCombTest,
  runSeqTest,
  runChallengeTest,
  SIM_MAX_DELTA,
  SIM_MAX_EVENTS,
};
`;

const netlistJs = `// ============================================================
// NETLIST EXTRACTION — gate-level DAG for the schematic view
// ============================================================

import { walkExprNames, walkStmt, lvalueNames } from './core.js';
import { formatValue } from './format.js';

${netlistBody}

export { netlistOf, levelizeNetlist, NL_SIZE, NL_BIN, NL_HOLD };
`;

const diagJs = `import { formatValue } from './format.js';

${diagBody}

export { firstDivergence, bossPhase };
`;

const rtlJs = `import { vCompile, runChallengeTest } from './core.js';

${rtlBody}

export { exportRTL, genTTWrapper, genCombTB, genSeqTB };
`;

fs.mkdirSync(path.join(ROOT, 'src/engine'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/engine/format.js'), formatJs);
fs.writeFileSync(path.join(ROOT, 'src/engine/core.js'), coreJs);
fs.writeFileSync(path.join(ROOT, 'src/engine/netlist.js'), netlistJs);
fs.writeFileSync(path.join(ROOT, 'src/engine/diagnostics.js'), diagJs);
fs.writeFileSync(path.join(ROOT, 'src/engine/rtl.js'), rtlJs);

// Build tapeout.jsx: drop engine body, add imports, alias fmtVal.
const importBlock = `import {
  V_KEYWORDS, vCompile, runChallengeTest, VSim,
} from "./engine/core.js";
import { netlistOf, levelizeNetlist } from "./engine/netlist.js";
import { firstDivergence, bossPhase } from "./engine/diagnostics.js";
import { exportRTL } from "./engine/rtl.js";
import { fmtVal } from "./engine/format.js";
import { getEngineClient, serializeTest } from "./engine/client.js";
import { analyzeTiming, timingSummaryLine } from "./engine/timing.js";
`;

const head = lines.slice(0, 11).join('\n'); // keep react/lucide/three imports
const restStart = 1575; // CONTENT section
const rest = lines.slice(restStart - 1).join('\n');

// Remove local fmtVal (now imported)
const restNoFmt = rest.replace(/\nfunction fmtVal\(v, w\) \{\n  if \(w <= 1\) return String\(v\);\n  return "'h" \+ \(v >>> 0\)\.toString\(16\)\.toUpperCase\(\)\.padStart\(Math\.ceil\(w \/ 4\), '0'\);\n\}\n/, '\n');

const tocNote = `
// Engine lives in src/engine/* (pure core + worker). Content lives in content/*.
`;

const tapeout = `${head}
${importBlock}
${lines.slice(11, 126).join('\n')}
${tocNote}
${restNoFmt}
`;

fs.mkdirSync(path.join(ROOT, 'src'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/tapeout.jsx'), tapeout);
console.log('extracted engine + wrote src/tapeout.jsx', {
  core: coreJs.length,
  netlist: netlistJs.length,
  tapeout: tapeout.length,
});

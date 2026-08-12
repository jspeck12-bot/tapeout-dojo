'use strict';
// ============================================================
// GATE — orchestrator (reconstructed).
//
// IMPORTANT: The original gate scripts were never committed to this repo
// (absent from all git history, tags, branches, and CI). This is a REBUILT
// gate that exercises the real game internals; its check counts are its own
// and it does NOT claim to reproduce the original 309-check content suite.
//
// Stages (fail-fast): build · artifact-compat · layout · content · visual · smoke
// Prints "GATE GREEN" only if every stage passes.
// ============================================================
const fs = require('fs');
const { spawnSync } = require('child_process');
const shared = require('./_shared.cjs');

function stageBuild() {
  const size = shared.buildOnly();
  return `bundled ${(size / 1024).toFixed(0)} KB`;
}

function stageArtifactCompat() {
  const src = fs.readFileSync(shared.SRC, 'utf8');
  // strip block + line comments so doc mentions don't trip the checks
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const defaults = (src.match(/export\s+default/g) || []).length;
  if (defaults !== 1) throw new Error(`expected exactly one \`export default\`, found ${defaults}`);
  if (/\blocalStorage\b/.test(code)) throw new Error('game file references localStorage (must use window.storage)');
  if (/three\/examples|\/jsm\//.test(src)) throw new Error('game file imports three/examples or jsm (core three r128 only)');
  const allowed = new Set(['react', 'three', 'lucide-react']);
  const imports = [...src.matchAll(/^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((mm) => mm[1]);
  for (const spec of imports) {
    const pkg = spec.startsWith('.') ? spec : spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
    if (spec.startsWith('.')) throw new Error(`unexpected relative import in single-file game: ${spec}`);
    if (!allowed.has(pkg)) throw new Error(`disallowed import: ${spec}`);
  }
  return `1 default export · no localStorage · ${imports.length} imports all core`;
}

function stageUnit() {
  const result = spawnSync(process.execPath, [
    require.resolve('vitest/vitest.mjs'),
    'run',
    '--reporter=dot',
  ], {
    cwd: shared.ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Vitest failed${output ? `\n${output}` : ''}`);
  }
  const match = result.stdout.match(/(\d+) passed/);
  return match ? `${match[1]} tests` : 'Vitest passed';
}

async function main() {
  const stages = [
    ['build', () => stageBuild()],
    ['artifact', () => stageArtifactCompat()],
    ['unit', () => stageUnit()],
    ['layout', () => `${require('./validate.cjs').run()} checks`],
    ['content', () => `${require('./test_content.cjs').run()} checks`],
    ['visual', () => { const r = require('./visual.cjs').run(); return `${r.scenes} scenes · ${r.checks} checks`; }],
    ['smoke', async () => `${await require('./smoke.cjs').run()} checks`],
  ];
  for (const [name, fn] of stages) {
    const t0 = Date.now();
    try {
      const detail = await fn();
      console.log(`  ✓ ${name.padEnd(9)} ${detail}  (${Date.now() - t0}ms)`);
    } catch (e) {
      console.error(`  ✗ ${name.padEnd(9)} ${e.message}`);
      console.error('\nGATE RED');
      process.exit(1);
    }
  }
  console.log('\nGATE GREEN');
  process.exit(0);
}

main();

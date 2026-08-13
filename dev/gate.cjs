'use strict';
// ============================================================
// GATE — orchestrator.
// Stages (fail-fast): build · artifact · engine · layout · content · visual · smoke
// Prints "GATE GREEN" only if every stage passes.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const shared = require('./_shared.cjs');

function stageBuild() {
  const size = shared.buildOnly();
  return `bundled ${(size / 1024).toFixed(0)} KB`;
}

function stageArtifactCompat() {
  const src = fs.readFileSync(shared.SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const defaults = (src.match(/export\s+default/g) || []).length;
  if (defaults !== 1) throw new Error(`expected exactly one \`export default\`, found ${defaults}`);
  if (/\blocalStorage\b/.test(code)) throw new Error('game file references localStorage (must use window.storage)');
  if (/three\/examples|\/jsm\//.test(src)) throw new Error('game file imports three/examples or jsm (core three r128 only)');
  const allowed = new Set(['react', 'three', 'lucide-react']);
  const imports = [...src.matchAll(/^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((mm) => mm[1]);
  for (const spec of imports) {
    if (spec.startsWith('.')) continue; // engine + content modules are allowed
    const pkg = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
    if (!allowed.has(pkg)) throw new Error(`disallowed import: ${spec}`);
  }
  return `1 default export · no localStorage · relative engine/content ok`;
}

function stageEngine() {
  const r = spawnSync(path.join(shared.ROOT, 'node_modules', '.bin', 'vitest'), ['run'], {
    cwd: shared.ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    throw new Error(out.trim().split('\n').slice(-20).join('\n') || 'vitest failed');
  }
  const pass = out.match(/Tests\s+(\d+) passed/);
  return pass ? `${pass[1]} tests passed` : 'vitest ok';
}

async function main() {
  const stages = [
    ['build', () => stageBuild()],
    ['artifact', () => stageArtifactCompat()],
    ['engine', () => stageEngine()],
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

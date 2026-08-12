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
const path = require('path');
const { spawnSync } = require('child_process');
const shared = require('./_shared.cjs');

function stageBuild() {
  const size = shared.buildOnly();
  return `bundled ${(size / 1024).toFixed(0)} KB`;
}

function sourceModules(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceModules(full));
    else if (entry.isFile() && /\.(?:js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

function stripComments(source) {
  let out = '';
  let state = 'code';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === 'line') {
      if (ch === '\n') { out += ch; state = 'code'; }
      else out += ' ';
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') { out += '  '; i++; state = 'code'; }
      else out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      out += ch;
      if (ch === '\\') {
        if (next !== undefined) { out += next; i++; }
        continue;
      }
      if ((state === 'single' && ch === "'") ||
          (state === 'double' && ch === '"') ||
          (state === 'template' && ch === '`')) state = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { out += '  '; i++; state = 'line'; continue; }
    if (ch === '/' && next === '*') { out += '  '; i++; state = 'block'; continue; }
    if (ch === "'") state = 'single';
    else if (ch === '"') state = 'double';
    else if (ch === '`') state = 'template';
    out += ch;
  }
  return out;
}

function importSpecs(code) {
  const specs = [];
  const patterns = [
    /^\s*import\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

function stageArtifactCompat() {
  const srcDir = path.join(shared.ROOT, 'src');
  const mainFile = path.join(srcDir, 'main.jsx');
  const files = sourceModules(srcDir);
  const gameFiles = files.filter((file) => file !== mainFile);
  const allowed = new Set(['react', 'react-dom', 'three', 'lucide-react']);
  let defaults = 0;
  let importCount = 0;

  for (const file of files) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    if (file !== mainFile && /\blocalStorage\b/.test(code)) {
      throw new Error(`${path.relative(shared.ROOT, file)} references localStorage (must use window.storage)`);
    }
    if (gameFiles.includes(file)) defaults += (code.match(/\bexport\s+default\b/g) || []).length;
    for (const spec of importSpecs(code)) {
      importCount++;
      if (/^three\/examples(?:\/|$)|\/jsm(?:\/|$)/.test(spec)) {
        throw new Error(`${path.relative(shared.ROOT, file)} imports three/examples or jsm (core three r128 only)`);
      }
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      const pkg = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
      if (!allowed.has(pkg)) throw new Error(`disallowed import in ${path.relative(shared.ROOT, file)}: ${spec}`);
    }
  }

  if (defaults !== 1) throw new Error(`expected exactly one \`export default\` across game modules, found ${defaults}`);
  return `1 default export · no localStorage · ${importCount} imports across ${files.length} source modules`;
}

function stageUnit() {
  const expectedMinimumTests = 25;
  const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  const result = spawnSync(process.execPath, [
    vitestBin,
    'run',
    '--reporter=json',
    '--passWithNoTests=false',
  ], {
    cwd: shared.ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Vitest failed${output ? `\n${output}` : ''}`);
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (e) {
    throw new Error(`could not parse Vitest JSON report: ${e.message}`);
  }
  if (!report.success || report.numFailedTests !== 0) {
    throw new Error(`${report.numFailedTests || 0} Vitest tests failed`);
  }
  if (report.numTotalTests < expectedMinimumTests) {
    throw new Error(`expected at least ${expectedMinimumTests} Vitest tests, found ${report.numTotalTests}`);
  }
  if (report.numPendingTests !== 0 || report.numTodoTests !== 0) {
    throw new Error(`Vitest has ${report.numPendingTests || 0} skipped and ${report.numTodoTests || 0} todo tests`);
  }
  return `${report.numPassedTests} tests`;
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

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadMod } = require('./_shared.cjs');

function runCommand(command, args, label) {
  const result = childProcess.spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${label} failed${output ? `\n${output}` : ''}`);
  }
  return result.stdout;
}

function run() {
  const version = childProcess.spawnSync('iverilog', ['-V'], { encoding: 'utf8' });
  if (version.error && version.error.code === 'ENOENT') {
    throw new Error('iverilog is required for npm run test:rtl');
  }

  const game = loadMod();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tapeout-iverilog-'));
  let checks = 0;
  try {
    for (const challenge of game.CODE_CHALLENGES) {
      const artifact = game.exportRTL(challenge);
      const safeId = challenge.id.replace(/[^a-z0-9_-]/gi, '_');
      const moduleFile = path.join(directory, `${safeId}.v`);
      const testbenchFile = path.join(directory, `${safeId}.tb.v`);
      const wrapperFile = path.join(directory, `${safeId}.wrapper.v`);
      const simulationFile = path.join(directory, `${safeId}.out`);
      const wrapperOutput = path.join(directory, `${safeId}.wrapper.out`);
      fs.writeFileSync(moduleFile, artifact.module);
      fs.writeFileSync(testbenchFile, artifact.testbench);
      fs.writeFileSync(wrapperFile, artifact.wrapper);

      runCommand('iverilog', [
        '-g2012',
        '-s', `tb_${artifact.name}`,
        '-o', simulationFile,
        moduleFile,
        testbenchFile,
      ], `${challenge.id} testbench compile`);
      checks++;

      const simulation = runCommand('vvp', [simulationFile], `${challenge.id} simulation`);
      if (!simulation.includes('PASS:')) {
        throw new Error(`${challenge.id} simulation did not print PASS`);
      }
      checks++;

      runCommand('iverilog', [
        '-g2012',
        '-s', `tt_um_${artifact.name}`,
        '-o', wrapperOutput,
        moduleFile,
        wrapperFile,
      ], `${challenge.id} wrapper compile`);
      checks++;
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  return checks;
}

module.exports = { run };

if (require.main === module) {
  try {
    const checks = run();
    console.log(`iverilog OK · ${checks} checks · 28 exports`);
  } catch (error) {
    console.error(`iverilog FAIL: ${error.message}`);
    process.exit(1);
  }
}

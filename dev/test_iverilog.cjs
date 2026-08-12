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

function constantModule(iface, fill) {
  const declarations = iface.ports.map((port) =>
    `${port.d === 'in' ? 'input' : 'output'} ${port.w > 1 ? `[${port.w - 1}:0] ` : ''}${port.n}`);
  const assignments = iface.ports
    .filter((port) => port.d === 'out')
    .map((port) => `  assign ${port.n} = ${port.w}'b${String(fill).repeat(port.w)};`)
    .join('\n');
  return `module ${iface.name}(${declarations.join(', ')});\n${assignments}\nendmodule\n`;
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

      // Run the exported self-checking bench against an intentionally broken
      // DUT. A disabled failure condition would otherwise let canonical-only
      // simulation pass forever.
      fs.writeFileSync(moduleFile, constantModule(challenge.iface, 0));
      const mutantSimulation = path.join(directory, `${safeId}.mutant.out`);
      runCommand('iverilog', [
        '-g2012',
        '-s', `tb_${artifact.name}`,
        '-o', mutantSimulation,
        moduleFile,
        testbenchFile,
      ], `${challenge.id} mutant testbench compile`);
      const mutantOutput = runCommand('vvp', [mutantSimulation], `${challenge.id} mutant simulation`);
      if (mutantOutput.includes('PASS:') || !mutantOutput.includes('FAILURE')) {
        throw new Error(`${challenge.id} exported testbench accepted a stuck-at-zero DUT`);
      }
      checks += 2;
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

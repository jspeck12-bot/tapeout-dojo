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

function sampled(values, limit = 32) {
  if (values.length <= limit) return values;
  const selected = [];
  for (let index = 0; index < limit; index++) {
    selected.push(values[Math.floor(index * values.length / limit)]);
  }
  return selected;
}

function wrapperVectors(game, challenge) {
  const compiled = game.vCompile(challenge.solution, challenge.iface);
  if (!compiled.ok) throw new Error(`${challenge.id} failed to compile for wrapper vectors`);
  const outputs = challenge.iface.ports.filter((port) => port.d === 'out');
  if (challenge.test.type === 'comb') {
    return sampled(challenge.test.vectors).map((vector) => {
      const sim = new game.VSim(compiled.mod);
      Object.entries(vector.in).forEach(([name, value]) => sim.setInput(name, value));
      sim.settle();
      return {
        inputs: vector.in,
        outputs: Object.fromEntries(outputs.map((port) => [port.n, sim.get(port.n)])),
      };
    });
  }
  const sim = new game.VSim(compiled.mod);
  return sampled(challenge.test.frames).map((frame) => {
    Object.entries(frame).forEach(([name, value]) => sim.setInput(name, value));
    sim.settle();
    sim.clock();
    return {
      inputs: frame,
      outputs: Object.fromEntries(outputs.map((port) => [port.n, sim.get(port.n)])),
    };
  });
}

function packInputs(iface, values) {
  const ports = iface.ports.filter((port) =>
    port.d === 'in' && port.n !== 'clk' && port.n !== 'rst');
  let packed = 0;
  let offset = 0;
  for (const port of ports) {
    packed += ((values[port.n] || 0) % Math.pow(2, port.w)) * Math.pow(2, offset);
    offset += port.w;
  }
  return packed;
}

function packOutputs(iface, values) {
  const ports = iface.ports.filter((port) => port.d === 'out');
  let packed = 0;
  let offset = 0;
  for (const port of ports) {
    packed += ((values[port.n] || 0) % Math.pow(2, port.w)) * Math.pow(2, offset);
    offset += port.w;
  }
  return packed;
}

function wrapperTestbench(game, challenge, artifact) {
  const vectors = wrapperVectors(game, challenge);
  const inputWidth = challenge.iface.ports
    .filter((port) => port.d === 'in' && port.n !== 'clk' && port.n !== 'rst')
    .reduce((sum, port) => sum + port.w, 0);
  const outputWidth = challenge.iface.ports
    .filter((port) => port.d === 'out')
    .reduce((sum, port) => sum + port.w, 0);
  const extraInputWidth = Math.max(0, inputWidth - 8);
  const extraOutputWidth = Math.max(0, outputWidth - 8);
  const outputMask = Math.pow(2, outputWidth) - 1;
  const outputEnable = extraOutputWidth
    ? ((Math.pow(2, extraOutputWidth) - 1) << extraInputWidth)
    : 0;
  let source = `module tb_wrapper_${artifact.name};\n`;
  source += "  reg [7:0] ui_in = 0; reg [7:0] uio_in = 0;\n";
  source += "  wire [7:0] uo_out; wire [7:0] uio_out; wire [7:0] uio_oe;\n";
  source += "  reg ena = 1; reg clk = 0; reg rst_n = 1; integer errors = 0;\n";
  source += `  tt_um_${artifact.name} top(.ui_in(ui_in), .uo_out(uo_out), .uio_in(uio_in), .uio_out(uio_out), .uio_oe(uio_oe), .ena(ena), .clk(clk), .rst_n(rst_n));\n`;
  source += "  initial begin\n";
  vectors.forEach((vector, index) => {
    const packedInputs = packInputs(challenge.iface, vector.inputs);
    const packedOutputs = packOutputs(challenge.iface, vector.outputs);
    source += `    ui_in=8'd${packedInputs & 255}; uio_in=8'd${(packedInputs >>> 8) & 255}; `;
    source += `rst_n=${vector.inputs.rst ? 0 : 1}; `;
    if (challenge.test.type === 'seq') source += "#5; clk=1; #1; ";
    else source += "#1; ";
    source += `if (({uio_out,uo_out} & 16'h${outputMask.toString(16)}) !== 16'h${packedOutputs.toString(16)} || uio_oe !== 8'h${outputEnable.toString(16)}) begin errors=errors+1; $display(\"WRAP FAIL ${index}\"); end `;
    if (challenge.test.type === 'seq') source += "#4; clk=0; ";
    source += "\n";
  });
  source += `    if (errors==0) $display("WRAPPER PASS: ${artifact.name}"); else $display("%0d WRAPPER FAILURE(S)", errors);\n`;
  source += "    $finish;\n  end\nendmodule\n";
  return source;
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
      const wrapperTestbenchFile = path.join(directory, `${safeId}.wrapper.tb.v`);
      const simulationFile = path.join(directory, `${safeId}.out`);
      const wrapperOutput = path.join(directory, `${safeId}.wrapper.out`);
      fs.writeFileSync(moduleFile, artifact.module);
      fs.writeFileSync(testbenchFile, artifact.testbench);
      fs.writeFileSync(wrapperFile, artifact.wrapper);
      fs.writeFileSync(wrapperTestbenchFile, wrapperTestbench(game, challenge, artifact));

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

      const wrapperSimulation = path.join(directory, `${safeId}.wrapper.sim.out`);
      runCommand('iverilog', [
        '-g2012',
        '-s', `tb_wrapper_${artifact.name}`,
        '-o', wrapperSimulation,
        moduleFile,
        wrapperFile,
        wrapperTestbenchFile,
      ], `${challenge.id} wrapper testbench compile`);
      const wrapperResult = runCommand('vvp', [wrapperSimulation], `${challenge.id} wrapper simulation`);
      if (!wrapperResult.includes('WRAPPER PASS:')) {
        throw new Error(`${challenge.id} wrapper mapping simulation failed`);
      }
      checks += 2;

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

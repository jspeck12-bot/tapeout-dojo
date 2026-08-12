import { runChallengeTest, vCompile } from '../verilog.js';

function vectorWidth(width) {
  return width > 1 ? '[' + (width - 1) + ':0] ' : '';
}

function decimalLiteral(width, value) {
  const modulus = Math.pow(2, width);
  return width + "'d" + (((value % modulus) + modulus) % modulus);
}

function genTTWrapper(name, ports) {
  const inputs = ports.filter(port => port.d === 'in');
  const outputs = ports.filter(port => port.d === 'out');
  const hasClock = inputs.some(port => port.n === 'clk');
  const hasReset = inputs.some(port => port.n === 'rst');
  const dataInputs = inputs.filter(port => port.n !== 'clk' && port.n !== 'rst');
  const connections = [];
  let bit = 0;
  dataInputs.forEach(port => {
    const slice = port.w > 1
      ? 'ui_in[' + (bit + port.w - 1) + ':' + bit + ']'
      : 'ui_in[' + bit + ']';
    connections.push('.' + port.n + '(' + slice + ')');
    bit += port.w;
  });
  if (hasClock) connections.push('.clk(clk)');
  if (hasReset) connections.push('.rst(~rst_n)');
  outputs.forEach(port => connections.push('.' + port.n + '(' + port.n + '_w)'));
  const totalOutputWidth = outputs.reduce((sum, port) => sum + port.w, 0);
  let source = "// Tiny Tapeout-style top wrapper — maps your module onto the standard TT pin interface.\n";
  source += "`default_nettype none\n";
  source += "module tt_um_" + name + " (\n";
  source += "  input  wire [7:0] ui_in,\n  output wire [7:0] uo_out,\n  input  wire [7:0] uio_in,\n  output wire [7:0] uio_out,\n  output wire [7:0] uio_oe,\n  input  wire       ena,\n  input  wire       clk,\n  input  wire       rst_n\n);\n";
  outputs.forEach(port => {
    source += "  wire " + vectorWidth(port.w) + port.n + "_w;\n";
  });
  source += "  " + name + " dut (" + connections.join(", ") + ");\n";
  const parts = [];
  if (totalOutputWidth < 8) parts.push((8 - totalOutputWidth) + "'b0");
  for (let index = outputs.length - 1; index >= 0; index--) parts.push(outputs[index].n + "_w");
  source += "  assign uo_out  = " + (parts.length > 1 ? "{" + parts.join(", ") + "}" : parts[0]) + ";\n";
  source += "  assign uio_out = 8'b0;\n  assign uio_oe  = 8'b0;\n";
  source += "  wire _unused = &{ena, uio_in, 1'b0};\n";
  source += "endmodule\n`default_nettype wire\n";
  return source;
}

function genCombTB(name, ports, vectors) {
  const inputs = ports.filter(port => port.d === 'in');
  const outputs = ports.filter(port => port.d === 'out');
  let selectedVectors = vectors || [];
  if (selectedVectors.length > 16) {
    const all = selectedVectors;
    const step = all.length / 16;
    selectedVectors = [];
    for (let index = 0; index < 16; index++) {
      selectedVectors.push(all[Math.floor(index * step)]);
    }
  }
  let source = "`timescale 1ns/1ps\n// Auto-generated self-checking testbench (TAPEOUT). Run in Icarus Verilog or EDA Playground.\n";
  source += "module tb_" + name + ";\n";
  inputs.forEach(port => { source += "  reg  " + vectorWidth(port.w) + port.n + ";\n"; });
  outputs.forEach(port => { source += "  wire " + vectorWidth(port.w) + port.n + ";\n"; });
  source += "  integer errors = 0;\n\n  " + name + " dut (" +
    ports.map(port => "." + port.n + "(" + port.n + ")").join(", ") +
    ");\n\n  initial begin\n";
  selectedVectors.forEach(vector => {
    const sets = inputs.map(port =>
      port.n + " = " + decimalLiteral(port.w, (vector.in && vector.in[port.n]) || 0) + ";",
    ).join(" ");
    const condition = outputs.map(port =>
      port.n + " !== " + decimalLiteral(port.w, (vector.out && vector.out[port.n]) || 0),
    ).join(" || ");
    const inputFormat = inputs.map(port => port.n + "=%0d").join(" ");
    const outputFormat = outputs.map(port => port.n + "=%0d").join(" ");
    const args = inputs.map(port => port.n).concat(outputs.map(port => port.n)).join(", ");
    const wanted = outputs.map(port =>
      port.n + "=" + ((vector.out && vector.out[port.n]) || 0),
    ).join(" ");
    source += "    " + sets + " #1;\n    if (" + condition +
      ") begin errors=errors+1; $display(\"FAIL [" + inputFormat +
      "] got " + outputFormat + " want " + wanted + "\", " + args + "); end\n";
  });
  source += "    if (errors==0) $display(\"PASS: " + name + " (all " +
    selectedVectors.length +
    " vectors)\"); else $display(\"%0d FAILURE(S)\", errors);\n    $finish;\n  end\nendmodule\n";
  return source;
}

function genSeqTB(name, ports, test, trace) {
  const inputs = ports.filter(port => port.d === 'in');
  const outputs = ports.filter(port => port.d === 'out');
  const dataInputs = inputs.filter(port => port.n !== 'clk');
  const watched = (test && test.watch) || outputs.map(port => port.n);
  const frames = (test && test.frames) || [];
  let source = "`timescale 1ns/1ps\n// Auto-generated self-checking testbench (TAPEOUT). Clocked. Run in Icarus Verilog or EDA Playground.\n";
  source += "module tb_" + name + ";\n  reg clk = 0;\n";
  dataInputs.forEach(port => {
    source += "  reg  " + vectorWidth(port.w) + port.n + " = 0;\n";
  });
  outputs.forEach(port => {
    source += "  wire " + vectorWidth(port.w) + port.n + ";\n";
  });
  source += "  integer errors = 0;\n\n  " + name + " dut (" +
    ports.map(port => "." + port.n + "(" + port.n + ")").join(", ") +
    ");\n  always #5 clk = ~clk;\n\n  initial begin\n";
  frames.forEach((frame, index) => {
    const sets = dataInputs.map(port =>
      port.n + " = " + decimalLiteral(port.w, frame[port.n] || 0) + ";",
    ).join(" ");
    const expected = (trace[index] && trace[index].expect) || {};
    const condition = watched.map(signal =>
      signal + " !== " + decimalLiteral(
        (outputs.find(port => port.n === signal) || { w: 4 }).w,
        expected[signal] || 0,
      ),
    ).join(" || ");
    const format = watched.map(signal => signal + "=%0d").join(" ");
    const wanted = watched.map(signal => signal + "=" + (expected[signal] || 0)).join(" ");
    source += "    " + sets + " @(posedge clk); #1;\n    if (" + condition +
      ") begin errors=errors+1; $display(\"FAIL cycle " + index +
      ": got " + format + " want " + wanted + "\", " + watched.join(", ") + "); end\n";
  });
  source += "    if (errors==0) $display(\"PASS: " + name + " (all " +
    frames.length +
    " cycles)\"); else $display(\"%0d FAILURE(S)\", errors);\n    $finish;\n  end\nendmodule\n";
  return source;
}

function exportRTL(challenge) {
  const name = challenge.iface.name;
  const ports = challenge.iface.ports;
  let testbench;
  if (challenge.test && challenge.test.type === 'seq') {
    let trace = [];
    try {
      const compiled = vCompile(challenge.solution, challenge.iface);
      if (compiled.ok) trace = runChallengeTest(compiled.mod, challenge.test).trace || [];
    } catch (error) {
      // Preserve export availability if reference simulation unexpectedly fails.
    }
    testbench = genSeqTB(name, ports, challenge.test, trace);
  } else {
    testbench = genCombTB(name, ports, (challenge.test && challenge.test.vectors) || []);
  }
  return {
    name,
    module: challenge.solution,
    testbench,
    wrapper: genTTWrapper(name, ports),
  };
}

export { exportRTL, genCombTB, genSeqTB, genTTWrapper };

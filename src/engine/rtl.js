import { vCompile, runChallengeTest } from './core.js';

// ---------- Phase 16: Export RTL (the silicon loop) ----------
// Generates a synthesizable module + a self-checking testbench + a Tiny Tapeout-style
// top wrapper as real Verilog text for EXTERNAL tools (Icarus Verilog / EDA Playground /
// Tiny Tapeout). The in-game sim runs single self-contained modules, so these are not
// re-run here; the testbench's golden values come from the in-game reference simulation,
// so a correct module passes them and a buggy one fails.
function _vw(w) { return w > 1 ? '[' + (w - 1) + ':0] ' : ''; }
function _dlit(w, v) {
  if (v && typeof v === 'object' && (v.xz || v.z)) {
    let bits = '';
    for (let i = w - 1; i >= 0; i--) {
      const bit = 1 << i;
      if (v.z & bit) bits += 'z';
      else if (v.xz & bit) bits += 'x';
      else bits += (v.v & bit) ? '1' : '0';
    }
    return w + "'b" + bits;
  }
  const n = (v && typeof v === 'object' && 'v' in v) ? v.v : v;
  const m = Math.pow(2, w);
  return w + "'d" + (((n % m) + m) % m);
}
function genTTWrapper(name, ports) {
  const ins = ports.filter(p => p.d === 'in'), outs = ports.filter(p => p.d === 'out');
  const hasClk = ins.some(p => p.n === 'clk'), hasRst = ins.some(p => p.n === 'rst');
  const dataIns = ins.filter(p => p.n !== 'clk' && p.n !== 'rst');
  const conns = []; let bit = 0;
  dataIns.forEach(p => { const sl = p.w > 1 ? 'ui_in[' + (bit + p.w - 1) + ':' + bit + ']' : 'ui_in[' + bit + ']'; conns.push('.' + p.n + '(' + sl + ')'); bit += p.w; });
  if (hasClk) conns.push('.clk(clk)');
  if (hasRst) conns.push('.rst(~rst_n)');
  outs.forEach(p => conns.push('.' + p.n + '(' + p.n + '_w)'));
  const totalOut = outs.reduce((a, p) => a + p.w, 0);
  let s = "// Tiny Tapeout-style top wrapper — maps your module onto the standard TT pin interface.\n";
  s += "`default_nettype none\n";
  s += "module tt_um_" + name + " (\n";
  s += "  input  wire [7:0] ui_in,\n  output wire [7:0] uo_out,\n  input  wire [7:0] uio_in,\n  output wire [7:0] uio_out,\n  output wire [7:0] uio_oe,\n  input  wire       ena,\n  input  wire       clk,\n  input  wire       rst_n\n);\n";
  outs.forEach(p => { s += "  wire " + _vw(p.w) + p.n + "_w;\n"; });
  s += "  " + name + " dut (" + conns.join(", ") + ");\n";
  const parts = [];
  if (totalOut < 8) parts.push((8 - totalOut) + "'b0");
  for (let k = outs.length - 1; k >= 0; k--) parts.push(outs[k].n + "_w");
  s += "  assign uo_out  = " + (parts.length > 1 ? "{" + parts.join(", ") + "}" : parts[0]) + ";\n";
  s += "  assign uio_out = 8'b0;\n  assign uio_oe  = 8'b0;\n";
  s += "  wire _unused = &{ena, uio_in, 1'b0};\n";
  s += "endmodule\n`default_nettype wire\n";
  return s;
}
function genCombTB(name, ports, vectors) {
  const ins = ports.filter(p => p.d === 'in'), outs = ports.filter(p => p.d === 'out');
  let vs = vectors || [];
  if (vs.length > 16) { const all = vs, step = all.length / 16; vs = []; for (let k = 0; k < 16; k++) vs.push(all[Math.floor(k * step)]); }
  let s = "`timescale 1ns/1ps\n// Auto-generated self-checking testbench (TAPEOUT). Run in Icarus Verilog or EDA Playground.\n";
  s += "module tb_" + name + ";\n";
  ins.forEach(p => { s += "  reg  " + _vw(p.w) + p.n + ";\n"; });
  outs.forEach(p => { s += "  wire " + _vw(p.w) + p.n + ";\n"; });
  s += "  integer errors = 0;\n\n  " + name + " dut (" + ports.map(p => "." + p.n + "(" + p.n + ")").join(", ") + ");\n\n  initial begin\n";
  vs.forEach(v => {
    const sets = ins.map(p => p.n + " = " + _dlit(p.w, (v.in && v.in[p.n]) || 0) + ";").join(" ");
    const cond = outs.map(p => p.n + " !== " + _dlit(p.w, (v.out && v.out[p.n]) || 0)).join(" || ");
    const fmtIns = ins.map(p => p.n + "=%0d").join(" "), fmtOuts = outs.map(p => p.n + "=%0d").join(" ");
    const args = ins.map(p => p.n).concat(outs.map(p => p.n)).join(", ");
    const want = outs.map(p => p.n + "=" + ((v.out && v.out[p.n]) || 0)).join(" ");
    s += "    " + sets + " #1;\n    if (" + cond + ") begin errors=errors+1; $display(\"FAIL [" + fmtIns + "] got " + fmtOuts + " want " + want + "\", " + args + "); end\n";
  });
  s += "    if (errors==0) $display(\"PASS: " + name + " (all " + vs.length + " vectors)\"); else $display(\"%0d FAILURE(S)\", errors);\n    $finish;\n  end\nendmodule\n";
  return s;
}
function genSeqTB(name, ports, test, trace) {
  const ins = ports.filter(p => p.d === 'in'), outs = ports.filter(p => p.d === 'out');
  const dataIns = ins.filter(p => p.n !== 'clk');
  const watch = (test && test.watch) || outs.map(p => p.n);
  const frames = (test && test.frames) || [];
  let s = "`timescale 1ns/1ps\n// Auto-generated self-checking testbench (TAPEOUT). Clocked. Run in Icarus Verilog or EDA Playground.\n";
  s += "module tb_" + name + ";\n  reg clk = 0;\n";
  dataIns.forEach(p => { s += "  reg  " + _vw(p.w) + p.n + " = 0;\n"; });
  outs.forEach(p => { s += "  wire " + _vw(p.w) + p.n + ";\n"; });
  s += "  integer errors = 0;\n\n  " + name + " dut (" + ports.map(p => "." + p.n + "(" + p.n + ")").join(", ") + ");\n  always #5 clk = ~clk;\n\n  initial begin\n";
  frames.forEach((f, idx) => {
    const sets = dataIns.map(p => p.n + " = " + _dlit(p.w, f[p.n] || 0) + ";").join(" ");
    const exp = (trace[idx] && trace[idx].expect) || {};
    const cond = watch.map(w => w + " !== " + _dlit((outs.find(p => p.n === w) || { w: 4 }).w, exp[w] || 0)).join(" || ");
    const fmtW = watch.map(w => w + "=%0d").join(" "), want = watch.map(w => w + "=" + (exp[w] || 0)).join(" ");
    s += "    " + sets + " @(posedge clk); #1;\n    if (" + cond + ") begin errors=errors+1; $display(\"FAIL cycle " + idx + ": got " + fmtW + " want " + want + "\", " + watch.join(", ") + "); end\n";
  });
  s += "    if (errors==0) $display(\"PASS: " + name + " (all " + frames.length + " cycles)\"); else $display(\"%0d FAILURE(S)\", errors);\n    $finish;\n  end\nendmodule\n";
  return s;
}
function exportRTL(ch) {
  const name = ch.iface.name, ports = ch.iface.ports;
  let tb;
  if (ch.test && ch.test.type === 'seq') {
    let trace = [];
    try { const c = vCompile(ch.solution, ch.iface); if (c.ok) { trace = (runChallengeTest(c.mod, ch.test).trace) || []; } } catch (e) { }
    tb = genSeqTB(name, ports, ch.test, trace);
  } else { tb = genCombTB(name, ports, (ch.test && ch.test.vectors) || []); }
  return { name: name, module: ch.solution, testbench: tb, wrapper: genTTWrapper(name, ports) };
}

export { exportRTL, genTTWrapper, genCombTB, genSeqTB };

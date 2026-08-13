import { vCompile, runChallengeTest, VSim } from '../../src/engine/core.js';
import { handleEngineRequest } from '../../src/engine/protocol.js';
import { analyzeTiming } from '../../src/engine/timing.js';
import { createFallbackClient } from '../../src/engine/client.js';
import { logicAnd, logic01, logicX } from '../../src/engine/values.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const andSrc = `module and_gate(input a, input b, output y);
  assign y = a & b;
endmodule
`;
const c = vCompile(andSrc, { name: 'and_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] });
assert(c.ok, 'and_gate compile: ' + JSON.stringify(c.errors));
const r = runChallengeTest(c.mod, {
  type: 'comb',
  vectors: [
    { in: { a: 0, b: 0 }, out: { y: 0 } },
    { in: { a: 1, b: 1 }, out: { y: 1 } },
    { in: { a: 1, b: 0 }, out: { y: 0 } },
  ],
});
assert(r.pass, 'and_gate test failed ' + JSON.stringify(r));

const dffSrc = `module dff(input clk, input d, output reg q);
  always @(posedge clk) begin
    q <= d;
  end
endmodule
`;
const d = vCompile(dffSrc, { name: 'dff', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 1 }] });
assert(d.ok, 'dff compile: ' + JSON.stringify(d.errors));
const dr = runChallengeTest(d.mod, {
  type: 'seq',
  watch: ['q'],
  frames: [{ d: 1 }, { d: 0 }, { d: 1 }],
  makeRef: () => ({ q: 0, step(f) { this.q = f.d; return { q: this.q }; } }),
});
assert(dr.pass, 'dff test failed ' + JSON.stringify(dr.trace));

const loopSrc = `module loop(input a, output y);
  assign y = ~y;
endmodule
`;
const lc = vCompile(loopSrc, { name: 'loop', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] });
assert(lc.ok, 'loop compile');
let loopErr = null;
try {
  const sim = new VSim(lc.mod);
  sim.settle();
} catch (e) {
  loopErr = e;
}
assert(loopErr && loopErr.code === 'COMBINATIONAL_LOOP', 'expected combinational loop, got ' + (loopErr && loopErr.message));
assert(Array.isArray(loopErr.signals) && loopErr.signals.includes('y'), 'loop should name y, got ' + JSON.stringify(loopErr.signals));

const xz = logicAnd(logic01(1, 1), logicX(1), 1);
assert(xz.xz, '1 & X should be X');
const z0 = logicAnd(logic01(0, 1), logicX(1), 1);
assert(!z0.xz && z0.v === 0, '0 & X should be 0');

const adder = `module adder4(input [3:0] a, input [3:0] b, output [3:0] sum, output cout);
  assign {cout, sum} = a + b;
endmodule
`;
const ac = vCompile(adder, { name: 'adder4', ports: [{ n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 }, { n: 'sum', d: 'out', w: 4 }, { n: 'cout', d: 'out', w: 1 }] });
assert(ac.ok, 'adder compile ' + JSON.stringify(ac.errors));
const ar = runChallengeTest(ac.mod, {
  type: 'comb',
  vectors: [{ in: { a: 15, b: 1 }, out: { sum: 0, cout: 1 } }, { in: { a: 2, b: 2 }, out: { sum: 4, cout: 0 } }],
});
assert(ar.pass, 'adder test ' + JSON.stringify(ar.rows));

const t = analyzeTiming(ac.mod);
assert(t.pathDepth > 0 && t.fmaxMhz > 0, 'timing report ' + JSON.stringify({ d: t.pathDepth, f: t.fmaxMhz }));

const msg = handleEngineRequest({ id: 1, op: 'runTest', payload: { src: andSrc, iface: { name: 'and_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] }, test: { type: 'comb', vectors: [{ in: { a: 1, b: 1 }, out: { y: 1 } }] } } });
assert(msg.ok && msg.id === 1 && msg.result.test.pass, 'protocol runTest');

const fb = createFallbackClient();
const fbMsg = await fb.request('compile', { src: andSrc, iface: { name: 'and_gate', ports: [{ n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] } });
assert(fbMsg.ok && fbMsg.result.mod, 'fallback compile');

console.log('smoke-core OK');

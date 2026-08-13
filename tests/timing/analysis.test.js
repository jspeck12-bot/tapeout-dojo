import { describe, expect, test } from 'vitest';
import { vCompile } from '../../src/engine/core.js';
import { analyzeTiming, DELAY_MODEL, timingSummaryLine } from '../../src/engine/timing.js';
import { CODE_CHALLENGES } from '../../content/index.js';

const adderIface = {
  name: 'adder4',
  ports: [
    { n: 'a', d: 'in', w: 4 }, { n: 'b', d: 'in', w: 4 },
    { n: 'sum', d: 'out', w: 4 }, { n: 'cout', d: 'out', w: 1 },
  ],
};

const RIPPLE = `
module adder4(input [3:0] a, input [3:0] b, output [3:0] sum, output cout);
  assign {cout, sum} = a + b;
endmodule
`;

const CLA = `
module adder4(input [3:0] a, input [3:0] b, output [3:0] sum, output cout);
  wire [3:0] g = a & b;
  wire [3:0] p = a ^ b;
  wire c1 = g[0];
  wire c2 = g[1] | (p[1] & g[0]);
  wire c3 = g[2] | (p[2] & g[1]) | (p[2] & p[1] & g[0]);
  assign cout = g[3] | (p[3] & g[2]) | (p[3] & p[2] & g[1]) | (p[3] & p[2] & p[1] & g[0]);
  assign sum[0] = p[0];
  assign sum[1] = p[1] ^ c1;
  assign sum[2] = p[2] ^ c2;
  assign sum[3] = p[3] ^ c3;
endmodule
`;

describe('delay model', () => {
  test('constants live in one table with an educational disclaimer', () => {
    expect(DELAY_MODEL.disclaimer).toMatch(/Wire delay is ignored/i);
    expect(DELAY_MODEL.disclaimer).toMatch(/not sign-off/i);
    expect(DELAY_MODEL.base.NOT).toBeLessThan(DELAY_MODEL.base.AND);
    expect(DELAY_MODEL.base.AND).toBeLessThan(DELAY_MODEL.base.XOR);
    expect(DELAY_MODEL.base.XOR).toBeLessThan(DELAY_MODEL.base.ADD);
  });
});

describe('path analysis', () => {
  test('ripple a+b has a longer critical path / lower fmax than lookahead', () => {
    const r = analyzeTiming(vCompile(RIPPLE, adderIface).mod);
    const c = analyzeTiming(vCompile(CLA, adderIface).mod);
    expect(r.errors.filter((e) => e.code === 'COMB_LOOP').length).toBe(0);
    expect(c.errors.filter((e) => e.code === 'COMB_LOOP').length).toBe(0);
    expect(r.critical.delay).toBeGreaterThan(c.critical.delay);
    expect(r.pathDepth).toBeGreaterThanOrEqual(c.pathDepth);
    expect(r.fmaxMhz).toBeLessThan(c.fmaxMhz);
    expect(timingSummaryLine(r)).toMatch(/critical path: \d+ gates · ~\d+ MHz/);
  });

  test('timing report for all 28 solutions is finite and stable', () => {
    const reports = {};
    for (const ch of CODE_CHALLENGES) {
      const compiled = vCompile(ch.solution, ch.iface);
      expect(compiled.ok, ch.id).toBe(true);
      const t = analyzeTiming(compiled.mod);
      expect(Number.isFinite(t.fmaxMhz), ch.id).toBe(true);
      expect(Number.isFinite(t.pathDepth), ch.id).toBe(true);
      expect(t.fmaxMhz).toBeGreaterThan(0);
      reports[ch.id] = { path: t.pathDepth, f: Math.round(t.fmaxMhz) };
    }
    const again = analyzeTiming(vCompile(CODE_CHALLENGES[0].solution, CODE_CHALLENGES[0].iface).mod);
    expect(Math.round(again.fmaxMhz)).toBe(reports[CODE_CHALLENGES[0].id].f);
  });

  test('feedback loops and latches are reported, never hang', () => {
    const loop = vCompile('module loop(output y); assign y = ~y; endmodule', {
      name: 'loop', ports: [{ n: 'y', d: 'out', w: 1 }],
    }).mod;
    const t0 = Date.now();
    const loopT = analyzeTiming(loop);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(loopT.errors.some((e) => e.code === 'COMB_LOOP' || /loop/i.test(e.msg))).toBe(true);

    const latch = vCompile(`
      module latchy(input en, input d, output reg y);
        always @(*) if (en) y = d;
      endmodule
    `, { name: 'latchy', ports: [{ n: 'en', d: 'in', w: 1 }, { n: 'd', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }] }).mod;
    const t1 = Date.now();
    const latchT = analyzeTiming(latch);
    expect(Date.now() - t1).toBeLessThan(1000);
    expect(latchT.errors.some((e) => e.code === 'LATCH')).toBe(true);
  });
});

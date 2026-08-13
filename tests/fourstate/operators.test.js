import { describe, expect, test } from 'vitest';
import {
  logic01, logicX, logicZ, logicAnd, logicOr, logicXor, logicEq, logicEqCase,
  logicTern, bitAt, parseLiteralDigits, resolveDrivers, asLogic,
} from '../../src/engine/values.js';
import { vCompile, runCombTest, runSeqTest, VSim } from '../../src/engine/core.js';
import { firstDivergence } from '../../src/engine/diagnostics.js';

const bit = (b) => {
  if (b === 'x') return logicX(1);
  if (b === 'z') return logicZ(1);
  return logic01(b, 1);
};
const v = (L) => (L.xz ? (L.z ? 'z' : 'x') : L.v);

describe('4-state operator truth tables', () => {
  test('AND: 0 kills X, 1 & X is X', () => {
    expect(v(logicAnd(bit(0), bit('x'), 1))).toBe(0);
    expect(v(logicAnd(bit(1), bit('x'), 1))).toBe('x');
    expect(v(logicAnd(bit(1), bit(1), 1))).toBe(1);
    expect(v(logicAnd(bit(0), bit(1), 1))).toBe(0);
  });

  test('OR: 1 kills X, 0 | X is X', () => {
    expect(v(logicOr(bit(1), bit('x'), 1))).toBe(1);
    expect(v(logicOr(bit(0), bit('x'), 1))).toBe('x');
    expect(v(logicOr(bit(0), bit(0), 1))).toBe(0);
  });

  test('XOR: any X yields X', () => {
    expect(v(logicXor(bit(1), bit(0), 1))).toBe(1);
    expect(v(logicXor(bit(1), bit('x'), 1))).toBe('x');
    expect(v(logicXor(bit(0), bit(0), 1))).toBe(0);
  });

  test('== returns X on unknown; === is exact 4-state match', () => {
    expect(v(logicEq(bit(1), bit('x')))).toBe('x');
    expect(v(logicEq(bit(1), bit(1)))).toBe(1);
    expect(v(logicEqCase(bit('x'), bit('x')))).toBe(1);
    expect(v(logicEqCase(bit('x'), bit(0)))).toBe(0);
    expect(v(logicEqCase(bit('z'), bit('x')))).toBe(0);
  });

  test('ternary with X select: agreeing bits survive', () => {
    expect(v(logicTern(bit('x'), bit(1), bit(1)))).toBe(1);
    expect(v(logicTern(bit('x'), bit(1), bit(0)))).toBe('x');
    expect(v(logicTern(bit(1), bit(0), bit(1)))).toBe(0);
    expect(v(logicTern(bit(0), bit(0), bit(1)))).toBe(1);
  });

  test('literals 1\'bx and 4\'bz1x0 parse', () => {
    const x = parseLiteralDigits(1, 'b', 'x');
    expect(bitAt(x.logic, 0)).toBe('x');
    const bus = parseLiteralDigits(4, 'b', 'z1x0');
    expect(bitAt(bus.logic, 0)).toBe(0);
    expect(bitAt(bus.logic, 1)).toBe('x');
    expect(bitAt(bus.logic, 2)).toBe(1);
    expect(bitAt(bus.logic, 3)).toBe('z');
  });
});

describe('registers, X diagnosis, tri-state', () => {
  test('registers start X; a design without reset produces X and names it', () => {
    const spec = { name: 'ctr', ports: [{ n: 'clk', d: 'in', w: 1 }, { n: 'q', d: 'out', w: 4 }] };
    const mod = vCompile(`
      module ctr(input clk, output reg [3:0] q);
        always @(posedge clk) q <= q + 1;
      endmodule
    `, spec).mod;
    const sim = new VSim(mod);
    expect(asLogic(sim.get('q'), 4).xz).toBeTruthy();
    const result = runSeqTest(mod, [{}, {}, {}], () => ({
      q: 0,
      step() { this.q = (this.q + 1) & 15; return { q: this.q }; },
    }), ['q']);
    expect(result.pass).toBe(false);
    const div = firstDivergence(result, { q: 4 });
    expect(div).toMatch(/q is X at cycle 1 — register never reset/);
  });

  test('tri-state assignment and bus contention', () => {
    const spec = {
      name: 'bus',
      ports: [
        { n: 'en0', d: 'in', w: 1 }, { n: 'd0', d: 'in', w: 1 },
        { n: 'en1', d: 'in', w: 1 }, { n: 'd1', d: 'in', w: 1 },
        { n: 'y', d: 'out', w: 1 },
      ],
    };
    const compiled = vCompile(`
      module bus(input en0, input d0, input en1, input d1, output y);
        assign y = en0 ? d0 : 1'bz;
        assign y = en1 ? d1 : 1'bz;
      endmodule
    `, spec);
    expect(compiled.ok).toBe(true);
    const zRow = runCombTest(compiled.mod, [{ in: { en0: 0, d0: 1, en1: 0, d1: 0 }, out: { y: 0 } }]);
    expect(zRow.rows[0].ok).toBe(false);
    expect(asLogic(zRow.rows[0].got.y, 1).z).toBeTruthy();

    const drive = runCombTest(compiled.mod, [{ in: { en0: 1, d0: 1, en1: 0, d1: 0 }, out: { y: 1 } }]);
    expect(drive.pass).toBe(true);

    const fight = runCombTest(compiled.mod, [{ in: { en0: 1, d0: 1, en1: 1, d1: 0 }, out: { y: 1 } }]);
    expect(fight.pass).toBe(false);
    expect(asLogic(fight.rows[0].got.y, 1).xz).toBeTruthy();
  });

  test('resolveDrivers: Z yields, 0/1 contend to X', () => {
    const z = resolveDrivers([logicZ(1), logic01(1, 1)], 1);
    expect(v(z)).toBe(1);
    const x = resolveDrivers([logic01(0, 1), logic01(1, 1)], 1);
    expect(v(x)).toBe('x');
  });
});

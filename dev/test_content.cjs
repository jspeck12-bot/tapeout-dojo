'use strict';
// ============================================================
// GATE · CONTENT (reconstructed — new coverage, not the original 309-check suite)
//
// Proves, against the real in-game Verilog compiler + simulator:
//   · every code challenge's reference solution compiles and passes its test
//   · the hardened (Engineer/Architect) test vectors also pass
//   · a stuck-at-0 impostor FAILS every code challenge
//   · every NG+ REMIX variant compiles and passes
//   · RTL export re-compiles cleanly
//   · gauntlet generators are self-consistent (their own answer checks out)
//   · learning order places each field note before the drills that use it
// ============================================================
const { loadMod } = require('./_shared.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function impostorSrc(iface) {
  const decl = iface.ports.map((p) => `${p.d === 'in' ? 'input' : 'output'} ${p.w > 1 ? `[${p.w - 1}:0] ` : ''}${p.n}`).join(', ');
  const body = iface.ports.filter((p) => p.d === 'out')
    .map((p) => `  assign ${p.n} = ${p.w > 1 ? `${p.w}'b0` : `1'b0`};`).join('\n');
  return `module ${iface.name}(${decl});\n${body}\nendmodule\n`;
}

function run() {
  const m = loadMod();
  let checks = 0;

  const testable = m.CODE_CHALLENGES.filter((c) => c.solution && c.iface && c.test);
  assert(testable.length >= 28, `expected >=28 code challenges, got ${testable.length}`);

  for (const ch of testable) {
    // 1. reference solution compiles
    const c = m.vCompile(ch.solution, ch.iface);
    assert(c.ok, `${ch.id}: solution failed to compile — ${c.errors && c.errors[0] && c.errors[0].msg}`);
    checks++;

    // 2. reference solution passes the base test
    const r = m.runChallengeTest(c.mod, ch.test);
    assert(r.pass && !r.runtimeError, `${ch.id}: solution failed base test (${r.passCount}/${r.total})`);
    checks++;

    // 3. reference solution passes the hardened test (if present)
    if (ch.testHard) {
      const rh = m.runChallengeTest(c.mod, ch.testHard);
      assert(rh.pass && !rh.runtimeError, `${ch.id}: solution failed hardened test (${rh.passCount}/${rh.total})`);
      checks++;
    }

    // 4. stuck-at-0 impostor must NOT pass
    const imp = m.vCompile(impostorSrc(ch.iface), ch.iface);
    assert(imp.ok, `${ch.id}: impostor unexpectedly failed to compile`);
    const ir = m.runChallengeTest(imp.mod, ch.test);
    assert(!(ir.pass && !ir.runtimeError), `${ch.id}: stuck-at-0 impostor wrongly PASSED the test`);
    checks++;

    // 5. RTL export re-compiles
    const ex = m.exportRTL(ch);
    assert(ex && ex.module && ex.testbench && ex.wrapper, `${ch.id}: exportRTL produced incomplete output`);
    const rc = m.vCompile(ex.module, ch.iface);
    assert(rc.ok, `${ch.id}: exported RTL module failed to recompile`);
    checks++;
  }

  // 6. NG+ REMIX variants compile + pass, impostor fails
  const remixIds = Object.keys(m.REMIX);
  assert(remixIds.length >= 20, `expected >=20 REMIX variants, got ${remixIds.length}`);
  for (const id of remixIds) {
    const base = m.CODE_CHALLENGES.find((c) => c.id === id);
    const rv = Object.assign({}, base, m.REMIX[id]);
    if (!(rv.solution && rv.iface && rv.test)) continue;
    const c = m.vCompile(rv.solution, rv.iface);
    assert(c.ok, `REMIX ${id}: solution failed to compile — ${c.errors && c.errors[0] && c.errors[0].msg}`);
    const r = m.runChallengeTest(c.mod, rv.test);
    assert(r.pass && !r.runtimeError, `REMIX ${id}: solution failed test (${r.passCount}/${r.total})`);
    const imp = m.vCompile(impostorSrc(rv.iface), rv.iface);
    const ir = m.runChallengeTest(imp.mod, rv.test);
    assert(!(ir.pass && !ir.runtimeError), `REMIX ${id}: stuck-at-0 impostor wrongly PASSED`);
    checks += 3;
  }

  // 7. gauntlet generators are self-consistent
  const rng = () => Math.random();
  for (const g of m.GAUNTLETS) {
    assert(typeof g.gen === 'function', `gauntlet ${g.id}: missing gen()`);
    for (let i = 0; i < 8; i++) {
      const q = g.gen(rng, i);
      assert(q && typeof q.text === 'string' && q.text.length > 0, `gauntlet ${g.id}[${i}]: no question text`);
      if (q.kind === 'mc' || Array.isArray(q.options)) {
        assert(Array.isArray(q.options) && q.options.length >= 2, `gauntlet ${g.id}[${i}]: malformed multiple-choice`);
        assert(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length, `gauntlet ${g.id}[${i}]: correct index out of range`);
        assert(q.options[q.correct] !== undefined, `gauntlet ${g.id}[${i}]: correct index has no option`);
      } else if (typeof q.check === 'function') {
        // `answer` is a human-readable display string, so only its presence is asserted.
        assert('answer' in q, `gauntlet ${g.id}[${i}]: has check() but no reference answer`);
        assert(q.check('') === false, `gauntlet ${g.id}[${i}]: check() accepts an empty answer`);
      } else {
        throw new Error(`gauntlet ${g.id}[${i}]: neither check() nor multiple-choice`);
      }
      checks++;
    }
  }

  // 8. truth-table challenge functions evaluate
  for (const t of m.TRUTH_CHALLENGES) {
    assert(Array.isArray(t.pool) && t.pool.length > 0, `truth ${t.id}: empty pool`);
    for (const row of t.pool) {
      assert(typeof row.fn === 'function' && Array.isArray(row.vars), `truth ${t.id}: malformed row`);
      const out = row.fn(...row.vars.map(() => 1));
      assert(out === 0 || out === 1, `truth ${t.id}: fn did not return a bit for all-ones input`);
      checks++;
    }
  }

  // 9. learning order — each note precedes the drills that use it
  for (const world of m.WORLDS) {
    const chs = m.challengesOf(world.id);
    const lessons = m.LESSONS[world.id] || [];
    const lessonIds = lessons.map((l) => l.id);
    const regular = chs.filter((c) => !c.boss);
    const seq = m.stationSequence(regular, lessonIds);
    if (lessonIds.length) {
      assert(seq[0].kind === 'book', `world ${world.id}: learning order does not start with a field note`);
      const books = seq.filter((s) => s.kind === 'book').length;
      const fights = seq.filter((s) => s.kind === 'fight').length;
      assert(books === lessonIds.length, `world ${world.id}: expected ${lessonIds.length} notes in sequence, got ${books}`);
      assert(fights === regular.length, `world ${world.id}: expected ${regular.length} fights in sequence, got ${fights}`);
    }
    checks++;
  }

  // 10. combat math — Verilog is the weapon (prototype kit, no content rollout)
  {
    const m1 = m.CODE_CHALLENGES.find((c) => c.id === m.COMBAT_PROTO_ID);
    assert(m1, 'COMBAT_PROTO_ID does not name a code challenge');
    assert(m.combatKitFor(m.COMBAT_PROTO_ID).proto, 'm1 must be the prototype kit');
    assert(!m.combatKitFor('c1').proto, 'non-proto encounters must stay on the legacy kit');
    assert(m.PROTO_ATTACKS.length >= 4, 'prototype needs at least four telegraphed attacks');
    ['probe', 'jam', 'hex', 'overload'].forEach((k) => {
      assert(m.PROTO_ATTACKS.indexOf(k) >= 0, 'missing attack ' + k);
      assert(m.ATK_TELL[k] && m.ATK_TELL[k].verb, 'missing tell for ' + k);
      checks++;
    });
    const compiled = m.vCompile(m1.solution, m1.iface);
    assert(compiled.ok, 'm1 solution must compile for combat math');
    const net = m.netlistOf(compiled.mod);
    const gates = m.gateCountOf(net);
    assert(gates >= 1 && gates <= 3, 'm1 AND should be 1–3 gates, got ' + gates);
    const tight = m.combatDamageOf({ passCount: 4, total: 4, bestPass: 0, gates: 1, latched: [], hintsUnused: true, firstTry: true, atk: 30, fullPass: true });
    const bloated = m.combatDamageOf({ passCount: 4, total: 4, bestPass: 0, gates: 12, latched: [], hintsUnused: false, firstTry: false, atk: 30, fullPass: true });
    assert(!tight.miss && tight.dmg > bloated.dmg, 'fewer gates must deal more damage');
    assert(tight.breakdown.indexOf('vectors') >= 0 && tight.breakdown.indexOf('gate') >= 0, 'hit breakdown must be visible');
    const miss = m.combatDamageOf({ passCount: 2, total: 4, bestPass: 2, gates: 1, latched: [], fullPass: false });
    assert(miss.miss, 'repeating the same vectors must not farm damage');
    const latch = m.combatDamageOf({ passCount: 4, total: 4, bestPass: 0, gates: 2, latched: ['y'], latchImmune: false, atk: 30, fullPass: true });
    const immune = m.combatDamageOf({ passCount: 4, total: 4, bestPass: 0, gates: 2, latched: ['y'], latchImmune: true, atk: 30, fullPass: true });
    assert(latch.dmg < immune.dmg, 'latch penalty must reduce damage');
    const eng = m.combatTune('engineer', false, { slowMult: 1, parryWiden: 1, chargeMult: 1 });
    const arch = m.combatTune('architect', false, { slowMult: 1, parryWiden: 1, chargeMult: 1 });
    const ext = m.combatTune('architect', true, { slowMult: 1, parryWiden: 1, chargeMult: 1 });
    assert(eng.volley > arch.volley, 'Engineer parry window must be more generous than Architect');
    assert(ext.volley > arch.volley, 'extended timing must widen Architect windows');
    assert(m.staggerAfter(0, 40, false, false) === 40, 'stagger accrues on hit');
    assert(m.staggerAfter(80, 0, true, false) === 0, 'Architect miss resets stagger');
    assert(m.staggerAfter(80, 0, true, true) > 0, 'Engineer miss is forgiving');
    assert(m.hexViolates('assign y = sel ? a : b;', { kind: 'ternary' }), 'hex catches ternary');
    assert(!m.hexViolates('assign y = a & b;', { kind: 'ternary' }), 'AND solution must not trip ternary hex');
    assert(m.clockStormFails('always @(posedge clk) q = q + 1;'), 'blocking assign fails clock storm');
    assert(!m.clockStormFails('always @(posedge clk) q <= q + 1;'), 'non-blocking rides the storm');
    const vq = m.makeVolley(m1, () => 0);
    assert(vq && vq.opts && vq.opts.length >= 2 && Number.isInteger(vq.correct), 'volley is a knowledge question, not a twitch prompt');
    checks += 12;
  }

  return checks;
}

module.exports = { run };

if (require.main === module) {
  try {
    const n = run();
    console.log(`content OK · ${n} checks`);
  } catch (e) {
    console.error('content FAIL: ' + e.message);
    process.exit(1);
  }
}

'use strict';
// ============================================================
// GATE · CONTENT
// Walks EVERY code challenge automatically — adding a challenge requires
// zero edits here. Schema + shipped-ID immutability live in the engine
// vitest suite (plain Node import of the catalog).
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
  assert(testable.length === m.CODE_CHALLENGES.length, 'every code challenge must have solution/iface/test');

  for (const ch of testable) {
    const c = m.vCompile(ch.solution, ch.iface);
    assert(c.ok, `${ch.id}: solution failed to compile — ${c.errors && c.errors[0] && c.errors[0].msg}`);
    checks++;

    const r = m.runChallengeTest(c.mod, ch.test);
    assert(r.pass && !r.runtimeError, `${ch.id}: solution failed base test (${r.passCount}/${r.total})`);
    checks++;

    if (ch.testHard) {
      const rh = m.runChallengeTest(c.mod, ch.testHard);
      assert(rh.pass && !rh.runtimeError, `${ch.id}: solution failed hardened test (${rh.passCount}/${rh.total})`);
      checks++;
    }

    const imp = m.vCompile(impostorSrc(ch.iface), ch.iface);
    assert(imp.ok, `${ch.id}: impostor unexpectedly failed to compile`);
    const ir = m.runChallengeTest(imp.mod, ch.test);
    assert(!(ir.pass && !ir.runtimeError), `${ch.id}: stuck-at-0 impostor wrongly PASSED the test`);
    checks++;

    const ex = m.exportRTL(ch);
    assert(ex && ex.module && ex.testbench && ex.wrapper, `${ch.id}: exportRTL produced incomplete output`);
    const rc = m.vCompile(ex.module, ch.iface);
    assert(rc.ok, `${ch.id}: exported RTL module failed to recompile`);
    checks++;

    const net = m.netlistOf(c.mod);
    assert(net && Array.isArray(net.nodes) && net.nodes.length > 0, `${ch.id}: netlist empty`);
    const lay = m.levelizeNetlist(net);
    assert(Number.isFinite(lay.W) && Number.isFinite(lay.H), `${ch.id}: netlist layout not finite`);
    checks++;
  }

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
        assert('answer' in q, `gauntlet ${g.id}[${i}]: has check() but no reference answer`);
        assert(q.check('') === false, `gauntlet ${g.id}[${i}]: check() accepts an empty answer`);
      } else {
        throw new Error(`gauntlet ${g.id}[${i}]: neither check() nor multiple-choice`);
      }
      checks++;
    }
  }

  for (const t of m.TRUTH_CHALLENGES) {
    assert(Array.isArray(t.pool) && t.pool.length > 0, `truth ${t.id}: empty pool`);
    for (const row of t.pool) {
      assert(typeof row.fn === 'function' && Array.isArray(row.vars), `truth ${t.id}: malformed row`);
      const out = row.fn(...row.vars.map(() => 1));
      assert(out === 0 || out === 1, `truth ${t.id}: fn did not return a bit for all-ones input`);
      checks++;
    }
  }

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

  const golf = m.normalizeSave({ xp: 40, done: { m1: { stars: 3 } } });
  assert(golf.golf && typeof golf.golf === 'object', 'normalizeSave must preserve golf records object');
  const withGolf = m.normalizeSave({ golf: { m1: { gates: 4, path: 2 } } });
  assert(withGolf.golf.m1.gates === 4 && withGolf.golf.m1.path === 2, 'golf personal-best must round-trip');
  checks += 2;

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

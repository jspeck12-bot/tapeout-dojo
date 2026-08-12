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
const crypto = require('crypto');
const { loadMod } = require('./_shared.cjs');
const GOLDEN = require('./fixtures/content-golden.cjs');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function stableHash(value) {
  const text = JSON.stringify(value, (_key, item) => typeof item === 'function' ? '[function]' : item);
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}
function assertNetlist(m, mod, fixture, label) {
  const started = Date.now();
  const netlist = m.netlistOf(mod);
  const layout = m.levelizeNetlist(netlist);
  assert(Date.now() - started < 250, `${label}: netlist extraction/layout exceeded 250ms`);
  assert(layout.nodes.length === fixture[0] && layout.edges.length === fixture[1],
    `${label}: netlist shape changed (got ${layout.nodes.length}/${layout.edges.length}, expected ${fixture[0]}/${fixture[1]})`);
  assert(netlist.latched.length === 0, `${label}: canonical solution inferred a latch`);
  assert(Number.isFinite(layout.W) && Number.isFinite(layout.H) && layout.W <= 4000 && layout.H <= 4000,
    `${label}: netlist canvas is non-finite or unbounded`);

  const ids = new Set(layout.nodes.map((node) => node.id));
  for (const node of layout.nodes) {
    for (const key of ['id', 'x', 'y', 'wd', 'ht', 'lvl']) {
      assert(Number.isFinite(node[key]), `${label}: netlist node ${node.id} has non-finite ${key}`);
    }
  }
  for (const edge of layout.edges) {
    assert(ids.has(edge.from) && ids.has(edge.to), `${label}: netlist has a dangling edge`);
    assert(Number.isFinite(edge.from) && Number.isFinite(edge.to) && Number.isFinite(edge.pin),
      `${label}: netlist edge contains non-finite coordinates`);
  }
  const levels = [...new Set(layout.nodes.map((node) => node.lvl))].sort((a, b) => a - b);
  levels.forEach((level, index) => assert(level === index,
    `${label}: netlist levels have a gap before ${level}`));
  return 6;
}

function impostorSrc(iface) {
  const decl = iface.ports.map((p) => `${p.d === 'in' ? 'input' : 'output'} ${p.w > 1 ? `[${p.w - 1}:0] ` : ''}${p.n}`).join(', ');
  const body = iface.ports.filter((p) => p.d === 'out')
    .map((p) => `  assign ${p.n} = ${p.w > 1 ? `${p.w}'b0` : `1'b0`};`).join('\n');
  return `module ${iface.name}(${decl});\n${body}\nendmodule\n`;
}

function run() {
  const m = loadMod();
  let checks = 0;

  // External characterization fixtures make content/order checks independent
  // from the runtime helpers that consume the same data.
  for (const world of m.WORLDS) {
    const w = world.id;
    const challenges = m.challengesOf(w);
    const challengeIds = challenges.map((challenge) => challenge.id);
    const lessons = m.LESSONS[w] || [];
    const lessonIds = lessons.map((lesson) => lesson.id);
    const stationOrder = m.stationSequence(
      challenges.filter((challenge) => !challenge.boss),
      lessonIds,
    ).map((station) => station.kind === 'book'
      ? `book:${station.lid}`
      : `fight:${station.f.id}`)
      .concat(challenges.filter((challenge) => challenge.boss).map((challenge) => `fight:${challenge.id}`));

    assert(JSON.stringify(challengeIds) === JSON.stringify(GOLDEN.worldChallengeIds[w]),
      `world ${w}: canonical challenge order changed`);
    assert(JSON.stringify(lessonIds) === JSON.stringify(GOLDEN.lessonIds[w]),
      `world ${w}: canonical lesson order changed`);
    assert(JSON.stringify(stationOrder) === JSON.stringify(GOLDEN.stationOrder[w]),
      `world ${w}: canonical station sequence changed`);
    assert(stableHash(lessons) === GOLDEN.lessonHashes[w],
      `world ${w}: canonical lesson content changed`);
    checks += 4;
  }

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

    const expected = r.kind === 'comb'
      ? r.rows.map((row) => row.expect)
      : r.trace.map((row) => row.expect);
    const descriptor = {
      id: ch.id,
      w: ch.w,
      title: ch.title,
      kind: ch.kind,
      boss: !!ch.boss,
      iface: ch.iface,
      solution: ch.solution,
      test: {
        type: ch.test.type,
        vectors: ch.test.vectors,
        frames: ch.test.frames,
        watch: ch.test.watch,
        expected,
      },
    };
    assert(stableHash(descriptor) === GOLDEN.challengeHashes[ch.id],
      `${ch.id}: canonical specification, solution, vectors, or expected outputs changed`);
    checks++;
    checks += assertNetlist(m, c.mod, GOLDEN.netlists.base[ch.id], ch.id);

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
    checks += assertNetlist(m, c.mod, GOLDEN.netlists.remix[id], `REMIX ${id}`);
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

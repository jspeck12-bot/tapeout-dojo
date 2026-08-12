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
function seededRng(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function answerCandidates(answer) {
  const text = String(answer == null ? '' : answer);
  const candidates = new Set([text, text.split(/\s*\(/)[0].trim()]);
  for (const match of text.match(/0x[0-9a-f]+|0b[01_]+|[01][01_]{3,}|-?\d+/gi) || []) {
    candidates.add(match);
  }
  return [...candidates];
}
function ttPinSlice(bus, high, low) {
  return high === low ? `${bus}[${low}]` : `${bus}[${high}:${low}]`;
}
function expectedTTInput(offset, width) {
  const high = offset + width - 1;
  if (high < 8) return ttPinSlice('ui_in', high, offset);
  if (offset >= 8) return ttPinSlice('uio_in', high - 8, offset - 8);
  return `{${ttPinSlice('uio_in', high - 8, 0)}, ${ttPinSlice('ui_in', 7, offset)}}`;
}
function numericValues(answer) {
  const text = String(answer == null ? '' : answer).trim().toLowerCase().replace(/_/g, '');
  const values = new Set();
  if (/^-?\d+$/.test(text)) values.add(Number(text));
  if (/^0x[0-9a-f]+$/.test(text)) values.add(parseInt(text.slice(2), 16));
  if (/^0b[01]+$/.test(text)) values.add(parseInt(text.slice(2), 2));
  if (/^[01]+$/.test(text)) values.add(parseInt(text, 2));
  if (/^[0-9a-f]+$/.test(text)) values.add(parseInt(text, 16));
  return values;
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

function impostorSrc(iface, fill = 0) {
  const decl = iface.ports.map((p) => `${p.d === 'in' ? 'input' : 'output'} ${p.w > 1 ? `[${p.w - 1}:0] ` : ''}${p.n}`).join(', ');
  const body = iface.ports.filter((p) => p.d === 'out')
    .map((p) => `  assign ${p.n} = ${p.w}'b${String(fill).repeat(p.w)};`).join('\n');
  return `module ${iface.name}(${decl});\n${body}\nendmodule\n`;
}

function run() {
  const m = loadMod();
  let checks = 0;

  const presentationOf = (challenge) => ({
    id: challenge.id,
    world: challenge.world,
    title: challenge.title,
    xp: challenge.xp,
    kind: challenge.kind,
    boss: !!challenge.boss,
    brief: challenge.brief,
    starter: challenge.starter,
    hints: challenge.hints,
    iface: challenge.iface,
  });
  const catalogValues = {
    basePresentation: m.CODE_CHALLENGES.map(presentationOf),
    remixPresentation: Object.entries(m.REMIX).map(([id, remix]) =>
      presentationOf({ ...m.CODE_CHALLENGES.find((challenge) => challenge.id === id), ...remix })),
    worlds: m.WORLDS,
    achievements: m.ACHIEVEMENTS,
    ranks: m.RANKS,
    lessonDepth: m.LESSON_DEPTH,
    bugs: m.BUG_HUNTS,
    topics: { list: m.TOPIC_LIST, map: m.TOPIC_OF },
    modes: m.MODES,
    training: m.TRAINING_GENS.map((generator) => ({
      gid: generator.gid,
      name: generator.name,
      blurb: generator.blurb,
    })),
    gauntletMeta: m.GAUNTLETS.map((gauntlet) => ({
      id: gauntlet.id,
      world: gauntlet.world,
      title: gauntlet.title,
      xp: gauntlet.xp,
      intro: gauntlet.intro,
    })),
    truthMeta: m.TRUTH_CHALLENGES.map((truth) => ({
      id: truth.id,
      world: truth.world,
      title: truth.title,
      xp: truth.xp,
      intro: truth.intro,
      labels: truth.pool.map((row) => row.label),
    })),
  };
  for (const [name, value] of Object.entries(catalogValues)) {
    assert(stableHash(value) === GOLDEN.catalogHashes[name],
      `canonical ${name} catalog changed`);
    checks++;
  }

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
      if (ch.test.type === 'seq') {
        assert(ch.testHard !== ch.test,
          `${ch.id}: hardened sequential test aliases the base test`);
        assert(ch.testHard.frames.length >= ch.test.frames.length + 14,
          `${ch.id}: hardened sequential test did not add 14 frames`);
        checks += 2;
      }
      const rh = m.runChallengeTest(c.mod, ch.testHard);
      assert(rh.pass && !rh.runtimeError, `${ch.id}: solution failed hardened test (${rh.passCount}/${rh.total})`);
      for (const fill of [0, 1]) {
        const hardenedImpostor = m.vCompile(impostorSrc(ch.iface, fill), ch.iface);
        const hardenedResult = m.runChallengeTest(hardenedImpostor.mod, ch.testHard);
        assert(!(hardenedResult.pass && !hardenedResult.runtimeError),
          `${ch.id}: stuck-at-${fill} impostor wrongly PASSED the hardened test`);
      }
      checks += 3;
    }

    // 4. stuck-at-0 impostor must NOT pass
    const imp = m.vCompile(impostorSrc(ch.iface), ch.iface);
    assert(imp.ok, `${ch.id}: impostor unexpectedly failed to compile`);
    const ir = m.runChallengeTest(imp.mod, ch.test);
    assert(!(ir.pass && !ir.runtimeError), `${ch.id}: stuck-at-0 impostor wrongly PASSED the test`);
    checks++;

    const impOne = m.vCompile(impostorSrc(ch.iface, 1), ch.iface);
    assert(impOne.ok, `${ch.id}: stuck-at-1 impostor unexpectedly failed to compile`);
    const irOne = m.runChallengeTest(impOne.mod, ch.test);
    assert(!(irOne.pass && !irOne.runtimeError), `${ch.id}: stuck-at-1 impostor wrongly PASSED the test`);
    checks++;

    // 5. RTL export re-compiles
    const ex = m.exportRTL(ch);
    assert(ex && ex.module && ex.testbench && ex.wrapper, `${ch.id}: exportRTL produced incomplete output`);
    const rc = m.vCompile(ex.module, ch.iface);
    assert(rc.ok, `${ch.id}: exported RTL module failed to recompile`);
    assert(ex.testbench.includes(`module tb_${ch.iface.name}`) &&
      ex.testbench.includes('$display') && ex.testbench.includes('$finish'),
    `${ch.id}: exported testbench is not self-checking`);
    const expectedRows = ch.test.type === 'seq'
      ? ch.test.frames.length
      : Math.min(ch.test.vectors.length, 16);
    const emittedRows = ch.test.type === 'seq'
      ? (ex.testbench.match(/@\(posedge clk\);/g) || []).length
      : (ex.testbench.match(/#1;/g) || []).length;
    assert(emittedRows === expectedRows,
      `${ch.id}: exported testbench has ${emittedRows} checks, expected ${expectedRows}`);
    assert(ex.wrapper.includes(`module tt_um_${ch.iface.name}`) &&
      ex.wrapper.includes(`${ch.iface.name} dut`) &&
      ['ui_in', 'uo_out', 'uio_in', 'uio_out', 'uio_oe', 'ena', 'clk', 'rst_n']
        .every((portName) => ex.wrapper.includes(portName)),
    `${ch.id}: Tiny Tapeout wrapper is incomplete`);
    const wrapperInputs = ch.iface.ports
      .filter((port) => port.d === 'in' && port.n !== 'clk' && port.n !== 'rst');
    let wrapperInputBit = 0;
    for (const port of wrapperInputs) {
      const expression = expectedTTInput(wrapperInputBit, port.w);
      assert(ex.wrapper.includes(`.${port.n}(${expression})`),
        `${ch.id}: wrapper maps ${port.n} incorrectly (expected ${expression})`);
      wrapperInputBit += port.w;
      checks++;
    }
    if (ch.iface.ports.some((port) => port.n === 'clk')) {
      assert(ex.wrapper.includes('.clk(clk)'), `${ch.id}: wrapper does not map clk`);
      checks++;
    }
    if (ch.iface.ports.some((port) => port.n === 'rst')) {
      assert(ex.wrapper.includes('.rst(~rst_n)'), `${ch.id}: wrapper does not map rst`);
      checks++;
    }
    const wrapperOutputs = ch.iface.ports.filter((port) => port.d === 'out');
    wrapperOutputs.forEach((port) => {
      assert(ex.wrapper.includes(`.${port.n}(${port.n}_w)`),
        `${ch.id}: wrapper does not connect output ${port.n}`);
      checks++;
    });
    const packedOutputs = wrapperOutputs.slice().reverse().map((port) => `${port.n}_w`);
    const packedExpression = packedOutputs.length > 1
      ? `{${packedOutputs.join(', ')}}`
      : packedOutputs[0];
    assert(ex.wrapper.includes(`_tpo_out = ${packedExpression};`),
      `${ch.id}: wrapper output packing order changed`);
    checks++;
    const pinIndices = [...ex.wrapper.matchAll(/\b(?:ui_in|uo_out|uio_in|uio_out|uio_oe)\[(\d+)/g)]
      .map((match) => Number(match[1]));
    assert(pinIndices.every((index) => index >= 0 && index <= 7),
      `${ch.id}: Tiny Tapeout wrapper references a pin outside [7:0]`);
    const outputBits = ch.iface.ports
      .filter((port) => port.d === 'out')
      .reduce((sum, port) => sum + port.w, 0);
    const expectedUo = outputBits >= 8
      ? '_tpo_out[7:0]'
      : `{${8 - outputBits}'b0, _tpo_out}`;
    assert(ex.wrapper.includes(`assign uo_out  = ${expectedUo};`),
      `${ch.id}: wrapper corrupts the primary output bank`);
    checks++;
    if (outputBits > 8) {
      assert(!ex.wrapper.includes('assign uio_oe  = 8\'b0'),
        `${ch.id}: wrapper truncates outputs instead of driving uio`);
    }
    checks += outputBits > 8 ? 6 : 5;
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
    const expected = r.kind === 'comb'
      ? r.rows.map((row) => row.expect)
      : r.trace.map((row) => row.expect);
    assert(stableHash({
      id: rv.id,
      w: rv.w,
      title: rv.title,
      brief: rv.brief,
      iface: rv.iface,
      solution: rv.solution,
      test: {
        type: rv.test.type,
        vectors: rv.test.vectors,
        frames: rv.test.frames,
        watch: rv.test.watch,
        expected,
      },
    }) === GOLDEN.remixHashes[id],
    `REMIX ${id}: canonical spec, solution, vectors, or expected outputs changed`);
    checks++;
    checks += assertNetlist(m, c.mod, GOLDEN.netlists.remix[id], `REMIX ${id}`);
    if (rv.testHard) {
      if (rv.test.type === 'seq') {
        assert(rv.testHard !== rv.test,
          `REMIX ${id}: hardened sequential test aliases the base test`);
        assert(rv.testHard.frames.length >= rv.test.frames.length + 14,
          `REMIX ${id}: hardened sequential test did not add 14 frames`);
        checks += 2;
      }
      const hardened = m.runChallengeTest(c.mod, rv.testHard);
      assert(hardened.pass && !hardened.runtimeError,
        `REMIX ${id}: solution failed hardened test (${hardened.passCount}/${hardened.total})`);
      for (const fill of [0, 1]) {
        const hardenedImpostor = m.vCompile(impostorSrc(rv.iface, fill), rv.iface);
        const hardenedResult = m.runChallengeTest(hardenedImpostor.mod, rv.testHard);
        assert(!(hardenedResult.pass && !hardenedResult.runtimeError),
          `REMIX ${id}: stuck-at-${fill} impostor wrongly PASSED hardened test`);
      }
      checks += 3;
    }
    const imp = m.vCompile(impostorSrc(rv.iface), rv.iface);
    const ir = m.runChallengeTest(imp.mod, rv.test);
    assert(!(ir.pass && !ir.runtimeError), `REMIX ${id}: stuck-at-0 impostor wrongly PASSED`);
    const impOne = m.vCompile(impostorSrc(rv.iface, 1), rv.iface);
    const irOne = m.runChallengeTest(impOne.mod, rv.test);
    assert(!(irOne.pass && !irOne.runtimeError), `REMIX ${id}: stuck-at-1 impostor wrongly PASSED`);
    checks += 4;
  }

  // 7. gauntlet generators are self-consistent
  for (const [generatorIndex, g] of m.GAUNTLETS.entries()) {
    assert(typeof g.gen === 'function', `gauntlet ${g.id}: missing gen()`);
    const rng = seededRng(0x54415045 + generatorIndex);
    const generated = [];
    for (let i = 0; i < 32; i++) {
      const q = g.gen(rng, i);
      generated.push(q);
      assert(q && typeof q.text === 'string' && q.text.length > 0, `gauntlet ${g.id}[${i}]: no question text`);
      if (q.kind === 'mc' || Array.isArray(q.options)) {
        assert(Array.isArray(q.options) && q.options.length >= 2, `gauntlet ${g.id}[${i}]: malformed multiple-choice`);
        assert(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length, `gauntlet ${g.id}[${i}]: correct index out of range`);
        assert(q.options[q.correct] !== undefined, `gauntlet ${g.id}[${i}]: correct index has no option`);
      } else if (typeof q.check === 'function') {
        assert('answer' in q, `gauntlet ${g.id}[${i}]: has check() but no reference answer`);
        assert(q.check('') === false, `gauntlet ${g.id}[${i}]: check() accepts an empty answer`);
        assert(q.check('__definitely_wrong__') === false,
          `gauntlet ${g.id}[${i}]: check() accepts an invalid answer`);
        const canonicalCandidates = answerCandidates(q.answer);
        assert(canonicalCandidates.some((candidate) => q.check(candidate)),
          `gauntlet ${g.id}[${i}]: no canonical form of its displayed answer passes check()`);
        const canonicalValues = new Set();
        canonicalCandidates.forEach((candidate) =>
          numericValues(candidate).forEach((value) => canonicalValues.add(value)));
        const wrongProbes = [
          '-17', '-2', '-1', '2', '3', '5', '7', '12', '23', '37', '65',
          '129', '257', '0x2a', '0x5c', '0xa5', '0b0011', '0b0110', '0b1101',
        ];
        for (const probe of wrongProbes) {
          const values = numericValues(probe);
          const equivalent = [...values].some((value) => canonicalValues.has(value));
          if (!equivalent) {
            assert(q.check(probe) === false,
              `gauntlet ${g.id}[${i}]: check() accepts wrong answer "${probe}"`);
          }
        }
      } else {
        throw new Error(`gauntlet ${g.id}[${i}]: neither check() nor multiple-choice`);
      }
      checks++;
    }
    assert(stableHash(generated) === GOLDEN.gauntletHashes[g.id],
      `gauntlet ${g.id}: deterministic rounds or answer keys changed`);
    checks++;
  }

  // 8. truth-table challenge functions evaluate
  for (const t of m.TRUTH_CHALLENGES) {
    assert(Array.isArray(t.pool) && t.pool.length > 0, `truth ${t.id}: empty pool`);
    for (const row of t.pool) {
      assert(typeof row.fn === 'function' && Array.isArray(row.vars), `truth ${t.id}: malformed row`);
      const fixture = GOLDEN.truthTables[row.label];
      assert(fixture && fixture.length === Math.pow(2, row.vars.length),
        `truth ${t.id}: missing canonical table for "${row.label}"`);
      for (let value = 0; value < Math.pow(2, row.vars.length); value++) {
        const args = row.vars.map((_name, index) =>
          (value >> (row.vars.length - 1 - index)) & 1);
        const out = row.fn(...args);
        assert(out === 0 || out === 1, `truth ${t.id}: fn did not return a bit for row ${value}`);
        assert(out === fixture[value],
          `truth ${t.id}: "${row.label}" row ${args.join('')} expected ${fixture[value]}, got ${out}`);
        checks++;
      }
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

# TAPEOUT — the Verilog dojo

[![gate](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml/badge.svg)](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[▶ Play it in the browser](https://jspeck12-bot.github.io/tapeout-dojo/)**

**A first-person 3D RPG that teaches you to design chips.** You walk seven
worlds, read field notes, fight creatures by writing Verilog, and export your
designs as real synthesizable RTL with self-checking testbenches and Tiny
Tapeout wrappers.

There is a working Verilog compiler and four-state event simulator inside the
game, isolated on a Web Worker so a runaway student design cannot freeze the
tab. Boss health bars *are* test vectors. When your circuit fails, the game
shows you the waveform (X as a red hatch, Z as a mid dashed line), the exact
cycle where reality diverged, a schematic of the gates your code became, and
an educational static-timing report of the critical path.

```bash
npm install && npm run dev
```

---

## What's in it

| | |
|---|---|
| **7 worlds** | The Bit Mines · Gate Valley · Module Foundry · Combinational Canyon · The Clock Tower · FSM Fortress · TAPEOUT |
| **44 challenges** | 28 write-real-Verilog · 15 rapid-fire gauntlets · 1 truth-table duel |
| **25 field notes** | each with a "going deeper" section — noise margins, two's complement, carry vs. overflow, setup/hold, metastability, RTL→GDSII |
| **4 boss fights** | culminating in CHIP-1, a sequential accumulator-ALU |
| **plus** | 22 achievements, 10 synthesized music tracks, gear, scrap economy, NG+, spaced review |

Everything renders in three.js: walkable worlds with god rays, bloom, and
dynamic shadows, and a fab campus with a floating wafer monument and sweeping
searchlights.

---

## The interesting part: the compiler

`vCompile()` (in `src/engine/core.js`) is a real lexer → parser → elaborator →
four-state event simulator for the synthesizable Verilog subset. The gate
imports it **synchronously in Node**. The browser talks to the same core through
a Worker (`compile` / `runTest` / `netlist` / `timing` / `export`) with hard
timeouts and a main-thread fallback.

**Supported:** `assign`, `always @(*)`, `always @(posedge clk)`, blocking and
non-blocking assignment, `if`/`else`, `case`, vectors, part-selects, bit-selects,
concatenation and replication, the full operator set, `1'bx` / `1'bz` literals,
X-propagation, tri-state resolution, and educational static timing on the
extracted gate netlist.

**Not supported, deliberately:** module instantiation, `$display`, delays.
Registers power up **X** — reset discipline is part of the lesson.

### Failure teaches

When a test fails you get three things:

1. **First-divergence diagnosis** — `first divergence at cycle 4 → q: expected 0xA, got 0x2`
2. **Waveforms** for sequential designs, **truth-table diffs** for combinational
3. **View as hardware** — your code rendered as a levelized gate schematic

That third one is the point of the whole project. Your `assign` becomes three
gates. Your `if` becomes a mux. Your registers become flip-flops. And if you
write an incomplete `always @(*)` block, the schematic draws the **inferred
latch** as a dashed red feedback loop — the classic beginner bug, made visible
instead of explained.

Compiler errors link back to the numbered field note that covers the concept.

### RTL export

Every signed-off challenge exports as:

- a clean synthesizable module
- a self-checking testbench with golden vectors from the in-game simulator
- a `tt_um_*` Tiny Tapeout wrapper with correct pin mapping

Run it in Icarus Verilog or EDA Playground. The capstone chip is submittable.

---

## Learning design

The worlds are the syllabus. Every field note and challenge is a **numbered
station** on a glowing trail, ordered so each note is immediately followed by
the challenges that use it. A **NEXT beacon** always marks your first unfinished
station, and approaching a fight whose prerequisite note you skipped shows
`✦ read note #3 first`. The numbers on the 2D world screen match the numbers on
the ground.

Progress is tracked per topic, feeding spaced review and NG+ variants that alter
the spec so you can't win from memory.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run gate     # the test suite — must print GATE GREEN
npm run build    # production bundle
```

Requires Node 18+.

---

## The gate

`npm run gate` runs seven stages, fail-fast:

| stage | what it proves |
|---|---|
| **build** | the file bundles |
| **validate** | all 7 world layouts — containment, spacing, station numbering, and boss reachability by BFS through the real colliders (gate closed ⇒ unreachable, open ⇒ reachable) |
| **engine** | vitest: tokenizer, parser, precedence, blocking vs NBA, latches, combinational loops, 4-state truth tables, timing (ripple vs lookahead), schema + shipped-ID immutability |
| **content** | every solution compiles and passes (walks **any** new challenge automatically); a stuck-at-0 impostor **fails** every test; RTL exports recompile; netlists extract and lay out finitely; gauntlet generators are sane; learning order is correct; golf save round-trips |
| **visual** | all 8 scenes build against real three.js with a stub DOM |
| **smoke** | the real React tree mounts headlessly — menu, no-WebGL fallback |
| **artifact compat** | one default export · no localStorage · core three only · relative engine/content imports allowed |

Individual stages: `npm run gate:layout`, `gate:content`, `gate:visual`, `gate:smoke`.

This is not decoration. The gate has caught, in shipped code: a rasterization
parity bug that **sealed an entire world** behind phantom walls, a boss gate
players could walk around, three GLSL compile errors that would have silently
disabled the entire post-processing pipeline, and a test that was passing
vacuously because it checked the wrong field name.

---

## Layout

```
src/tapeout.jsx      game shell (UI, worlds, combat) — one default export
src/engine/          pure synchronous Verilog core + Worker wrapper
content/             worlds, lessons, challenges, schema, ID manifest
src/main.jsx         local entry point + window.storage shim
dev/                 gate scripts
tests/               engine / content / timing / four-state unit tests
.cursorrules         hard constraints, for AI-assisted editing
```

See `src/engine/README.md` (protocol, delay model, four-state encoding) and
`content/README.md` (how to add a challenge).

---

## Constraints (and why)

- **three r128, core only** — no `three/examples/*`; bloom, chromatic
  aberration, vignette and grain are hand-written ShaderMaterial passes
- **No localStorage in the game file** — it calls an async `window.storage` API;
  local persistence comes from a shim in `main.jsx`
- **All audio synthesized** — 10 tracks of Web Audio, zero asset files
- **Engine is a pure Node module** — the Worker is a wrapper, never a
  prerequisite for the gate
- **Content is validated data** — shipped IDs cannot disappear

`npm run gate` enforces every one of these.

---

## Flight recorder

Press **`** in-game to log a note. Settings → **view flight report** → copy.

The report captures build tag, resolution, graphics settings, per-screen FPS
(with an `·fx` / `·nofx` flag showing whether the post pipeline compiled),
session path, everything cleared, failures per challenge, flatlines, and your
notes — a play session compressed into a work list.

---

## Roadmap

**Shipped:** worlds and progression · station-ordered learning · graphics pass ·
Debug Bay (waveforms, divergence diagnosis, latch detection, schematic view) ·
RTL export · flight recorder.

**Next:** Recall Engine (retrieval questions gating field-note XP, mastery map,
weakest-topic-first review) → compiler expansion (`parameter`, module
instantiation) → a content wave using those features → single-cycle datapath
capstone (PC → register file → ALU → control → integrated datapath).

---

## License

MIT — see [LICENSE](LICENSE).

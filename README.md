# TAPEOUT — the Verilog dojo

[![gate](https://github.com/USERNAME/tapeout-dojo/actions/workflows/gate.yml/badge.svg)](https://github.com/USERNAME/tapeout-dojo/actions/workflows/gate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[▶ Play it in the browser](https://USERNAME.github.io/tapeout-dojo/)**

**A first-person 3D RPG that teaches you to design chips.** You walk seven
worlds, read field notes, fight creatures by writing Verilog, and export your
designs as real synthesizable RTL with self-checking testbenches and Tiny
Tapeout wrappers.

There is a working Verilog compiler and event simulator inside the game. Boss
health bars *are* test vectors. When your circuit fails, the game shows you the
waveform, the exact cycle where reality diverged, and a schematic of the gates
your code actually became.

One file. No engine, no asset pipeline, no backend.

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

`vCompile()` is a real lexer → parser → elaborator → 2-state event simulator for
the synthesizable Verilog subset. Not regex matching, not string comparison
against a stored answer — your module is compiled and simulated against test
vectors, so any correct implementation passes and a wrong one fails for the
right reason.

**Supported:** `assign`, `always @(*)`, `always @(posedge clk)`, blocking and
non-blocking assignment, `if`/`else`, `case`, vectors, part-selects, bit-selects,
concatenation and replication, and the full operator set — bitwise, logical,
arithmetic, comparison, shift, reduction.

**Not supported, deliberately:** module instantiation, `parameter`, `$display`,
delays, four-state logic. The dojo teaches the synthesizable core.

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

`npm run gate` runs six stages, fail-fast:

| stage | what it proves |
|---|---|
| **build** | the file bundles |
| **validate** | all 7 world layouts — containment, spacing, station numbering, and boss reachability by BFS through the real colliders (gate closed ⇒ unreachable, open ⇒ reachable) |
| **content** | 309 checks: every solution compiles and passes; a stuck-at-0 impostor **fails** every test; RTL exports recompile; netlists extract and lay out finitely; gauntlet generators are sane; learning order is correct |
| **visual** | all 8 scenes build against real three.js with a stub DOM; progress sync and the NEXT beacon behave |
| **smoke** | the real React tree mounts headlessly — menu, Tapeout Bay, no-WebGL fallback, flight recorder |
| **artifact compat** | one default export · no localStorage · core three only |

Individual stages: `npm run gate:layout`, `gate:content`, `gate:visual`, `gate:smoke`.

This is not decoration. The gate has caught, in shipped code: a rasterization
parity bug that **sealed an entire world** behind phantom walls, a boss gate
players could walk around, three GLSL compile errors that would have silently
disabled the entire post-processing pipeline, and a test that was passing
vacuously because it checked the wrong field name.

---

## Layout

```
src/tapeout.jsx    the entire game — one file, one default export
src/main.jsx       local entry point + window.storage shim (not part of the game)
dev/               gate scripts
.cursorrules       hard constraints, for AI-assisted editing
```

`src/tapeout.jsx` opens with a table of contents listing 36 sections — grep a
title to jump. Major regions: `VERILOG ENGINE`, `CONTENT`, `DEBUG BAY CORE`,
`FLIGHT RECORDER`, `COMBAT SYSTEM`, `FAB CAMPUS`, `BIT MINES`,
`TRAIL DUNGEON MODELS`, `ULTRA POST PIPELINE`, `ULTRA FAB LAYER`, `APP SHELL`.

---

## Constraints (and why)

The file has to run in two places: locally under Vite, and pasted straight into
a Claude.ai artifact. That forces real discipline:

- **One file, one default export** — no module splitting
- **three r128, core only** — no `three/examples/*`; bloom, chromatic
  aberration, vignette and grain are hand-written ShaderMaterial passes, and the
  pipeline self-checks on startup and falls back cleanly if a shader won't
  compile on the host GPU
- **No localStorage in the game file** — it calls an async `window.storage` API;
  local persistence comes from a shim in `main.jsx`, so the game file stays
  artifact-legal
- **All audio synthesized** — 10 tracks of Web Audio, zero asset files

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

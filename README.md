# TAPEOUT — the Verilog dojo

[![gate](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml/badge.svg)](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[▶ Play it in the browser](https://jspeck12-bot.github.io/tapeout-dojo/)**

**A first-person 3D RPG that teaches you to design chips.** You walk seven
worlds, read field notes, fight creatures by writing Verilog, and export your
designs as real synthesizable RTL with self-checking testbenches and Tiny
Tapeout wrappers.

There is a working Verilog compiler and event simulator inside the game. Boss
health bars *are* test vectors. When your circuit fails, the game shows you the
waveform, the exact cycle where reality diverged, and a schematic of the gates
your code actually became.

No backend and no game engine. The source is organized by subsystem and ships
as a static Vite bundle.

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

**Not supported, deliberately:** module instantiation, `$display`, delays,
four-state logic, and advanced generate constructs. Parameters/localparams are
supported; hierarchical instantiation is a planned compiler extension.

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
npm run test:rtl # independent Icarus compile/simulation (requires iverilog)
npm run build    # production bundle
```

Development tooling requires Node 20.19+, Node 22.13+, or Node 24+.

---

## The gate

`npm run gate` runs fail-fast:

| stage | what it proves |
|---|---|
| **build** | the complete module graph bundles |
| **compatibility** | one public default export, approved dependencies, storage boundary, and three.js constraints |
| **unit** | compiler, simulator, save, recall, and RPG tests pass with no skipped/todo tests |
| **validate** | all 7 world layouts — containment, spacing, station numbering, and boss reachability by BFS through the real colliders (gate closed ⇒ unreachable, open ⇒ reachable) |
| **content** | canonical solutions/remixes pass, impostors fail, external fixtures pin teaching order and vectors, RTL exports are complete, netlists stay finite, and generated rounds remain deterministic |
| **visual** | all 9 scenes build against real three.js; scene density, gates, progress colors, and NEXT-beacon wiring are validated |
| **smoke** | the real React tree mounts headlessly — menu, Tapeout Bay, all no-WebGL fallbacks, and a positive stub-renderer path |

Individual stages: `npm run gate:layout`, `gate:content`, `gate:visual`, `gate:smoke`.

The original gate scripts described by the early README were not present in
repository history. The checked-in suite is an explicitly reconstructed and
expanded replacement; it does not claim historical check-count equivalence.

This is not decoration. The gate has caught, in shipped code: a rasterization
parity bug that **sealed an entire world** behind phantom walls, a boss gate
players could walk around, three GLSL compile errors that would have silently
disabled the entire post-processing pipeline, and a test that was passing
vacuously because it checked the wrong field name.

---

## Layout

```
src/tapeout.jsx    stable two-line default-export entry
src/app/           App shell and versioned save contracts
src/engine/        Verilog compiler/simulator, netlists, diagnostics, RTL export
src/game/          canonical content, RPG systems, spaced recall
src/world/         collision, progression, layouts, pure world models
src/graphics/      three.js primitives, post FX, creatures, world builders
src/audio/         synthesized SFX, tracks, and music engine
src/ui/            shared UI and screen families
src/telemetry/     flight recorder
dev/ + tests/      quality gate and focused regression tests
```

Subsystem filenames deliberately mirror the former section banners, so a new
contributor can move from engine → game → world → graphics → UI without tracing
a monolithic scope.

---

## Constraints (and why)

The retired Claude-artifact constraint no longer requires a monolith.

- **three.js is pinned to r185** — modern color management and `three/addons`
  are available to the shared rendering pipeline.
- **Save compatibility is stable** — game code uses async `window.storage`;
  local persistence remains isolated to the `main.jsx` shim.
- **All audio is synthesized** — 10 procedural Web Audio tracks.
- **Visual assets are permitted** when their source/license is documented.
- **Runtime dependencies stay deliberate** — upgrades and additions are
  standalone proposals rather than feature-phase side effects.

---

## Flight recorder

Press **`** in-game to log a note. Settings → **view flight report** → copy.

The report captures build tag, resolution, graphics settings, per-screen FPS
(with an `·fx` / `·nofx` flag showing whether the post pipeline compiled),
session path, everything cleared, failures per challenge, flatlines, and your
notes — a play session compressed into a work list.

---

## Roadmap

**Shipped:** guided first-run prologue · interactive Codex and mastery die ·
retrieval-gated field notes · shared exploration maps/checkpoints/secrets/history ·
worlds and progression · station-ordered learning · all-world cinematic art direction ·
Debug Bay (waveforms, divergence diagnosis, latch detection, schematic view) ·
RTL export · flight recorder · spaced review scheduling and Recall Lab.

**Next:** seven-boss encounter overhaul →
module instantiation → hierarchical content → single-cycle datapath capstone
(PC → register file → ALU → control → integrated datapath).

---

## License

MIT — see [LICENSE](LICENSE).

# TAPEOUT — the Verilog dojo

[![gate](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml/badge.svg)](https://github.com/jspeck12-bot/tapeout-dojo/actions/workflows/gate.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A first-person 3D RPG that teaches chip design. You walk seven worlds, read
field notes, and fight by writing **real Verilog**. Boss health bars *are*
test vectors. Passing a fight means your module compiled and simulated
correctly — not that you matched a string.

Built by **Joshua Speck**. Static Vite app: no backend, no Unity, no asset
pack. The interesting part is the compiler.

```bash
npm install && npm run dev    # http://localhost:5173
```

**[▶ Play in the browser](https://jspeck12-bot.github.io/tapeout-dojo/)** (GitHub Pages, deploys from `main`)

---

## What this is

A teaching game wrapped around a **working HDL toolchain in the browser**:

| Layer | What you get |
|---|---|
| **Compiler** | Lexer → parser → elaborator → four-state event simulator for a synthesizable Verilog subset (`src/engine/`) |
| **Debug Bay** | First-divergence diagnosis, waveforms (X = red hatch, Z = dashed), gate-level schematic, educational static timing |
| **Export** | Synthesizable RTL + self-checking testbench + Tiny Tapeout `tt_um_*` wrapper |
| **Worlds** | 7 stations, 44 challenges, 25 field notes, 4 bosses (CHIP-1 is a sequential accumulator-ALU) |

Wrong code fails for the right reason. An incomplete `always @(*)` draws the
**inferred latch** as a dashed red feedback loop. Combinational loops are a
named error, not a frozen tab — simulation runs on a Web Worker with hard
timeouts.

Runtime dependencies: `react`, `react-dom`, `three@0.128`, `lucide-react`.

---

## Architecture

```
┌─ browser ─────────────────────────────────────────────────────┐
│  src/tapeout.jsx          game shell (worlds, combat, UI)     │
│       │                                                       │
│       ├─ content/         catalog: worlds, notes, challenges  │
│       └─ engine client ─ Worker (2s compile / 5s sim) ─┐      │
│                         └ fallback: same core, main thread    │
└───────────────────────────────────────────────────────────────┘
                              │
                    src/engine/core.js
                    (pure Node — no DOM, no Worker)
                              │
┌─ npm run gate ────────────────────────────────────────────────┐
│  vitest + layout BFS + every shipped solution compiles/passes │
│  + impostor fails + RTL recompiles + visual + React smoke     │
└───────────────────────────────────────────────────────────────┘
```

The gate **never** goes through the Worker. It imports the engine
synchronously. That is deliberate: a compiler you can only test in a browser
is a compiler you cannot trust.

Details: [ARCHITECTURE.md](ARCHITECTURE.md) · [src/engine/README.md](src/engine/README.md) · [content/README.md](content/README.md)

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run gate     # must print GATE GREEN
npm run build    # production bundle
```

Node 18+.

`npm run gate` is fail-fast: bundle → 7-world layout BFS → engine unit tests
(tokenizer, NBA vs blocking, latches, combinational loops, 4-state, timing) →
every solution compiles and a stuck-at-0 impostor fails → headless three.js
scenes → React smoke → artifact constraints (one default export, no
`localStorage` in the game file, core three only).

---

## Layout

```
src/tapeout.jsx     game shell — one default export
src/engine/         Verilog core + Worker wrapper
src/main.jsx        Vite entry + window.storage shim (not game code)
content/            worlds, lessons, challenges, ID manifest
dev/                gate scripts (copy source; never edit tapeout.jsx in place)
tests/              vitest: engine, timing, four-state, schema
.github/workflows   gate.yml on every PR; pages.yml deploys main
```

---

## What's on `main` vs other branches

**`main` is the product.** Compiler, four-state sim, Worker isolation,
validated content catalog, Debug Bay, RTL export, gate.

These branches are **experiments — not merged, not the resume piece:**

| Branch | What it is | Why it is not on `main` |
|---|---|---|
| `cursor/foundation-onboarding-codex-e1a1` | Modular UI split, onboarding, Codex | Different three.js major (r185). Engine mainline is r128. |
| `cursor/silicon-gothic-overhaul-d485` | Art / lighting pass | Presentation prototype. Must not land with the engine. |
| `cursor/combat-overhaul-prototype-b003` | Combat-loop prototype | Gameplay experiment. Same rule. |

Older setup PRs were scaffolding for this tree and are closed.

---

## Constraints (and why)

- **three r128, core only** — no `three/examples/*`. Bloom / CA / vignette /
  grain are hand-written `ShaderMaterial` passes.
- **No `localStorage` in the game file** — it calls async `window.storage`;
  `src/main.jsx` shims it for local play.
- **Audio is synthesized** — Web Audio, zero sample files.
- **Engine is a pure Node module** — Worker is a wrapper, not a prerequisite.
- **Shipped challenge IDs are immutable** — `content/ids.manifest.json`.
- **The 28 canonical solutions are regression oracles** — do not “fix” them
  to make the engine happier.

---

## Roadmap

**Shipped:** seven worlds · station-ordered learning · Worker-isolated
four-state compiler · Debug Bay (waveforms, divergence, latches, schematic,
educational STA) · RTL + Tiny Tapeout export · flight recorder · gate.

**Next:** Recall Engine (retrieval questions, mastery map) → compiler
`parameter` / module instantiation → a content wave that needs those
features → single-cycle datapath capstone (PC → regfile → ALU → control).

---

## License

MIT — see [LICENSE](LICENSE).

# Architecture

TAPEOUT is a static web app: a three.js RPG shell, a Verilog compiler that
runs in the browser *and* in Node, and a content catalog the gate treats as
data.

## Three trees

| Tree | Role | Import surface |
|---|---|---|
| `src/tapeout.jsx` | Game shell: worlds, combat, Debug Bay, Forge, post-FX | One `export default` |
| `src/engine/` | Lexer, parser, elaborator, four-state event sim, netlist, STA, RTL export | Pure ESM; Node-safe |
| `content/` | Worlds, field notes, challenges, gauntlets, gear, ID freeze | Data modules + valibot in the gate only |

`src/main.jsx` is glue: `createRoot` plus a `window.storage` localStorage
shim. The game never touches `localStorage` itself (artifact runtime).

## Engine pipeline

```
source text
    → tokenize (core.js)
    → parse / elaborate
    → VSim event queue          four-state { v, xz, z, w }
    → runCombTest / runSeqTest
    → netlistOf                 gates, inferred latches
    → analyzeTiming             unit-delay + fanout; wire delay ignored
    → exportRTL                 module + TB + tt_um_* wrapper
```

Browser path: `src/engine/client.js` posts `{ id, op, ... }` to
`worker.js`. Ops: `compile | runTest | netlist | timing | export | run`.
Timeouts (2s / 5s) **terminate and respawn** the Worker. A newer
submission supersedes in-flight work. If `Worker` is missing, the same
`handleEngineRequest` runs on the calling thread.

Gate path: `import { vCompile, runChallengeTest } from './src/engine/core.js'`.
No Worker, no DOM.

Registers power up **X**. Wires power up **0**. Combinational loops hit
`SIM_MAX_DELTA` / `SIM_MAX_EVENTS` and return `COMBINATIONAL_LOOP` with
the nets involved — they do not hang the tab.

Educational STA (`DELAY_MODEL` in `timing.js`) is **not sign-off-grade**.
Inferred `+`/`−`/`*` scale with width (ripple). Writing an explicit
lookahead from gates can beat `a+b` on the critical path; that comparison
is the lesson.

See [src/engine/README.md](src/engine/README.md) for the protocol table and
the four-state encoding.

## Content

Challenges live under `content/world-N/`. Adding one is an object in
`challenges.js`, an id in `order.js` / `training.js`, and a line in
`content/ids.manifest.json`. The content gate walks **every** entry:
solution compiles and passes, a stuck-at-0 impostor fails, RTL recompiles,
netlist lays out finitely.

Save keys are load-bearing. Removing a shipped id fails the gate.

See [content/README.md](content/README.md).

## Why the shell stays one file

`tapeout.jsx` still has to paste into a Claude.ai artifact: one default
export, no `localStorage`, core three only. The engine and catalog split
out because they are independently testable. The shell did not.

Post-processing is hand-rolled (`makePostFX`): `ShaderMaterial` +
`WebGLRenderTarget`. No `three/examples`, no EffectComposer. three **r128**
on `main` is a binding constraint — CapsuleGeometry does not exist; use
Cylinder + Sphere.

## Gate vs CI

`npm run gate` (`dev/gate.cjs`) copies `src/` + `content/` into `.gate/`,
appends exports to a **copy** of `tapeout.jsx`, then runs:

1. esbuild bundle
2. artifact constraints
3. layout validation (7 worlds, collider BFS)
4. vitest engine / timing / 4-state / schema
5. content (solutions + impostors + RTL)
6. visual harness (headless three.js)
7. React smoke

`.github/workflows/gate.yml` runs that on every pull request and on
`main`. `.github/workflows/pages.yml` builds the Vite bundle and deploys
GitHub Pages from `main` only.

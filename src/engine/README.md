# Simulation engine

Pure, synchronous Verilog subset: lexer → parser → elaborator → event simulator,
netlist extraction, educational static timing, RTL export.

**No DOM, no React, no three.js, no Worker assumptions.** Node and the gate
import this tree directly.

```js
import { vCompile, runChallengeTest, netlistOf } from './core.js';
// netlistOf lives in ./netlist.js; re-exported from ./index.js
```

Worker isolation is a wrapper (`client.js` / `worker.js`) around the same
`handleEngineRequest` used in tests. TypeScript is a later, separate migration.

## Message protocol

Every request carries `id` so in-flight replies cannot be mismatched.

| `op` | payload | timeout |
|---|---|---|
| `compile` | `{ src, iface }` | 2s |
| `runTest` | `{ src, iface, test }` | 5s |
| `netlist` | `{ src, iface }` | 2s |
| `timing` | `{ src, iface }` | 2s |
| `export` | `{ challenge }` | 5s |
| `run` | `{ src, iface, test, want[] }` | 5s |

`test` must be structured-cloneable. `serializeTest()` expands `makeRef` into
an `expected[]` array before posting. Mods revive `Map` via `reviveMod`.

On timeout the client **terminates** the worker, spins a fresh one, and returns
`code: 'TIMEOUT'` with the hint *your design didn't settle; check for a
combinational loop*. A newer submission supersedes in-flight work the same way
(terminate + respawn). If `Worker` is missing, `createMainThreadClient()` runs
`handleEngineRequest` on the calling thread — the no-WebGL path still fights.

Inside the simulator: `SIM_MAX_DELTA = 256` delta cycles and
`SIM_MAX_EVENTS = 100000` per `settle()`. A combinational loop throws
`COMBINATIONAL_LOOP` naming the signals involved.

## Four-state encoding

Per-bit two-plane + Z mask (`values.js`), Verilator-style:

| bit | `v` | `xz` | `z` |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 1 | 1 | 0 | 0 |
| X | 0 | 1 | 0 |
| Z | 0 | 1 | 1 |

Registers power up **X**. Wires power up **0** so `assign y = ~y` still
oscillates and is diagnosed instead of collapsing to X. Operator tables
(`1'bx & 1'b0` → `0`) live in `values.js` and are gated by the 4-state suite.

## Delay model

`DELAY_MODEL` in `timing.js` is the whole table. Unit-delay plus fanout.
**Wire delay is ignored.** Not sign-off-grade. Inferred `+`/`-`/`*` scale with
width (ripple). Explicit lookahead written from gates can beat `a + b` — that
is the lesson, measured in the Debug Bay timing tab.

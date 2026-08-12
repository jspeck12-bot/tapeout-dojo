# AGENTS.md

## Cursor Cloud specific instructions

### Layout
- `src/tapeout.jsx` is the stable two-line default-export entry. The game is
  modular: `engine/`, `game/`, `world/`, `graphics/`, `audio/`, `ui/`, `app/`,
  and `telemetry/` each own one subsystem.
- `src/main.jsx` is local Vite glue (React 18 `createRoot` plus the async
  `window.storage` localStorage shim). `index.html` loads `/src/main.jsx`.

### Running
- Dev server: `npm run dev` → http://localhost:5173.
- Production build: `npm run build`.
- Focused checks: `npm test`, `npm run lint`, `npm run format:check`.

### The gate (`npm run gate`) — RECONSTRUCTED, new coverage
- The original `dev/*.cjs` gate scripts were never committed to this repo (absent
  from all git history, tags, branches, forks, and CI). The current `dev/` gate
  is a REBUILT approximation that exercises the real game internals. Its check
  counts are its own — it does NOT reproduce the README's original 309-check
  content suite. Treat the numbers as this suite's, not the historical ones.
- Stages (fail-fast, must print `GATE GREEN`): build · compatibility · unit ·
  layout (`gate:layout`) · content (`gate:content`) · visual (`gate:visual`) ·
  smoke (`gate:smoke`).
- `dev/_shared.cjs` copies the complete `src/` module graph into `.gate/`,
  appends test-only exports to the copied entry, and bundles that copy to CJS.
  Runtime modules never receive test-only exports.
- Content fixtures independently pin lesson/challenge/station order, vectors,
  truth tables, generated rounds, netlists, and RTL exports. Layout BFS-checks
  boss reachability through true colliders. Visual checks scene density,
  progress synchronization, every campus gate, and NEXT behavior. Smoke covers
  all four no-WebGL consoles plus a positive stub-renderer path.

### Headless / computer-use rendering caveat
- In GPU-less environments (the computer-use browser, the gate's smoke/visual
  stages) the three.js WebGL scene falls back to a text/console interface. The
  game degrades gracefully: menu, world screens, the Verilog challenge engine,
  and combat all work without WebGL. Use this fallback to test core gameplay.

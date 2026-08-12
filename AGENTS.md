# AGENTS.md

## Cursor Cloud specific instructions

### Layout
- The single-file game is `src/tapeout.jsx` (one `export default function App()`),
  matching the README and `.cursorrules`. `src/main.jsx` is the local Vite entry
  point (React 18 `createRoot` + the async `window.storage` localStorage shim);
  it is glue, NOT part of the game, and stays out of the artifact-legal file.
  `index.html` loads `/src/main.jsx`.

### Running
- Dev server: `npm run dev` → http://localhost:5173. Babel prints a one-time
  "code generator has deoptimised the styling …" notice because `src/tapeout.jsx`
  is ~670KB; it is harmless.
- Production build: `npm run build`.

### The gate (`npm run gate`) — RECONSTRUCTED, new coverage
- The original `dev/*.cjs` gate scripts were never committed to this repo (absent
  from all git history, tags, branches, forks, and CI). The current `dev/` gate
  is a REBUILT approximation that exercises the real game internals. Its check
  counts are its own — it does NOT reproduce the README's original 309-check
  content suite. Treat the numbers as this suite's, not the historical ones.
- Stages (fail-fast, must print `GATE GREEN`): build · artifact-compat · layout
  (`gate:layout`) · content (`gate:content`) · visual (`gate:visual`) · smoke
  (`gate:smoke`).
- Mechanism (per `.cursorrules`): `dev/_shared.cjs` copies the source to `.gate/`,
  appends a single `export { … }` line, and esbuild-bundles that COPY to CJS —
  it NEVER adds exports to `src/tapeout.jsx`. `react`/`three`/`lucide-react` are
  left external so there is one React instance (needed by the smoke test's
  react-test-renderer). `.gate/` is gitignored.
- Content stage compiles+simulates every reference solution and NG+ remix with
  the real `vCompile`, asserts a stuck-at-0 impostor fails, and recompiles RTL
  exports. Layout stage BFS-checks boss reachability through the true colliders
  (gate closed ⇒ unreachable, open ⇒ reachable) — this is the sealed-world /
  phantom-wall detector. Visual builds all 3D scene graphs headless. Smoke mounts
  `<App/>` and routes into a world to hit the no-WebGL fallback.

### Headless / computer-use rendering caveat
- In GPU-less environments (the computer-use browser, the gate's smoke/visual
  stages) the three.js WebGL scene falls back to a text/console interface. The
  game degrades gracefully: menu, world screens, the Verilog challenge engine,
  and combat all work without WebGL. Use this fallback to test core gameplay.

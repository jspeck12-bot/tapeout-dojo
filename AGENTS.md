# AGENTS.md

## Cursor Cloud specific instructions

### Repo layout reality (differs from README)
- The single-file game lives at `tapeout-rpg_4.jsx` in the repo **root**, not at
  `src/tapeout.jsx` as the README/`.cursorrules` describe. It has exactly one
  `export default function App()`.
- The local Vite entry point is `src/main.jsx`. `index.html` loads
  `/src/main.jsx`, which imports the game from `../tapeout-rpg_4.jsx`, mounts it
  with React 18 `createRoot`, and installs the async `window.storage` shim
  (localStorage-backed) that the game expects. `src/main.jsx` is glue only — it
  is NOT part of the game and stays out of the artifact-legal single file.

### Running
- Dev server: `npm run dev` → http://localhost:5173 (see `package.json`). Note
  Babel prints a one-time "code generator has deoptimised the styling …" notice
  because `tapeout-rpg_4.jsx` is ~670KB; this is harmless.
- Production build: `npm run build` (bundles ~1500 modules into `dist/`).

### Tests / lint (currently unavailable in this checkout)
- The gate/test scripts declared in `package.json` (`npm run gate`,
  `gate:layout`, `gate:content`, `gate:visual`, `gate:smoke`) invoke
  `dev/*.cjs` files that are **not present** in this repository, so they fail
  with "Cannot find module". There is no lint script. Do not assume the gate
  runs until the `dev/` scripts are added.

### Headless / computer-use rendering caveat
- In GPU-less environments (e.g. the computer-use browser) the three.js WebGL
  scene falls back to a text/console interface. The game degrades gracefully:
  the menu, world screens, the Verilog/binary challenge engine, and combat all
  still work end-to-end without WebGL. Use this fallback path to test core
  gameplay when 3D rendering is unavailable.

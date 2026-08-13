# Authoring TAPEOUT content

Challenges, lessons, gauntlets, achievements, and gear live under `content/`,
organized by world. The game (`src/tapeout.jsx`) imports the catalog — it does
not hardcode challenge objects. **Adding a Verilog challenge is one data entry
and zero engine/UI edits.** The gate walks every challenge automatically.

## Add a Verilog challenge

1. Open `content/world-N/challenges.js` for the world the drill belongs to
   (3 Foundry, 4 Canyon, 5 Clock Tower, 6 Fortress, 7 TAPEOUT).
2. Append one object to `CODE_CHALLENGES`. Required fields:

   | field | rule |
   |---|---|
   | `id` | Immutable save key. `[A-Za-z][A-Za-z0-9_+]*`, unique across the catalog. Never rename a shipped id. |
   | `world` | Integer 1–7, matching the folder. |
   | `title`, `brief`, `xp` | Pedagogy. Test vectors are deliberate — don't rewrite them to make the engine happier. |
   | `iface` | `{ name, ports: [{ n, d: 'in'\|'out', w }] }`. Ports must match the module. |
   | `starter`, `hints`, `solution` | `solution` is the regression oracle. It must compile and pass `test`. |
   | `test` | `{ type: 'comb', vectors }` via `combVecs(...)` or `{ type: 'seq', watch, frames, makeRef }`. Outputs named in `test` must be ports. |

   Worked example (world 3):

   ```js
   {
     id: 'm8', world: 3, title: 'OR Gate', xp: 40,
     brief: "Drive `y` as the OR of `a` and `b`. One `assign`.",
     iface: { name: 'or_gate', ports: [
       { n: 'a', d: 'in', w: 1 }, { n: 'b', d: 'in', w: 1 }, { n: 'y', d: 'out', w: 1 }
     ] },
     starter: "module or_gate(\n  input a, input b, output y\n);\n\nendmodule\n",
     hints: ["`assign y = a | b;`"],
     solution: "module or_gate(input a, input b, output y);\n  assign y = a | b;\nendmodule\n",
     test: { type: 'comb', vectors: combVecs([{ n: 'a', w: 1 }, { n: 'b', w: 1 }], (i) => ({ y: i.a | i.b })) }
   }
   ```

3. Add `m8` to `WORLD_ORDER` in `content/order.js` (station sequence vs 2D/3D
   worlds) and `TOPIC_OF` in `content/training.js`.
4. Append the new id to `content/ids.manifest.json` under `challenge`.
   **Removing or renaming a shipped id fails the gate.** New ids must be added
   to the manifest or the next author will think they vanished.
5. Run `npm run gate`. Schema violations print the file and field. The 28
   canonical solutions are never edited to make a check pass.

## Other content types

- **Lessons** — `content/lessons.js` (and `content/world-N/lessons.js` re-exports).
  Ids are `L{world}{letter}` (`L3a`). `LESSON_DEPTH` is the "going deeper" layer.
- **Gauntlets** — `content/world-N/gauntlets.js`. `gen(rng, i)` returns either
  `{ check, answer }` or `{ kind: 'mc', options, correct }`.
- **Truth tables** — `content/world-2/challenges.js` (`TRUTH_CHALLENGES`).
- **NG+ remixes** — `content/remix.js` via `defRemix(id, { ... })`. The `id`
  must already exist as a code challenge.
- **Gear / achievements** — `content/gear.js`, `content/achievements.js`.
- **Training generators** — `content/training.js`. Dynamic; not in the id
  manifest (they don't key the save the same way).

## Schema (enforced at gate / `npm run gate:content`)

- Required fields present, id format, world in 1–7.
- Interface and test vectors name the same ports.
- Every code challenge has a topic; remixes point at a real base id.
- `WORLD_ORDER` only lists ids that exist in the catalog.
- Shipped ids in `ids.manifest.json` cannot disappear.

valibot is a **gate** dependency. The running game never imports `schema.js`.

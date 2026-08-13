ART style guide: done
ART w1 Bit Mines: done
ART hub Fab Campus: done
ART w2 Gate Valley: done
ART w3 Module Foundry: done
ART w4 Combinational Canyon: done
ART w5 Clock Tower: done
ART w6 FSM Fortress: done
ART w7 TAPEOUT: done
ART Arcade: done
UI tokens + Button/Panel: done
UI CodeMirror workbench: done
UI menu: done
UI world select: done
UI Debug Bay: done
UI notes: done
UI HUD: done
UI victory: NEXT
UI forge/shop: todo
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1803 — Silicon Gothic Operator HUD: shared `ExploreHud` (vitals plate, zone plaque, fab reticle, engage prompt, help Panel, campus radar bezel) on tokens; `HudScreen` at `?screen=hud` with `?scene=` / `?still=1`; menu **OPERATOR HUD**; bound into campus/mine/dungeon/arcade. 3 commits (build + still modes + rail contrast). GATE GREEN (139 unit).
Still explore: THE FOUNDRY FLOOR + [E] ENGAGE STATION · #3 NAND ARRAY + reticle over STACK stage; PNG ~1161 KB @2560×1440.
Still sealed: GATE THRESHOLD + SEALED danger plate; PNG ~1159 KB.
Still campus: ARRIVAL WALK + cyan prompt + radar bezel (sparse fake pip); PNG ~1188 KB.
Still wrong: CSS stage reads graybox if mistaken for Foundry 3D; rail buttons improved but still quiet vs zone/prompt plates; fake radar nearly empty; ultrawide empty field.

## Known problems
- HUD: showcase stage is abstract CSS (STACK + path ribbon), not a live 3D world — easy to misread as unfinished Foundry art.
- HUD: rail menu/map/graphics/settings plates still quieter than zone plaque / engage prompt.
- HUD: campus fake radar is a single pip — fine for bezel proof, not a dense floorplan.
- Notes: mastery die steals vertical space from holo reader even after compact pass.
- Notes: NoteTerminal live widgets / `.card` chrome not fully on tokens (CSS restyle only).
- Notes: unrecovered cartridge list dominates rack scroll vs recovered titles.
- Debug Bay: CRT under-fills vertically once traces are short; schematic scale still leaves dead phosphor.
- Debug Bay: not yet bound into CodeScreen (showcase route only, same pattern as workbench).
- World select: locked pads desaturated → short names/tags hard to scan.
- World select: bond/scribe hardware still subtle vs pad grid; WAFER mark easy to miss.
- World select/menu/debugbay/notes/hud ultrawide: empty side gutters / dark field outside chrome.
- Menu: world-map labels (Foundry/Clock/Fortress) partially occluded by Bay control veil/panel.
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required (`git -c commit.gpgsign=false`).

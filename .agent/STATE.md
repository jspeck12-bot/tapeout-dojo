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
UI victory: done
UI forge/shop: NEXT
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
ui-pass-1906 — Silicon Gothic yield report: shared `VictoryReport` (notched chassis, probe bins, ticking stats, lot ticket, yield meter) on tokens; `VictoryScreen` at `?screen=victory` with `?scene=` / `?still=1`; menu **YIELD REPORT**; bound into gauntlet/truth/code clears, FlatlineOverlay, LevelUpModal. 2 commits (build + three-bay polish). GATE GREEN (146 unit).
Still signoff: SIGNED OFF + lot ticket #3 NAND ARRAY + yield 67%; PNG ~1.42 MB @2560×1440.
Still flawless: ZERO DEFECT + 3 lit bins + ×1.5 + yield 100%; PNG ~1.41 MB.
Still boss: THE HIERARCH + brass + phases 100%; PNG ~1.41 MB.
Still flatline: FLATLINED + stripped −24 + integrity 0% + ENTER crawl back; PNG ~1.38 MB.
Still levelup: LEVEL 4 → 5 + HP/ATK/DEF; PNG ~1.44 MB.
Still wrong: bay still floats in dark gutters on 2560; 0% integrity meter reads as empty box; wafer grid under wash is easy to miss.

## Known problems
- Victory: 1400px bay still leaves ultrawide gutters; wafer under overlay is quiet vs chassis.
- Victory: integrity 0% meter is an empty track — correct, but looks unfinished in stills.
- Victory: CombatHUD / ShopScreen still on old card chrome (forge/shop + COMBAT are next).
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

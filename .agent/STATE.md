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
UI HUD: NEXT
UI victory: todo
UI forge/shop: todo
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1714 — Silicon Gothic Field Notes / CODEX archive: `NotesScreen` with mastery die, terminal cartridge rack, holo reader (wraps `NoteTerminal`), `NOTES_DEMO_SAVE` for `?screen=notes`, menu **FIELD NOTES ARCHIVE** → live `codex`, `data-notes-status`. 2 commits (build + die density polish). GATE GREEN (134 unit).
Still holo: CODEX_ + Why binary? live number widget + recall; PNG ~978 KB @2560×1440.
Still cartridge: The gate zoo selected, XOR live signal, recall 1/1; PNG ~999 KB.
Still wrong: mastery die still competes with holo for first viewport; NoteTerminal widgets only partially tokenized; long grey UNRECOVERED list clutters rack; ultrawide gutters.

## Known problems
- Notes: mastery die steals vertical space from holo reader even after compact pass.
- Notes: NoteTerminal live widgets / `.card` chrome not fully on tokens (CSS restyle only).
- Notes: unrecovered cartridge list dominates rack scroll vs recovered titles.
- Debug Bay: CRT under-fills vertically once traces are short; schematic scale still leaves dead phosphor.
- Debug Bay: not yet bound into CodeScreen (showcase route only, same pattern as workbench).
- World select: locked pads desaturated → short names/tags hard to scan.
- World select: bond/scribe hardware still subtle vs pad grid; WAFER mark easy to miss.
- World select/menu/debugbay/notes ultrawide: empty side gutters outside the centered shell.
- Menu: world-map labels (Foundry/Clock/Fortress) partially occluded by Bay control veil/panel.
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required (`git -c commit.gpgsign=false`).

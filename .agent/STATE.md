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
UI Debug Bay: NEXT
UI notes: todo
UI HUD: todo
UI victory: todo
UI forge/shop: todo
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1508 — Silicon Gothic die-floorplan world select: `WorldSelectScreen` with seven irregular pads, bond/scribe rails, pad inspector, unlock+progress via `worldUnlockedEx`/`challengesOf`, brass descend CTA + console index, menu DIE FLOORPLAN row, `?screen=worlds` allowlist, `data-worldselect-status`. 2 commits (build + die-metal polish). GATE GREEN (125 unit).
Still: WORLD SELECT_ hero + DIE FLOORPLAN / PAD INSPECTOR; W01 MINES focused; PNG ~975 KB @2560×1440.
Still wrong: locked pads stay muddy (labels hard at a glance); bond rails read as a thin brass edge more than a full pad frame; max-width shell still leaves empty ultrawide gutters; DESCEND brass fill quieter than solid accent swatches from the kit.

## Known problems
- World select: locked pads desaturated → short names/tags hard to scan.
- World select: bond/scribe hardware still subtle vs pad grid; WAFER mark easy to miss.
- World select/menu ultrawide: empty side gutters outside the centered shell.
- Menu: world-map labels (Foundry/Clock/Fortress) partially occluded by Bay control veil/panel.
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required.

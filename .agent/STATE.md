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
UI menu: NEXT
UI world select: todo
UI Debug Bay: todo
UI notes: todo
UI HUD: todo
UI victory: todo
UI forge/shop: todo
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1315 — shipped CodeMirror 6 workbench at `?screen=workbench` (`data-workbench-status`): theme, gutters, Verilog autocomplete, unified merge diff vs `and_gate` solution. Gate allowlist + CM deps. GATE GREEN. 2 commits (build + vertical-fill polish).
Stills: brand + dual panels; syntax + gutters readable; diff shows solution vs stub (~505–520 KB @2560×1440).
Still wrong: autocomplete not visible in stills; merge chunks default red/green; some ultrawide lower empty; CodeScreen still legacy textarea.

## Known problems
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Workbench/UiKit ultrawide: residual empty lower field under content.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required.

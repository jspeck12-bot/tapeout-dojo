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
UI CodeMirror workbench: NEXT
UI menu: todo
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
hourly-1219 — shipped UI foundation: `src/ui/tokens.js`, `Button`/`Panel`/`icons`, `UiKitScreen` at `?screen=uikit` with `data-uikit-status`, vitest. 3 commits (kit + ultrawide polish + mobile grids). GATE GREEN.
Still: brand + brass panels + swatches readable; PNG ~518 KB @2560×1440.
Still wrong: empty lower third on ultrawide (floor grid faint); primary/brass CTAs under-punch as dark gradients; no screen migration yet.

## Known problems
- UiKit ultrawide: large empty lower field; perspective floor grid barely carries depth.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches.
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required.

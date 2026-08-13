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
UI world select: NEXT
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
hourly-1408 — migrated MainMenu to Silicon Gothic tokens: MenuRow + custom fab marks (no stock lucide on menu), Bay control Panel, data-menu-status, `?screen=menu` allowlisted. 2 commits (build + bay-frame/fill polish). GATE GREEN.
Still: brand TAPEOUT hero + CONTINUE brass primary; map trace behind; PNG ~927 KB @2560×1440.
Still wrong: ultrawide side fields empty (narrow bay column); world-map node labels partly veiled by the panel; CONTINUE glow still quieter than solid accent fills.

## Known problems
- Menu ultrawide: empty left/right field around centered bay column.
- Menu: world-map labels (Foundry/Clock/Fortress) partially occluded by Bay control veil/panel.
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Workbench/UiKit ultrawide: residual empty lower field under content.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required.

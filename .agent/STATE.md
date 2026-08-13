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
UI notes: NEXT
UI HUD: todo
UI victory: todo
UI forge/shop: todo
UI settings: todo
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1617 — Silicon Gothic oscilloscope Debug Bay: `DebugBayScreen` with CRT scope face (Waveform + scanlines/graticule), probe channel rack, first-divergence lamp, SCOPE/NETLIST toggle over prologue `tutorial_dff` fault, brass RUN DIAGNOSTIC, `ScopeMark`, menu DEBUG BAY row, `?screen=debugbay` allowlist, `data-debugbay-status`. 2 commits (build + CRT fill polish). GATE GREEN (129 unit).
Still SCOPE: DEBUG BAY_ hero + live CRT with clk/rst/d/q·you/q·ref; mismatch dots + cycle 2 diagnosis; PNG ~1.05 MB @2560×1440.
Still NETLIST: mux→DFF schematic with dashed feedback on CRT; NETLIST mode armed; PNG ~848 KB.
Still wrong: traces fill better after scale but CRT still has empty phosphor below the 5 rows; schematic stays modest vs chassis (scrollbar peeks); App chrome (TAPEOUT/Intern bar) sits above the bay; ultrawide gutters remain; CodeScreen not migrated to this rack yet.

## Known problems
- Debug Bay: CRT under-fills vertically once traces are short; schematic scale still leaves dead phosphor.
- Debug Bay: not yet bound into CodeScreen (showcase route only, same pattern as workbench).
- World select: locked pads desaturated → short names/tags hard to scan.
- World select: bond/scribe hardware still subtle vs pad grid; WAFER mark easy to miss.
- World select/menu/debugbay ultrawide: empty side gutters outside the centered shell.
- Menu: world-map labels (Foundry/Clock/Fortress) partially occluded by Bay control veil/panel.
- Workbench: autocomplete popup not demonstrated in stills; merge chunk colors not fully tokenized.
- Primary/brass buttons read quieter than solid accent fills next to bright swatches (UiKit).
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required.

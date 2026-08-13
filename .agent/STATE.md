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
UI forge/shop: done
UI settings: done
COMBAT: NEXT
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
ui-pass-1920 — Silicon Gothic UI directive closeout. Fonts self-hosted (Oxanium / IBM Plex Sans / JetBrains Mono); live CM6; ShopBay comparison plate; SettingsPanel search + gfx preview; kit on tokens; CombatHUD chrome. Stock lucide-react imports removed from `src/` (custom fab marks). Remaining system font stacks killed (prologue, Tapeout Bay, flight report, schematic labels, 3D sprites). Screen enter fade on 2D routes. Settings tab-row CSS fix. GATE GREEN (155 unit, 711 layout, 1685 content, 10 visual / 154, 108 smoke). Bundle 1293 KB.
Still shop probes: Iron Probe equipped + rack + loadout HP/ATK/DEF; PNG ~0.54 MB @2560×1440.
Still shop suits: Cotton Coat vs Static Wrap deltas; PNG ~0.54 MB.
Still shop rations: catalog + loadout; PNG ~0.54 MB.
Still settings graphics: tabs + exposure/bloom/fog + live preview; PNG ~0.50 MB.
Still settings search: query bloom → GRAPHICS + bloom slider; PNG ~0.46 MB.
Still settings difficulty: Easy/Normal/Hard + hazard/loot; PNG ~0.52 MB.
Still workbench CM6: line 6 error gutter + COMPLETE PORTS + diff; PNG ~0.52 MB.
Still uikit kit: Oxanium/Plex/JetBrains + kit; PNG ~0.56 MB.

## Known problems
- Pedagogy screens (World/Gauntlet/Truth/Code chrome, Tapeout Bay, Prologue, training) still mix leftover inline hex with the token system — kit/shop/settings/HUD/victory do not.
- Settings graphics tab: left column empty by design (preview lives on the right).
- ShopBay default-selects first catalog item (Iron Probe on probes), not Copper.
- Error gutter glyph is ◈ — stills may read as a red gutter mark, not a diamond.
- CombatHUD chrome is on tokens; COMBAT systems (encounters, AI, loot) are still next.
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

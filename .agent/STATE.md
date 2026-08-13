ART style guide: done
ART w1 Bit Mines: done
ART hub Fab Campus: done
ART w2 Gate Valley: done
ART w3 Module Foundry: done
ART w4 Combinational Canyon: done
ART w5 Clock Tower: done
ART w6 FSM Fortress: done
ART w7 TAPEOUT: done
ART Arcade: NEXT
UI: todo (after ART)
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-0958 — shipped Silicon Gothic TAPEOUT (w7): `tapeout-world.js`, DungeonScreen gothic branch + `data-tapeout-status`, unit test, visual-golden dungeon-7 floors retuned.
Spawn still (final): HUD THE TAPEOUT FLOOR, gold path + circular wafer disk readable, 513 calls / 146k tris, PNG ~5.1 MB.
Wafer still blooms toward a sun-disk; TRACE GRACE plate occludes the center; die grid weak at distance; path still hot for “quiet”; arch/spire mass flattens.
3 art commits (slice + tilt + bloom pullback). Next: ART Arcade.

## Known problems
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required this run.

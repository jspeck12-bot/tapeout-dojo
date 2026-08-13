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
UI: NEXT
COMBAT: todo (after UI)
ENGINE: todo (after COMBAT)
AUDIO: todo (after ENGINE)

## Last run
hourly-1102 — shipped Silicon Gothic Arcade: `arcade-world.js`, ArcadeScreen gothic composer + `data-arcade-status`, unit test. Layout/targets/overlays unchanged.
Spawn still (final): HUD THE ARCADE, magenta path + NEON HALL title readable, cabinets as colored screen beacons, 472 calls / 183k tris, PNG ~5.0 MB.
Marquee still reads as a glow blob more than a brass totem; BINARY BLITZ title peeks on the landmark; chassis detail lost in silhouette; grain muddies PBR.
2 art commits (slice + bloom/label polish). ART board complete → next UI.

## Known problems
- Arcade marquee: spin-ring / brass column silhouette weak vs bloom+grain; BINARY BLITZ label still near landmark base.
- TAPEOUT wafer: die grid / silicon read lost under bloom + TRACE GRACE occlusion from spawn.
- FSM Fortress landmark silhouette: Keep aperture dominates; tower/pylon/crown beacon do not clearly read above bloom from spawn.
- SSH commit signing agent often BrokenPipe here — unsigned commits required this run.

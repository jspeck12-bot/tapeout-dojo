import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Cpu, Zap, Trophy, Star,
  ChevronLeft, Check, X, BookOpen,
  RotateCcw, Play, Terminal, ChevronRight,
  Sparkles, Medal,
  Coins,
  Gamepad2, Settings
} from "lucide-react";
import * as THREE from "three";
import { exportRTL } from './engine/debug/rtl-export.js';
import {
  conceptMastery, dueTopics, masteryLevel, reviewUpdate, todayNum,
} from './game/recall.js';
import {
  hashStr, WORLDS, LESSONS, LESSON_DEPTH,
  GAUNTLETS, CODE_CHALLENGES,
  ACHIEVEMENTS, RANKS, MODES, modeOf, TOPIC_LIST, TOPIC_OF,
} from './game/content.js';
import {
  LEVEL_BASE, levelFromXp, ITEM_BY_ID, ENEMY_FAMILIES,
  enemyFor,
} from './game/rpg.js';
import {
  SAVE_KEY, META_KEY, SLOT_KEY,
  normalizeSave, todayStr, yesterdayStr,
} from './app/save.js';
import {
  AudioFX, trackForWorld, musicEnsure, musicSetState,
  musicSetTrack, musicCycleTrack,
} from './audio/index.js';
import {
  CSS, Paragraphs,
  Toasts, Confetti, Modal, rankIndex, Header,
} from './ui/foundations.jsx';
import {
  TouchControls, CinematicFX, GfxPanel, EnterFade,
} from './ui/world-shared.jsx';
import {
  Bar, StatChip, ShopScreen, LevelUpModal,
} from './ui/combat.jsx';
import {
  WorldScreen, GauntletScreen, TruthScreen, draftStore, CodeScreen,
  BlitzScreen, BugScreen, AchScreen, ManualScreen,
} from './ui/challenges.jsx';
import {
  ForgeScreen, TrainingScreen, ProfilesScreen,
} from './ui/meta.jsx';
import { FR } from './telemetry/flight-recorder.js';
import {
  mkBox, circleVsAABB, resolveCollisions, nearestInteractable,
} from './world/collision.js';
import {
  ALL_CHALLENGES, WORLD_ORDER, challengesOf, worldDone, activeDone,
  worldUnlocked, worldUnlockedEx,
} from './world/challenges.js';
import { nextStationOf } from './world/progression.js';
import { MINE_CELL, mineWalls } from './world/layout.js';
import { DUNGEON_CFG } from './world/dungeon-config.js';
import {
  CAMPUS_SIZE, COURT_HALF, CAMPUS_DISTRICTS, campusModel, campusProgress,
} from './world/campus.js';
import {
  MINE_FIGHTS, mineModel, mineGateOpen, mineZoneAt,
} from './world/mine.js';
import { arcadeModel } from './world/arcade.js';
import { valleyModel, canyonModel } from './world/open-world.js';
import { dungeonModel, dungeonGateOpen } from './world/dungeon.js';
import { tuneRenderer, makePostFX, applyGfx } from './graphics/cinematic.js';
import { spawnShatter } from './graphics/rock.js';
import { updateCreature, makeViewModel, updateViewModel } from './graphics/creatures.js';
import { stepCamera, createAmbience } from './graphics/immersion.js';
import {
  buildFabUltra, buildCampusWorld, applyCampusProgress,
  buildMineWorld, applyMineProgress, buildArcadeWorld,
  buildDungeonWorld, applyDungeonProgress,
} from './graphics/world-builders.js';

// ============================================================
// TAPEOUT — the Verilog dojo · single-file React artifact
//
// HARD CONSTRAINTS
//   · three r128 core only (no examples/jsm imports)
//   · no localStorage — in-memory save + TPO1 export codes
//   · all audio synthesized via Web Audio (no asset files)
//   · one default export; renders in Claude.ai artifacts
//   · dev gate: run_gate.sh (build · validate · content · visual · smoke)
//
// TABLE OF CONTENTS — grep a title to jump
//   01 · FLIGHT RECORDER — session telemetry + pasteable report
//   02 · VERILOG ENGINE — src/engine/verilog.js parser + simulator
//   03 · DEBUG BAY CORE — netlist extraction, mux transform, error help (pure)
//   04 · CONTENT — worlds, lessons, challenges, arcade, achievements
//   05 · NG+ REMIX — architect-mode challenge variants (altered specs)
//   06 · TRAINING GENERATORS — drills, spaced review, forge support
//   07 · RPG SPINE — levels, gear, enemies (pure, testable)
//   08 · UI FOUNDATIONS — styles, shared components
//   09 · SFX — synthesized click/hit/win effects
//   10 · SOUNDTRACK — procedural music synthesis (Web Audio, original)
//   11 · TRACK LIBRARY
//   12 · MUSIC ENGINE — Web Audio synth tracks + state machine
//   13 · WORLD INDEX + 2D SCREENS — challengesOf, WorldScreen
//   14 · DEBUG BAY UI — hardware schematic view
//   15 · APP SHELL — save system, routing, screens wiring
//   16 · META UI — training grounds, forge, profiles, stats
//   17 · COMBAT SYSTEM — combat hook, HUD, flatline, shop, level-up
//   18 · FAB CAMPUS CORE — model, pure logic, 3D builders
//   19 · ULTRA FAB LAYER — monument, sigils, conveyor, towers, traces, wisps
//   20 · FAB CAMPUS SCREEN — walkable fab, overlay bridge, HUD
//   21 · CINEMATIC HELPERS — glow, sky, light rigs (core three r128 only)
//   22 · ULTRA POST PIPELINE — bloom, CA, vignette, grain (core three only)
//   23 · PROCEDURAL ROCK — sandstone color/normal/roughness textures
//   24 · IMMERSION FX — cinematic overlays, transitions, juice
//   25 · ENEMY SPEC — procedural creature specs (pure, no THREE)
//   26 · ENEMY MESH — procedural creature build + animation (THREE r128)
//   27 · OPEN-WORLD MODELS — valley + canyon layouts (pure, testable)
//   28 · PROGRESSION OVERHAUL — stations, learning order, next-beacon
//   29 · OPEN-WORLD RENDERERS — valley + canyon biomes (THREE r128)
//   30 · REALISM TOOLKIT — materials, weathering, micro-detail (THREE r128)
//   31 · BIT MINES MODEL (pure, testable)
//   32 · BIT MINES SCREEN — renderer + walkable world
//   33 · ARCADE HUB MODEL (pure, testable) — reuses mineWalls()
//   34 · MAIN MENU + ARCADE SCREEN
//   35 · TRAIL DUNGEON MODELS — serpentine worlds 3/5/6/7 + DUNGEON_CFG
//   36 · DUNGEON SCREEN — renderer + walkable worlds 2-7
// ============================================================

// FLIGHT RECORDER lives in ./telemetry/flight-recorder.js.

// DEBUG BAY netlist extraction/layout lives in src/engine/debug/netlist.js.

// Challenge and campaign UI live in ./ui/challenges.jsx.

// ---------- App ----------

// ============================================================
// APP SHELL — save system, routing, screens wiring
// ============================================================
export default function App() {
  const [save, setSave] = useState(() => normalizeSave(null));
  const [activeSlot, setActiveSlot] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState({ name: 'menu' });
  const drillReturnRef = useRef(false);
  const [toasts, setToasts] = useState([]);
  const [rankModal, setRankModal] = useState(null);
  const [tapeoutModal, setTapeoutModal] = useState(null);
  const [levelModal, setLevelModal] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gfx, setGfx] = useState({ exposure: 1.2, lights: 1.2, ambient: 1.0, fog: 0.032, normal: 0.95, glow: 0.82, bloom: 0.9 });
  const [frNote, setFrNote] = useState(false);
  const [frText, setFrText] = useState('');
  const [frReport, setFrReport] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if (e.code !== 'Backquote') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e2) { }
      setFrText(''); setFrNote(true);
    };
    try { window.addEventListener('keydown', h); } catch (e) { }
    return () => { try { window.removeEventListener('keydown', h); } catch (e) { } };
  }, []);
  const [resetArmed, setResetArmed] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const slotRef = useRef(activeSlot);
  slotRef.current = activeSlot;
  const toastId = useRef(0);
  const forgeKey = useRef(0);

  // ---- load (slot system + legacy migration) ----
  useEffect(() => {
    (async () => {
      let slot = 1;
      let s = normalizeSave(null);
      try {
        if (window.storage) {
          let meta = null;
          try { const m = await window.storage.get(META_KEY); if (m && m.value) meta = JSON.parse(m.value); } catch (e) { }
          if (!meta) {
            let legacy = null;
            try { const r = await window.storage.get(SAVE_KEY); if (r && r.value) legacy = JSON.parse(r.value); } catch (e) { }
            if (legacy) {
              try { await window.storage.set(SLOT_KEY(1), JSON.stringify(normalizeSave(legacy))); } catch (e) { }
              try { await window.storage.delete(SAVE_KEY); } catch (e) { }
            }
            meta = { active: 1 };
            try { await window.storage.set(META_KEY, JSON.stringify(meta)); } catch (e) { }
          }
          slot = meta.active || 1;
          try { const r = await window.storage.get(SLOT_KEY(slot)); if (r && r.value) s = normalizeSave(JSON.parse(r.value)); } catch (e) { }
        }
      } catch (e) { /* fresh wafer */ }
      const today = todayStr();
      if (s.streak.last !== today) {
        s.streak = { last: today, count: s.streak.last === yesterdayStr() ? s.streak.count + 1 : 1 };
      }
      AudioFX.enabled = s.sound;
      setActiveSlot(slot);
      setSave(s);
      setLoaded(true);
    })();
  }, []);

  // ---- persist (debounced, per-slot, stamps lastPlayed) ----
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try { window.storage && window.storage.set(SLOT_KEY(slotRef.current), JSON.stringify({ ...saveRef.current, lastPlayed: Date.now() })).catch(() => { }); } catch (e) { }
    }, 600);
    return () => clearTimeout(t);
  }, [save, loaded]);

  // ---- toasts ----
  const toast = useCallback((title, sub, kind) => {
    const id = ++toastId.current;
    setToasts(ts => [...ts.slice(-3), { id, title, sub, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3600);
  }, []);

  // ---- xp / achievements core ----
  const mutate = useCallback((fn) => {
    const prev = saveRef.current;
    const next = {
      ...prev,
      done: { ...prev.done }, doneNg: { ...prev.doneNg },
      lessons: { ...prev.lessons }, ach: [...prev.ach],
      skill: { ...prev.skill },
      bugsSolved: [...prev.bugsSolved], bugClean: [...prev.bugClean],
      streak: { ...prev.streak }, training: { ...prev.training },
      dailyDone: { ...prev.dailyDone },
      stats: { ...prev.stats, topics: { ...prev.stats.topics } },
    };
    const fx = [];
    const ctx = {
      addXp: (n, label) => { next.xp += n; if (label) fx.push([`+${n} XP`, label, undefined]); },
      award: (id) => {
        if (next.ach.includes(id)) return;
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (!def) return;
        next.ach.push(id);
        next.xp += def.xp;
        fx.push([`ACHIEVEMENT · ${def.name}`, `${def.desc} (+${def.xp} XP)`, 'ach']);
      },
    };
    const before = rankIndex(prev.xp);
    fn(next, ctx);
    if (next.streak.count >= 3) ctx.award('streak_3');
    if (next.streak.count >= 7) ctx.award('streak_7');
    const after = rankIndex(next.xp);
    saveRef.current = next;
    setSave(next);
    fx.forEach(([a, b, c]) => toast(a, b, c));
    if (after > before) {
      setTimeout(() => { AudioFX.rank(); setRankModal(RANKS[after][0]); setConfetti(['#22D3EE', '#7DEFFF', '#A3E635', '#FACC15']); }, 350);
    }
  }, [toast]);

  // streak check once after load
  useEffect(() => {
    if (!loaded) return;
    mutate(() => { });
  }, [loaded, mutate]);

  // play-time meter (counts only while the tab is visible)
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        mutate((s) => { s.stats.playMs += 30000; });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [loaded, mutate]);

  const completeChallenge = useCallback((id, stars, xp) => {
    try { FR.ev('clear', { id, stars, xp }); } catch (e) { }
    mutate((s, ctx) => {
      const ng = !!s.ngplus;
      const effMode = ng ? 'architect' : s.mode;
      const mult = modeOf(effMode).mult;
      const map = ng ? s.doneNg : s.done;
      const first = !map[id];
      const prevStars = map[id] ? map[id].stars : 0;
      map[id] = { stars: Math.max(prevStars, stars), mode: effMode };
      const _tp = TOPIC_OF[id];
      if (_tp) s.skill[_tp] = reviewUpdate(s.skill[_tp], Math.max(0.5, stars / 3), todayNum());
      if (first) {
        ctx.addXp(Math.round(xp * mult), ALL_CHALLENGES.find(c => c.id === id).title + ' cleared' + (mult > 1 ? ` (×${mult})` : ''));
        ctx.award('first_blood');
        const ch = ALL_CHALLENGES.find(c => c.id === id);
        if (ch.kind === 'code') ctx.award('it_compiles');
        if (!ng) {
          for (let w = 1; w <= 6; w++) if (worldDone(w, s)) ctx.award(`w${w}_done`);
          if (id === 'chip1') { s.tapeoutDone = true; ctx.award('tapeout'); }
        } else if (id === 'chip1') {
          ctx.award('second_silicon');
        }
      }
      const threeStars = Object.values(s.done).filter(d => d.stars === 3).length;
      if (threeStars >= 10) ctx.award('stars_10');
      const archCount = Object.values(s.done).filter(d => d.mode === 'architect').length
        + Object.values(s.doneNg).filter(d => d.mode === 'architect').length;
      if (archCount >= 10) ctx.award('iron_architect');
    });
  }, [mutate]);

  const onStat = useCallback((topic, pass) => {
    mutate((s) => {
      const t = s.stats.topics[topic] || { a: 0, p: 0 };
      s.stats.topics[topic] = { a: t.a + 1, p: t.p + (pass ? 1 : 0) };
      s.stats.runs += 1;
    });
  }, [mutate]);

  const onTrainingClear = useCallback((ch, daily) => {
    mutate((s, ctx) => {
      const mult = modeOf(s.ngplus ? 'architect' : s.mode).mult;
      if (daily) {
        const ds = ch.daily;
        if (!s.dailyDone[ds]) {
          s.dailyDone[ds] = true;
          s.dailyCount = (s.dailyCount || 0) + 1;
          ctx.addXp(Math.round(30 * mult), 'daily bench logged');
          if (s.dailyCount >= 7) ctx.award('daily_7');
        }
      } else {
        s.training[ch.gid] = (s.training[ch.gid] || 0) + 1;
        s.trainTotal = (s.trainTotal || 0) + 1;
        ctx.addXp(Math.round(15 * mult), 'training rep logged');
        if (s.trainTotal >= 25) ctx.award('forge_25');
      }
    });
  }, [mutate]);

  const onLessonRead = useCallback((lid) => {
    try { FR.ev('read', { id: lid }); } catch (e) { }
    mutate((s, ctx) => {
      if (s.lessons[lid]) return;
      s.lessons[lid] = true;
      ctx.addXp(5, 'field notes read');
      const allLessons = Object.values(LESSONS).flat();
      if (allLessons.every(L => s.lessons[L.id])) ctx.award('scholar');
    });
  }, [mutate]);

  const onBlitzEnd = useCallback((score, comboBest) => {
    mutate((s, ctx) => {
      if (score > 0) ctx.addXp(score, `Binary Blitz · ${score} correct`);
      if (score > s.blitzHigh) s.blitzHigh = score;
      if (comboBest > s.comboBest) s.comboBest = comboBest;
      if (score >= 15) ctx.award('blitz_15');
      if (score >= 30) ctx.award('blitz_30');
      if (comboBest >= 10) ctx.award('combo_10');
    });
  }, [mutate]);

  const onBugSolve = useCallback((id, clean) => {
    mutate((s, ctx) => {
      if (!s.bugsSolved.includes(id)) {
        s.bugsSolved.push(id);
        if (clean) s.bugClean.push(id);
        ctx.addXp(clean ? 15 : 8, 'bug squashed');
        if (s.bugsSolved.length >= 5) ctx.award('bug_5');
        if (s.bugsSolved.length >= 12) ctx.award('bug_all');
      }
    });
  }, [mutate]);

  const onCombatEnd = useCallback((r) => { mutate((s) => { if (r.win) { s.scrap = (s.scrap || 0) + r.scrap; s.combat.kills++; if (r.flawless) s.combat.flawless++; } if (r.death) { s.combat.deaths++; s.scrap = Math.max(0, (s.scrap || 0) - r.scrapLoss); } }); }, [mutate]);
  const onConsume = useCallback((k) => { mutate((s) => { if ((s.inv[k] || 0) > 0) s.inv[k]--; }); }, [mutate]);
  const onBuy = useCallback((iid) => { const it = ITEM_BY_ID[iid]; if (!it) return; AudioFX.good(); mutate((s) => { if ((s.scrap || 0) < it.cost) return; if (it.slot === 'consumable') { if ((s.inv[it.inv] || 0) >= 5) return; s.scrap -= it.cost; s.inv[it.inv] = (s.inv[it.inv] || 0) + 1; } else { if (s.owned.includes(iid)) return; s.scrap -= it.cost; s.owned.push(iid); s.gear[it.slot] = iid; } }); }, [mutate]);
  const onEquip = useCallback((iid) => { AudioFX.click(); mutate((s) => { const it = ITEM_BY_ID[iid]; if (it && s.owned.includes(iid)) s.gear[it.slot] = iid; }); }, [mutate]);
  useEffect(() => {
    const l = levelFromXp(save.xp || 0);
    if (save.lvlSeen !== undefined && l > save.lvlSeen) {
      setLevelModal({ from: save.lvlSeen, to: l });
      AudioFX.win();
      mutate((s) => { s.lvlSeen = l; });
    }
  }, [save.xp]); // eslint-disable-line

  const onVisited = useCallback(() => { mutate((s) => { s.campusVisited = true; }); }, [mutate]);

  const onBossWin = useCallback((ng) => {
    setTimeout(() => { setTapeoutModal(ng ? 'ng' : 'base'); setConfetti(['#FACC15', '#FFE27A', '#FB923C', '#7DEFFF', '#A3E635']); }, 600);
  }, []);

  // ---- difficulty / NG+ ----
  const setMode = useCallback((id) => {
    if (saveRef.current.mode === id || saveRef.current.ngplus) return;
    mutate((s) => { s.mode = id; });
    AudioFX.click();
    toast('Difficulty set', modeOf(id).label + ' — ' + modeOf(id).blurb);
  }, [mutate, toast]);

  const toggleNg = useCallback(() => {
    const cur = saveRef.current;
    if (!cur.tapeoutDone) return;
    const on = !cur.ngplus;
    mutate((s) => { s.ngplus = on; });
    AudioFX.click();
    toast(on ? 'NG+ ENGAGED' : 'NG+ disengaged',
      on ? 'Every spec remixed. Architect rules. Separate star track, 2× XP.' : 'Back to the first lap. NG+ stars are kept.',
      on ? 'ach' : undefined);
    setScreen({ name: 'home' });
  }, [mutate, toast]);

  // ---- profiles / slots ----
  const readSlot = useCallback(async (n) => {
    try {
      if (!window.storage) return null;
      const r = await window.storage.get(SLOT_KEY(n));
      if (!r || !r.value) return null;
      return normalizeSave(JSON.parse(r.value));
    } catch (e) { return null; }
  }, []);

  const activateSave = useCallback((slot, s) => {
    Object.keys(draftStore).forEach(k => delete draftStore[k]);
    const today = todayStr();
    if (s.streak.last !== today) {
      s.streak = { last: today, count: s.streak.last === yesterdayStr() ? s.streak.count + 1 : 1 };
    }
    AudioFX.enabled = s.sound;
    saveRef.current = s;
    slotRef.current = slot;
    setActiveSlot(slot);
    try { window.storage && window.storage.set(META_KEY, JSON.stringify({ active: slot })).catch(() => { }); } catch (e) { }
    try { window.storage && window.storage.set(SLOT_KEY(slot), JSON.stringify({ ...s, lastPlayed: Date.now() })).catch(() => { }); } catch (e) { }
    setSave(s);
  }, []);

  const onLoadSlot = useCallback(async (n) => {
    const s = (await readSlot(n)) || (() => { const f = normalizeSave(null); f.streak = { last: todayStr(), count: 1 }; return f; })();
    activateSave(n, s);
    toast('Slot ' + n + ' loaded', RANKS[rankIndex(s.xp)][0] + ' · ' + s.xp + ' XP');
  }, [readSlot, activateSave, toast]);

  const onNewSlot = useCallback((n) => {
    const fresh = normalizeSave(null);
    fresh.streak = { last: todayStr(), count: 1 };
    activateSave(n, fresh);
    toast('Fresh wafer in slot ' + n, 'Back to Intern. Make it count.');
  }, [activateSave, toast]);

  const onDeleteSlot = useCallback(async (n) => {
    try { window.storage && await window.storage.delete(SLOT_KEY(n)); } catch (e) { }
    if (n === slotRef.current) {
      const fresh = normalizeSave(null);
      fresh.streak = { last: todayStr(), count: 1 };
      activateSave(n, fresh);
    } else {
      setSave(s => ({ ...s })); // nudge ProfilesScreen to re-read slot summaries
    }
    toast('Slot ' + n + ' wiped', 'That wafer is gone.');
  }, [activateSave, toast]);

  const onImport = useCallback((raw) => {
    const s = normalizeSave(raw);
    activateSave(slotRef.current, s);
    toast('Save imported', RANKS[rankIndex(s.xp)][0] + ' restored into slot ' + slotRef.current);
  }, [activateSave, toast]);

  const toggleSound = () => {
    mutate(s => { s.sound = !s.sound; AudioFX.enabled = s.sound; });
    AudioFX.click();
  };

  const resetAll = () => {
    onNewSlot(slotRef.current);
    setResetArmed(false);
    setSettingsOpen(false);
    setScreen({ name: 'home' });
  };

  const go = useCallback((sc) => {
    try { FR.enter(sc.name + (sc.w ? ':' + sc.w : '')); } catch (e) { }
    if (drillReturnRef.current && sc && sc.name === 'world') { drillReturnRef.current = false; sc = { name: 'drill' }; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setScreen(sc);
    window.scrollTo({ top: 0 });
  }, []);

  // confetti auto-clear
  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(null), 4200);
    return () => clearTimeout(t);
  }, [confetti]);

  if (!loaded) {
    return (
      <div className="tk-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <div style={{ color: '#5A6A80', fontSize: 13, letterSpacing: '.2em' }}>POWERING ON<span className="cursorblink">_</span></div>
      </div>
    );
  }

  return (
    <div className="tk-root" onPointerDown={() => AudioFX.ensure()}>
      <style>{CSS}</style>
      <div className="scanlines" />
      {!['menu', 'campus', 'mine', 'arcade', 'dungeon', 'home'].includes(screen.name) && <Header save={save} onHome={() => go({ name: 'menu' })} onToggleSound={toggleSound} onSettings={() => setSettingsOpen(true)} />}
      <div className="wrap">
        {screen.name === 'menu' && <MainMenu save={save} go={go} onSettings={() => setSettingsOpen(true)} onNewGame={() => { setSave(normalizeSave(null)); go({ name: 'campus' }); }} />}
        {screen.name === 'drill' && <DrillScreen save={save} go={go} onReview={(id, kind) => { drillReturnRef.current = true; go({ name: kind, id }); }} />}
        {screen.name === 'tapeout' && <TapeoutBay save={save} go={go} />}
        {screen.name === 'world' && <WorldScreen w={screen.w} save={save} go={go} onLessonRead={onLessonRead} />}
        {screen.name === 'gauntlet' && <GauntletScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'truth' && <TruthScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'code' && <CodeScreen key={screen.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={screen.id} save={save} go={go} onComplete={completeChallenge} onBossWin={onBossWin} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'blitz' && <BlitzScreen save={save} go={go} onBlitzEnd={onBlitzEnd} />}
        {screen.name === 'bugs' && <BugScreen save={save} go={go} onBugSolve={onBugSolve} />}
        {(screen.name === 'campus' || screen.name === 'home') && <CampusScreen save={save} go={go} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'mine' && <MineScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'arcade' && <ArcadeScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'dungeon' && <DungeonScreen w={screen.w} save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={{ onLessonRead, completeChallenge, onBossWin, onStat, onTrainingClear, onBlitzEnd, onBugSolve, onVisited, onCombatEnd, onConsume, onBuy, onEquip, activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }} />}
        {screen.name === 'shop' && <ShopScreen save={save} go={go} onBuy={onBuy} onEquip={onEquip} />}
        {levelModal && <LevelUpModal info={levelModal} save={save} onClose={() => setLevelModal(null)} />}
        {screen.name === 'training' && <TrainingScreen save={save} go={go} />}
        {screen.name === 'forge' && <ForgeScreen key={screen.key} ch0={screen.ch} daily={!!screen.daily} save={save} go={go} onTrainingClear={onTrainingClear} onStat={onStat} />}
        {screen.name === 'profiles' && <ProfilesScreen save={save} activeSlot={activeSlot} go={go} onLoadSlot={onLoadSlot} onNewSlot={onNewSlot} onDeleteSlot={onDeleteSlot} onImport={onImport} readSlot={readSlot} />}
        {screen.name === 'ach' && <AchScreen save={save} go={go} />}
        {screen.name === 'manual' && <ManualScreen go={go} />}
      </div>

      <Toasts items={toasts} />
      {confetti && <Confetti colors={confetti} />}

      {rankModal && (
        <Modal onClose={() => setRankModal(null)} width={420}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div className="eyebrow" style={{ color: '#7DEFFF' }}>promotion</div>
            <Cpu size={34} color="#22D3EE" style={{ margin: '14px auto 8px', display: 'block' }} strokeWidth={1.4} />
            <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: '.06em', color: '#E8F1FA' }}>{rankModal.toUpperCase()}</div>
            <div style={{ fontSize: 12.5, color: '#76849A', margin: '8px 0 18px' }}>New badge printed. The fab expects more of you now.</div>
            <button className="btn primary" onClick={() => setRankModal(null)}>back to work</button>
          </div>
        </Modal>
      )}

      {tapeoutModal && (
        <Modal onClose={() => setTapeoutModal(null)} width={480}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div className="eyebrow" style={{ color: '#FACC15' }}>{tapeoutModal === 'ng' ? 'architect protocol survived' : 'final verification passed'}</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '.14em', margin: '14px 0 4px', color: '#FFE27A' }}>
              {tapeoutModal === 'ng' ? 'SECOND SILICON' : 'TAPEOUT'}
            </div>
            <div style={{ fontSize: 13, color: '#B9C6D6', maxWidth: 360, margin: '0 auto' }}>
              {tapeoutModal === 'ng'
                ? 'CHIP-2 ships. Remixed specs, hardened benches, no hints, no starter code, a ticking clock — and the testbench still signed off. There is nothing left in this dojo you cannot build.'
                : 'CHIP-1 is on the truck to the fab. Number systems, gates, combinational logic, registers, state machines — you used all of it, and the testbench signed off.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, margin: '18px 0', fontSize: 12, color: '#76849A' }}>
              <span>{save.xp} XP</span>
              <span>{tapeoutModal === 'ng' ? `NG+ ${Object.keys(save.doneNg).length}/${ALL_CHALLENGES.length}` : `${Object.keys(save.done).length}/${ALL_CHALLENGES.length} challenges`}</span>
              <span>{save.ach.length} achievements</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#5A6A80', marginBottom: 16 }}>
              {tapeoutModal === 'ng'
                ? 'Next stop: the same modules in real Vivado, then a Tiny Tapeout slot with your name etched in the silicon.'
                : 'Next stop after the Dojo: the same modules in real Vivado, then a Tiny Tapeout slot with your name in the silicon. (NG+ just unlocked in fab controls.)'}
            </div>
            <button className="btn gold" onClick={() => setTapeoutModal(null)}><Trophy size={14} /> accept the chip</button>
          </div>
        </Modal>
      )}

      {frNote && (
        <Modal onClose={() => setFrNote(false)} width={430}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>flight note · logged with screen + timestamp</div>
          <textarea value={frText} onChange={e => setFrText(e.target.value)} autoFocus rows={3}
            placeholder="what's broken / ugly / great, right here?"
            style={{ width: '100%', background: '#0A0F16', color: '#D7E0EA', border: '1px solid #273245', borderRadius: 8, padding: 10, font: 'inherit', fontSize: 13, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn primary" onClick={() => { AudioFX.click(); if (frText.trim()) FR.note(frText.trim()); setFrNote(false); }}>log it</button>
            <button className="btn sm" onClick={() => { AudioFX.click(); setFrNote(false); setFrReport(true); }}>view flight report</button>
          </div>
        </Modal>
      )}
      {frReport && (
        <Modal onClose={() => setFrReport(false)} width={580}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>flight report · paste this to Claude</div>
          <textarea readOnly value={FR.report(save, gfx)} rows={16}
            style={{ width: '100%', background: '#0A0F16', color: '#9FE8C8', border: '1px solid #273245', borderRadius: 8, padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, whiteSpace: 'pre', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn primary" onClick={() => { AudioFX.click(); try { navigator.clipboard && navigator.clipboard.writeText(FR.report(save, gfx)); } catch (e) { } }}>copy report</button>
          </div>
        </Modal>
      )}
      {settingsOpen && (
        <Modal onClose={() => { setSettingsOpen(false); setResetArmed(false); }} width={470}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>fab controls</div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#7DEFFF' }}>flight recorder</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => { AudioFX.click(); setSettingsOpen(false); setFrReport(true); }}>view flight report</button>
            <button className="btn sm" onClick={() => { AudioFX.click(); setSettingsOpen(false); setFrText(''); setFrNote(true); }}>add note ( ` )</button>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#7DEFFF' }}>difficulty</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
            {MODES.map(m => {
              const sel = (save.ngplus ? 'architect' : save.mode) === m.id;
              return (
                <button key={m.id} className="card" onClick={() => setMode(m.id)} disabled={save.ngplus}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', font: 'inherit', color: 'inherit', cursor: save.ngplus ? 'not-allowed' : 'pointer', textAlign: 'left', borderColor: sel ? '#22D3EE' : '#1D2632', opacity: save.ngplus && m.id !== 'architect' ? .45 : 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, width: 92, flexShrink: 0, color: sel ? '#7DEFFF' : '#D7E0EA' }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, color: '#76849A' }}>{m.blurb}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: save.ngplus ? '#FFC76B' : '#3A4759', marginBottom: 14 }}>
            {save.ngplus ? 'NG+ pins the fab to Architect rules.' : 'Switch any time — earned stars and XP are kept.'}
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#FFE27A' }}>new game+</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={!save.tapeoutDone}
              style={save.ngplus ? { borderColor: '#7A6310', color: '#FFE27A' } : null}
              onClick={toggleNg}>
              <Zap size={12} /> {save.ngplus ? 'NG+ engaged — disengage' : 'engage NG+'}
            </button>
            <span style={{ fontSize: 11.5, color: '#5A6A80' }}>
              {save.tapeoutDone ? 'every spec remixed · architect rules · separate stars' : 'locked until CHIP-1 tapes out'}
            </span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8, color: '#A3E635' }}>graphics</div>
          <div style={{ marginBottom: 16 }}>
            <GfxPanel gfx={gfx} setGfx={setGfx} accent="#A3E635" embedded />
            <div style={{ fontSize: 11, color: '#5A6A80', marginTop: 2 }}>Applies across the mines &amp; die blocks — brightness, lights, fog &amp; glow.</div>
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>wafers</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { AudioFX.click(); setSettingsOpen(false); setResetArmed(false); go({ name: 'profiles' }); }}><Cpu size={13} /> profiles & save codes</button>
            <button className="btn" style={{ borderColor: '#B14A52', color: '#FF8B82' }}
              onClick={() => { if (resetArmed) resetAll(); else { AudioFX.bad(); setResetArmed(true); } }}>
              <RotateCcw size={13} /> {resetArmed ? 'click again — no undo' : `scrap wafer (reset slot ${activeSlot})`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// META UI lives in ./ui/meta.jsx.

// COMBAT SYSTEM lives in ./ui/combat.jsx.

// ============================================================
// FAB CAMPUS CORE — model, pure logic, 3D builders
// ============================================================

// Pure collision and campus model helpers live in ./world/.


// ---------- canvas-texture helpers (browser only) ----------



// ---------- 3D builders ----------



// ============================================================
// ULTRA FAB LAYER — monument, sigils, conveyor, towers, traces, wisps
// The die comes alive: floating master-wafer monument, holo sigils over every district gate, overhead coolant network, an animated
// wafer conveyor ring, corner watchtowers with sweeping searchlights, glowing
// die traces along the roads, drifting dust and orbiting wisps. All decorative
// (no colliders touched); everything animated rides api.anims.
// ============================================================








// progress → world state (beacons, gates, windows)


// ============================================================
// FAB CAMPUS SCREEN — walkable fab, overlay bridge, HUD
// ============================================================

function CampusScreen({ save, go, cb }) {
  const mountRef = useRef(null);
  const minimapRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState(null);
  const [showHelp, setShowHelp] = useState(!save.campusVisited);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRef2 = useRef(save); saveRef2.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKey = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => { if (!save.campusVisited) cb.onVisited(); /* once */ // eslint-disable-line
  }, []); // eslint-disable-line

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'campus') { setOverlay(null); return; }
    if (sc.name === 'mine') { setOverlay(null); go({ name: 'mine' }); return; }
    if (sc.name === 'dungeon') { setOverlay(null); go({ name: 'dungeon', w: sc.w }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKey.current;
    setOverlay(sc);
  }, []);

  // ---------- engine ----------
  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      const camera = new THREE.PerspectiveCamera(72, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 600);
      camera.rotation.order = 'YXZ';

      const model = campusModel();
      const api = buildCampusWorld(scene, model);
      try { buildFabUltra(scene, model, api); } catch (e) { }

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.04 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0;
      let zoneW = 0, promptKey = '', miniT = 0, helpDismissed = false;

      const lockedTest = (it) => {
        const s = saveRef2.current;
        if (it.kind === 'arcade' && it.needsW3) return !worldUnlockedEx(3, s) ? 'SEALED — opens with Module Foundry' : null;
        if (it.kind === 'console') return !worldUnlockedEx(it.w, s) ? 'SEALED' : null;
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        const lock = lockedTest(it);
        if (lock) { AudioFX.bad(); return; }
        if (it.kind === 'pad') openOverlay({ name: 'fasttravel' });
        else openOverlay({ ...it.target });
      };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      // touch-look on the canvas (right half); joystick handled by HUD via inputRef
      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.005;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.004));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      let progress = campusProgress(saveRef2.current);
      applyCampusProgress(api, model, progress);

      engineRef.current = {
        applyProgress: (p) => { progress = p; applyCampusProgress(api, model, p); },
        teleport: (w) => {
          const spot = model.padSpots.find(s => s.w === w);
          if (!spot) return;
          player.x = spot.x; player.z = spot.z + 3;
          const d = model.districts.find(dd => dd.w === w);
          if (d) player.yaw = Math.atan2(-(d.x - player.x), (d.z - player.z)) + Math.PI;
          AudioFX.good();
        },
        interact: tryInteract,
      };

      const clock = new THREE.Clock();
      const camVec = new THREE.Vector3();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;
        const paused = !!overlayRef.current;

        if (!paused) {
          const inp = inputRef.current;
          const sprint = keys.ShiftLeft || keys.ShiftRight || inp.sprint;
          const sp = sprint ? 17 : 10;
          let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + inp.jx;
          let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + inp.jy;
          const len = Math.hypot(mx, mz);
          if (len > 1) { mx /= len; mz /= len; }
          if (len > 0.01) {
            if (!helpDismissed) { helpDismissed = true; setShowHelp(false); }
            const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
            const vx = (-sy) * (-mz) + cy * mx;
            const vz = (-cy) * (-mz) + (-sy) * mx;
            const res = resolveCollisions(player.x + vx * sp * dt, player.z + vz * sp * dt, 0.9, model.colliders);
            player.x = res.x; player.z = res.z;
          }
          // interact prompt
          const it = nearestInteractable(player.x, player.z, model.interactables);
          const lock = it ? lockedTest(it) : null;
          const pk = it ? it.id + (lock ? '!' : '') : '';
          if (pk !== promptKey) {
            promptKey = pk;
            setPrompt(it ? { text: lock ? lock : (isTouch ? 'TAP ⏎ — ' : '[E] ') + it.prompt, locked: !!lock } : null);
          }
          // district banner
          let zw = 0;
          for (const d of model.districts) {
            if (Math.abs(player.x - d.x) < COURT_HALF && Math.abs(player.z - d.z) < COURT_HALF) { zw = d.w; break; }
          }
          if (zw !== zoneW) {
            zoneW = zw;
            setBanner(zw ? model.districts.find(d => d.w === zw).name : null);
          }
        }

        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;

        api.anims.forEach(f => f(t, dt));
        // billboard kiosk screens
        camVec.set(player.x, 0, player.z);
        Object.values(api.kioskScreens).forEach(k => {
          k.screen.lookAt(camVec.x, k.screen.position.y, camVec.z);
        });

        // minimap @ ~8Hz
        miniT += dt;
        if (miniT > 0.12 && minimapRef.current) {
          miniT = 0;
          drawMinimap(minimapRef.current, model, player, progress);
        }

        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      loop();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
      try { renderer && renderer.dispose && renderer.dispose(); } catch (e2) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
      return () => { };
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      try {
        renderer.dispose(); try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      } catch (e) { }
      engineRef.current = null;
    };
  }, []); // eslint-disable-line

  // progress sync on save changes
  useEffect(() => {
    if (engineRef.current) engineRef.current.applyProgress(campusProgress(save));
  }, [save]);

  // ---------- overlay router (mirrors App routes) ----------
  const renderOverlay = () => {
    if (!overlay) return null;
    const s = save;
    let body = null, label = 'CONSOLE';
    if (overlay.name === 'world') { label = WORLDS.find(w => w.id === overlay.w).name; body = <WorldScreen w={overlay.w} save={s} go={oGo} onLessonRead={cb.onLessonRead} />; }
    else if (overlay.name === 'gauntlet') { label = 'GAUNTLET'; body = <GauntletScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'truth') { label = 'TRUTH TABLE'; body = <TruthScreen key={overlay.id} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'code') { label = 'WORKBENCH'; body = <CodeScreen key={overlay.id + '|' + (s.ngplus ? 'ng' : s.mode)} id={overlay.id} save={s} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} />; }
    else if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={s} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={s} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={s} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={s} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={s} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={s} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') { label = 'PROFILES'; body = <ProfilesScreen save={s} activeSlot={cb.activeSlot} go={oGo} onLoadSlot={cb.onLoadSlot} onNewSlot={cb.onNewSlot} onDeleteSlot={cb.onDeleteSlot} onImport={cb.onImport} readSlot={cb.readSlot} />; }
    else if (overlay.name === 'fasttravel') {
      label = 'FAST TRAVEL';
      const spots = [{ w: 0, name: 'Central Plaza' }].concat(WORLDS.filter(w => worldUnlockedEx(w.id, s)).map(w => ({ w: w.id, name: w.name })));
      body = (
        <div style={{ marginTop: 22, maxWidth: 460 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>trace network · cleared pads only</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {spots.map(sp => (
              <button key={sp.w} className="card" style={{ padding: '12px 15px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => { engineRef.current && engineRef.current.teleport(sp.w); setOverlay(null); }}>
                <Zap size={13} color="#7DEFFF" />
                <span style={{ fontSize: 14 }}>{sp.name}</span>
                <ChevronRight size={14} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(4,7,12,0.88)', backdropFilter: 'blur(2px)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1D2632', paddingBottom: 10 }}>
            <Terminal size={14} color="#7DEFFF" />
            <span className="eyebrow" style={{ color: '#7DEFFF' }}>console link · {label}</span>
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              <X size={12} /> close
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the 3D fab. Direct console uplinks below — same destinations, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {WORLDS.map(w => (
              <button key={w.id} className="card" disabled={!worldUnlockedEx(w.id, save)}
                style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: worldUnlockedEx(w.id, save) ? 'pointer' : 'not-allowed', opacity: worldUnlockedEx(w.id, save) ? 1 : 0.45 }}
                onClick={() => openOverlay({ name: 'world', w: w.id })}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</span>
              </button>
            ))}
            {[['Training Grounds', { name: 'training' }], ['Binary Blitz', { name: 'blitz' }], ['Bug Bounty', { name: 'bugs' }], ['Service Record', { name: 'ach' }], ['Field Manual', { name: 'manual' }], ['Scrap Exchange', { name: 'shop' }]].map(([nm, tg]) => (
              <button key={nm} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => openOverlay(tg)}>
                <span style={{ fontSize: 13 }}>{nm}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#060A12' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* exit */}
      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {/* crosshair */}
      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#7DEFFF', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #22D3EE' }} />
      )}

      {/* district banner */}
      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(10,14,20,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#7DEFFF' }}>
            {banner.toUpperCase()}
          </div>
        </div>
      )}

      {/* interact prompt */}
      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,14,20,0.86)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#155E6B'), color: prompt.locked ? '#FF8B82' : '#7DEFFF', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {/* minimap */}
      {!overlay && (
        <canvas ref={minimapRef} width={150} height={150}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 22, border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(8,12,18,0.85)' }} />
      )}

      {/* help card */}
      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 8 }}>fab floor access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ opens consoles.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E opens consoles. Follow the glowing traces — Bit Mines is southwest.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {/* touch controls */}
      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

function drawMinimap(cv, model, player, progress) {
  const g = cv.getContext('2d');
  const S = cv.width / CAMPUS_SIZE;
  const X = (x) => (x + CAMPUS_SIZE / 2) * S;
  const Z = (z) => (z + CAMPUS_SIZE / 2) * S;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(8,12,18,0.2)';
  g.fillRect(0, 0, cv.width, cv.height);
  model.districts.forEach(d => {
    const p = (progress && progress.perWorld[d.w]) || {};
    g.strokeStyle = !p.unlocked ? '#39434f' : p.complete ? '#2EA56A' : '#' + d.color.toString(16).padStart(6, '0');
    g.lineWidth = 1.5;
    g.globalAlpha = p.unlocked ? 0.95 : 0.45;
    g.strokeRect(X(d.x - COURT_HALF), Z(d.z - COURT_HALF), COURT_HALF * 2 * S, COURT_HALF * 2 * S);
    g.globalAlpha = 1;
  });
  // plaza
  g.beginPath();
  g.arc(X(0), Z(0), 38 * S, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(125,239,255,0.5)';
  g.stroke();
  // gates
  model.gates.forEach(gt => {
    const open = !gt.collider.off ? false : true;
    g.fillStyle = open ? '#2EA56A' : '#FF8B82';
    g.fillRect(X(gt.x) - 2, Z(gt.z) - 2, 4, 4);
  });
  // player arrow
  g.save();
  g.translate(X(player.x), Z(player.z));
  g.rotate(-player.yaw);
  g.fillStyle = '#FFE27A';
  g.beginPath();
  g.moveTo(0, -5); g.lineTo(3.4, 4); g.lineTo(-3.4, 4);
  g.closePath();
  g.fill();
  g.restore();
}

// ============================================================
// CINEMATIC HELPERS — glow, sky, light rigs (core three r128 only)
// No examples/jsm: fake-bloom via additive sprites, real shadow maps,
// ACES tone mapping, procedural textures, dust, CSS grade.
// ============================================================



// Fake-volumetric light shaft: additive open cone. With bloom it reads as a god ray.


// ============================================================
// ULTRA POST PIPELINE — bloom, CA, vignette, grain (core three only)
// Composer chain: scene -> bright pass -> separable blur x2 -> composite (bloom + chromatic aberration + vignette +
// film grain + linear->sRGB). No examples/jsm — ShaderMaterial + RTs only.
// ============================================================
















// One call at the end of a builder: shadow-flag meshes, glow every static
// point light (fake bloom), enable shadows (cube lights or a sky key), add dust.


// ============================================================
// PROCEDURAL ROCK — sandstone color/normal/roughness textures
// + displacement, all from tileable fbm. Plus cave dressing.
// ============================================================







// ---- organic rock wall geometry (world-coherent noise displacement) ----


// Box wall whose surface/edges are deformed by coherent noise so it reads as
// rough rock, not a box. Noise sampled in WORLD space (cx,cz) so neighbouring
// wall runs join seamlessly. Caller positions the mesh at (cx, sy/2, cz).


// ---- live graphics tuning (so the art pass isn't done blind) ----


// ============================================================
// IMMERSION FX — cinematic overlays, transitions, juice
// EnterFade: black -> transparent on scene mount
// stepCamera: head-bob, lateral sway, view roll, sprint FOV kick, footstep beats
// createAmbience: synthesized ambient bed (drone + air + torch flicker + footsteps + crackle)
//   hung off AudioFX.ctx, gated by AudioFX.enabled, composes with GfxPanel lights slider.
// All audio wrapped in try/catch — a failed AudioContext must never break the scene.
// ============================================================

// Mutates camera each frame. `st` is a persistent per-screen state bag ({}).
// Returns true on the frames a footfall lands (so the caller can play a step).


// Build a synthesized ambient bed for a scene. Call once after lights exist.
// kind: 'mine' | 'cave' | 'fortress' | 'foundry' | 'canyon' | 'arcade'


// ============================================================
// ENEMY SPEC — procedural creature specs (pure, no THREE)
// Maps an enemy (world + name + boss flag) to a creature archetype,
// palette, scale, and part counts. Deterministic from the name hash so a
// given enemy always looks the same. makeCreature() (ui_16b) consumes this.
// ============================================================



// world accent colors (match WORLDS palette)


// silhouette archetype per world (minion vs boss)




// ============================================================
// ENEMY MESH — procedural creature build + animation (THREE r128)
// makeCreature: roughened organic minions. makeWyrmBoss (Phase 10): a giant
// articulated serpent — tapered slithering spine, fanged opening jaw, horns,
// glowing eyes/throat, dorsal spikes — that rears and tracks the player.
// updateCreature routes the wyrm to updateWyrm. Eyes/core use coreMat so the
// clear-recolor still drives "core goes cold". r128-safe. Never run headless.
// ============================================================





// ---- bespoke boss forms (Phase 12): biped / obelisk / floater, built on the
// generic updateCreature animation skeleton (body + anim hooks), per-world signatures.












// ============================================================
// OPEN-WORLD MODELS — valley + canyon layouts (pure, testable)
// Pure layouts live in ./world/open-world.js.
// ============================================================

// ============================================================
// PROGRESSION OVERHAUL — stations, learning order, next-beacon
// Pure station sequencing lives in ./world/progression.js.
// ============================================================
// A tall, unmistakable "come here next" marker, repositioned as you progress.


// ============================================================
// OPEN-WORLD RENDERERS — valley + canyon biomes (THREE r128)
// buildValley / buildCanyon: sky dome + terrain + cliffs-from-colliders +
// set-pieces, then the shared buildDungeonNodes + an outdoor lightScene.
// Visual only — all gameplay (layout/collision/gate) comes from the model,
// which is BFS-verified by validate.js. Never runs headless (fallback path).
// ============================================================



// tall barriers along every model collider — the enclosing cliffs/mesas




// A glowing floor trail tracing the route spawn -> objective, with pylons that grow
// toward the goal and a tall beacon at the destination. Unambiguous "go this way".






// ============================================================
// REALISM TOOLKIT — materials, weathering, micro-detail (THREE r128)
// Breaks the "made of primitives" look: vertex-roughened geometry, natural rock
// stand-ins for the boxy props. Deterministic (seeded). Visual-only;
// never affects collision. Not run headless (WebGL path).
// ============================================================

// jitter every vertex of a geometry + recompute normals -> organic, craggy



// natural rock the enemies stand on, replacing the clean cylinder plinth


// a weathered rock cairn cradling a glowing rune-crystal, replacing the
// box pedestal + flat slab. Returns { bookMat } so the progress-dim still works.








// ============================================================
// BIT MINES MODEL (pure, testable)
// Pure layout and mine model helpers live in ./world/.
// ============================================================

// ============================================================
// BIT MINES SCREEN — renderer + walkable world
// ============================================================







function MineScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('heavy_press'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState('ENTRANCE GALLERY');
  const [showHelp, setShowHelp] = useState(false);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefM = useRef(save); saveRefM.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const lessonIds = (LESSONS[1] || []).map(l => l.id);

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (sc.name === 'home' || sc.name === 'mine' || sc.name === 'world') { setOverlay(null); return; }
    setOverlay(sc);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = mineModel(lessonIds);
      const api = buildMineWorld(scene, model);

      // headlamp
      const lamp = new THREE.SpotLight(0xffe7c0, 2.3, 44, 0.52, 0.5, 1.3);
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 48; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      ambRef.current = createAmbience(scene, 'mine');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.03 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'ENTRANCE GALLERY', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !mineGateOpen(saveRefM.current)) return 'SEALED — clear the five outer galleries';
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyM') { try { musicCycleTrack(1); } catch (e) { } }
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyMineProgress(api, model, saveRefM.current);
      let last = performance.now();
      let _aim = null, _flash = null, _hp = null, _hpTex = null, _lastBar = -1, _prevE = null, _prevP = null, _punchT = -9e9, _flashT = -9e9, _shakeT = -9e9, _vigT = -9e9, _prevOver = null, _prevPhase = 1;
      const drawHpBar = (tex, frac, tele) => {
        const cv = tex.userData.cv, x = cv.getContext('2d'); x.clearRect(0, 0, 256, 64);
        x.fillStyle = 'rgba(8,10,14,0.82)'; x.fillRect(8, 22, 240, 20);
        x.fillStyle = '#FF5252'; x.fillRect(10, 24, 236 * frac, 16);
        if (tele > 0.02) { x.fillStyle = 'rgba(255,205,80,' + (0.35 + 0.5 * tele) + ')'; x.fillRect(10, 45, 236 * Math.min(1, tele), 6); }
        x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.strokeRect(8, 22, 240, 20);
        tex.needsUpdate = true;
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 11.5 : 7.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = mineGateOpen(saveRefM.current) ? model.colliders : model.collidersClosed;
          const res = resolveCollisions(nx, nz, 0.55, cols);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id + '|' + (lockedTest(it) || '') : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else {
              const lock = lockedTest(it);
              let text;
              if (lock) text = lock;
              else if (it.kind === 'fight') {
                const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
                const g = GAUNTLETS.find(x => x.id === it.id);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (g ? ' · ' + g.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefM.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = (LESSONS[1] || []).find(l => l.id === it.lid);
                text = (isTouch ? '⏎ ' : '[E] ') + 'READ — ' + (it.ord ? '#' + it.ord + ' · ' : '') + (L ? L.title : 'field note');
              } else text = (isTouch ? '⏎ ' : '[E] ') + 'MENU — back to the main menu';
              setPrompt({ text, locked: !!lock });
            }
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        if (frame % 30 === 0) applyMineProgress(api, model, saveRefM.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        camera.position.set(player.x, 1.7, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _tot = _ov && _ov.name === 'gauntlet' && api && api.totems ? api.totems[_ov.id] : null;
        if (_tot && _tot.creature) {
          const _cr = _tot.creature;
          if (!_aim) _aim = new THREE.PerspectiveCamera();
          if (!_flash) { _flash = new THREE.PointLight(0xfff1c0, 0, 20, 2.0); scene.add(_flash); }
          if (!_hp) {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
            _hpTex = new THREE.CanvasTexture(cv); _hpTex.userData = { cv };
            _hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _hpTex, transparent: true, depthTest: false }));
            _hp.scale.set(7, 1.75, 1); scene.add(_hp);
          }
          _aim.position.copy(camera.position); _aim.lookAt(_cr.position.x, _cr.position.y + 2.6, _cr.position.z);
          camera.quaternion.slerp(_aim.quaternion, Math.min(1, dt * 5));
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_tot.creature.userData && _tot.creature.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0xFFB066); AudioFX.win(); }
            _prevE = _cfx.ehp; _prevP = _cfx.php; _prevOver = _cfx.over;
          }
          const pk = Math.max(0, 1 - (now - _punchT) / 220);
          camera.fov = 74 - 7 * pk; camera.updateProjectionMatrix();
          _flash.position.set(_cr.position.x, _cr.position.y + 2.2, _cr.position.z);
          _flash.intensity = 2.8 * Math.max(0, 1 - (now - _flashT) / 170);
          const sk = Math.max(0, 1 - (now - _shakeT) / 320);
          if (sk > 0) { camera.position.x += (Math.random() - 0.5) * 0.55 * sk; camera.position.y += (Math.random() - 0.5) * 0.45 * sk; }
          if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.7 * Math.max(0, 1 - (now - _vigT) / 380));
        } else {
          camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
          if (_hp) _hp.visible = false;
          if (_flash) _flash.intensity = 0;
          if (camera.fov !== 74) { camera.fov = 74; camera.updateProjectionMatrix(); }
          if (vignetteRef.current && vignetteRef.current.style.opacity !== '0') vignetteRef.current.style.opacity = '0';
        }
        lamp.position.set(player.x, 1.78, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefM.current.gear && saveRefM.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) {
        try { renderer.dispose(); } catch (e) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        try { renderer.domElement && renderer.domElement.remove(); } catch (e) { }
      }
    };
  }, []); // eslint-disable-line

  // ---------- overlay router ----------
  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, 1, 30, overlay.id === 'b6', 'engineer', false);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = (LESSONS[1] || []).find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 8 }}>recovered field note · the bit mines</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>{L.title}</h2>
            <div className="lessonbody" style={{ fontSize: 13.5, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
            {L.code && <pre className="codeblock" style={{ marginTop: 12 }}>{L.code}</pre>}
            {LESSON_DEPTH[L.id] && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1B2433' }}>
                <div className="eyebrow" style={{ marginBottom: 7, color: '#6FB7C9' }}>going deeper</div>
                <div style={{ fontSize: 13, color: '#A7B6C8' }}><Paragraphs text={LESSON_DEPTH[L.id]} /></div>
              </div>
            )}
            <button className="btn primary sm" style={{ marginTop: 14 }}
              onClick={() => { AudioFX.good(); if (!read) cb.onLessonRead(overlay.id); }}>
              {read ? 'logged ✓' : 'log it to the manual'}
            </button>
          </div>
        </div>
      ) : <div style={{ marginTop: 20, color: '#76849A' }}>The pages have rotted away.</div>;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'gauntlet' ? 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)' : 'rgba(3,5,9,0.93)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: overlay.name === 'note' ? '#9FB2C9' : '#FF8B82', letterSpacing: '0.14em' }}>{overlay.name === 'note' ? '✦ ' : '⚔ '}{label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#FFC76B', fontVariantNumeric: 'tabular-nums' }}><Coins size={13} /> {save.scrap || 0}</span>
            {overlay.name !== 'note' && <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(v => !v); }}><BookOpen size={12} /> field notes</button>}
            <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(false); setOverlay(null); }}>
              {overlay.name === 'note' ? 'close' : 'flee'} <X size={12} />
            </button>
          </div>
          {body}
        </div>
        {notesOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,5,9,0.97)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — THE BIT MINES</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[1] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the mine to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- fallback (no WebGL / headless) ----------
  if (failed) {
    const model = mineModel(lessonIds);
    const gateOpen = mineGateOpen(save);
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the mine in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.kind === 'fight').map(it => {
              const en = enemyFor(it.id, 1, 30, it.boss, 'engineer', false);
              const g = GAUNTLETS.find(x => x.id === it.id);
              const sealed = it.boss && !gateOpen;
              const done = !!activeDone(save)[it.id];
              return (
                <button key={it.id} className="card" disabled={sealed}
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                  onClick={() => openOverlay({ ...it.target })}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>
                    {en.name}{done ? ' ✓' : ''}
                  </span>
                  <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the outer galleries' : (g ? g.title : it.id)}</div>
                </button>
              );
            })}
            {(LESSONS[1] || []).map(L => (
              <button key={L.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => openOverlay({ name: 'note', id: L.id })}>
                <span style={{ fontSize: 13, color: '#7DEFFF' }}>FIELD NOTE — {L.title}{save.lessons && save.lessons[L.id] ? ' ✓' : ''}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- full-screen 3D + HUD ----------
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#04050A' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FFC76B" />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FFC76B', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FFB066' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A2014', borderRadius: 8, background: 'rgba(10,8,4,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FFC76B' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,8,4,0.88)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#7A6310'), color: prompt.locked ? '#FF8B82' : '#FFC76B', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FFC76B', marginBottom: 8 }}>shaft access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. The wyrm sleeps at the bottom of the shaft — clear the five galleries to unseal its gate.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
    </div>
  );
}

// ============================================================
// ARCADE HUB MODEL (pure, testable) — reuses mineWalls()
// Pure arcade layout lives in ./world/arcade.js.
// ============================================================

// ============================================================
// MAIN MENU + ARCADE SCREEN
// ============================================================

function MainMenu({ save, go, onSettings, onNewGame }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const [confirmNew, setConfirmNew] = useState(false);
  const mapNodes = useMemo(() => { const P = [[180, 820], [430, 720], [250, 540], [560, 470], [360, 300], [680, 250], [520, 110]]; return WORLDS.map((w, i) => ({ id: w.id, color: w.color, name: w.name, x: P[i][0], y: P[i][1] })); }, []);
  const tracePath = useMemo(() => mapNodes.map((n, i) => (i ? 'L' : 'M') + n.x + ',' + n.y).join(' '), [mapNodes]);
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53 + 7) % 100,
    delay: ((i * 0.37) % 4).toFixed(2),
    dur: (3.4 + (i % 5) * 0.6).toFixed(2),
    ch: (i * 7) % 3 === 0 ? '1' : '0',
    size: 11 + (i % 3) * 3,
  })), []);
  const ri = rankIndex(save.xp);
  return (
    <div className="mm-root">
      <style>{`
        .mm-root{position:fixed;inset:0;z-index:30;overflow:hidden;background:radial-gradient(120% 90% at 50% -10%,#0c1430 0%,#070912 55%,#04060c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
        .mm-grid{position:absolute;left:-30%;right:-30%;bottom:-12%;height:58%;background-image:linear-gradient(rgba(34,211,238,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.15) 1px,transparent 1px);background-size:46px 46px;transform:perspective(420px) rotateX(62deg);transform-origin:50% 100%;animation:mm-pan 7s linear infinite;-webkit-mask-image:linear-gradient(to top,#000 8%,transparent 78%);mask-image:linear-gradient(to top,#000 8%,transparent 78%)}
        @keyframes mm-pan{from{background-position:0 0}to{background-position:0 46px}}
        .mm-bit{position:absolute;top:-8%;color:rgba(125,239,255,.28);font-family:ui-monospace,monospace;animation:mm-fall linear infinite;pointer-events:none}
        @keyframes mm-fall{to{transform:translateY(116vh)}}
        .mm-map{position:absolute;inset:0;width:100%;height:100%;z-index:1;opacity:.55;pointer-events:none}
        .mm-trace{stroke-dasharray:9 13;animation:mm-flow 4s linear infinite}
        @keyframes mm-flow{to{stroke-dashoffset:-44}}
        .mm-node{animation:mm-pulse 3.2s ease-in-out infinite}
        @keyframes mm-pulse{0%,100%{stroke-opacity:.22}50%{stroke-opacity:.6}}
        .mm-glow{text-shadow:0 0 24px rgba(34,211,238,.55),0 0 60px rgba(34,211,238,.22)}
        .mm-btn{display:flex;align-items:center;gap:13px;width:330px;max-width:84vw;padding:13px 18px;border-radius:9px;border:1px solid #233247;background:rgba(13,18,28,.78);color:#D7E0EA;font:inherit;cursor:pointer;text-align:left;transition:border-color .15s,background .15s,transform .05s,box-shadow .15s}
        .mm-btn:hover{border-color:#22D3EE;background:rgba(16,26,38,.92);box-shadow:0 0 22px rgba(34,211,238,.16)}
        .mm-btn:active{transform:translateY(1px)}
        .mm-btn.start{border-color:#155E6B;background:rgba(12,44,51,.85)}
        .mm-btn.start:hover{border-color:#22D3EE;box-shadow:0 0 30px rgba(34,211,238,.28)}
        .mm-ico{display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:8px;background:rgba(34,211,238,.10);flex:none}
      `}</style>
      <div className="mm-grid" />
      <svg className="mm-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x="78" y="64" width="844" height="872" rx="28" fill="none" stroke="rgba(34,211,238,.12)" strokeWidth="2" />
        <rect x="120" y="106" width="760" height="788" rx="18" fill="none" stroke="rgba(34,211,238,.055)" strokeWidth="1.5" />
        <line x1="78" y1="500" x2="48" y2="500" stroke="rgba(34,211,238,.10)" strokeWidth="2" />
        <line x1="922" y1="500" x2="952" y2="500" stroke="rgba(34,211,238,.10)" strokeWidth="2" />
        <path d={tracePath} fill="none" stroke="rgba(125,239,255,.20)" strokeWidth="3" className="mm-trace" />
        {mapNodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="17" fill={n.color} fillOpacity=".10" />
            <circle cx={n.x} cy={n.y} r="23" fill="none" stroke={n.color} strokeOpacity=".5" strokeWidth="2" className="mm-node" />
            <circle cx={n.x} cy={n.y} r="6" fill={n.color} fillOpacity=".85" />
            <text x={n.x} y={n.y - 32} fill={n.color} fillOpacity=".62" fontSize="19" fontFamily="ui-monospace, monospace" textAnchor="middle">{n.id < 10 ? '0' + n.id : '' + n.id}</text>
            <text x={n.x} y={n.y + 40} fill="rgba(159,178,200,.5)" fontSize="13" fontFamily="ui-monospace, monospace" textAnchor="middle">{n.name}</text>
          </g>
        ))}
      </svg>
      {bits.map((b, i) => (
        <span key={i} className="mm-bit" style={{ left: b.left + '%', fontSize: b.size, animationDelay: b.delay + 's', animationDuration: b.dur + 's' }}>{b.ch}</span>
      ))}

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginBottom: 26 }}>
        <div className="eyebrow" style={{ color: '#7DEFFF', marginBottom: 10 }}>fab dojo-n4 · rev a</div>
        <div className="mm-glow" style={{ fontSize: 'clamp(44px,11vw,84px)', fontWeight: 700, letterSpacing: '.12em', color: '#E8F1FA', lineHeight: 1 }}>
          TAPEOUT<span className="cursorblink" style={{ color: '#7DEFFF' }}>_</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, letterSpacing: '.34em', textTransform: 'uppercase', color: '#76849A' }}>the verilog dojo</div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <button className="mm-btn start" onClick={() => { AudioFX.click(); go({ name: 'campus' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(34,211,238,.16)' }}><Play size={17} color="#7DEFFF" fill="#7DEFFF" /></span>
          <span><div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.04em', color: '#7DEFFF' }}>CONTINUE</div><div style={{ fontSize: 11, color: '#76849A' }}>resume · walk the fab · Lv {levelFromXp(save.xp || 0)} · ⛁ {save.scrap || 0}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" style={confirmNew ? { borderColor: '#B14A52' } : undefined} onClick={() => { if (confirmNew) { AudioFX.click(); onNewGame(); } else { AudioFX.bad(); setConfirmNew(true); setTimeout(() => setConfirmNew(false), 3200); } }}>
          <span className="mm-ico" style={{ background: 'rgba(255,226,122,.12)' }}><Sparkles size={16} color={confirmNew ? '#FF8B82' : '#FFE27A'} /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600, color: confirmNew ? '#FF8B82' : '#D7E0EA' }}>{confirmNew ? 'TAP AGAIN — ERASE SAVE' : 'NEW GAME'}</div><div style={{ fontSize: 11, color: '#76849A' }}>{confirmNew ? 'this wipes all progress on this slot' : 'wipe the wafer & start from the Bit Mines'}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'arcade' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(255,125,240,.12)' }}><Gamepad2 size={17} color="#FF7DF0" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>ARCADE</div><div style={{ fontSize: 11, color: '#76849A' }}>training, blitz, bug bounty &amp; the kit</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'drill' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(125,239,255,.12)' }}><RotateCcw size={16} color="#7DEFFF" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>SPACED REVIEW</div><div style={{ fontSize: 11, color: '#76849A' }}>{(() => { const d = dueTopics(save.skill, todayNum()).length; return d ? `${d} concept${d > 1 ? 's' : ''} due for recall` : 'keep cleared concepts sharp'; })()}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'tapeout' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(250,204,21,.12)' }}><Cpu size={16} color="#FACC15" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>TAPEOUT BAY</div><div style={{ fontSize: 11, color: '#76849A' }}>{(() => { const n = CODE_CHALLENGES.filter(c => save.done[c.id]).length; return n ? `export ${n} signed-off module${n > 1 ? 's' : ''} as RTL` : 'export your modules to real Verilog'; })()}</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" onClick={() => { AudioFX.click(); go({ name: 'shop' }); }}>
          <span className="mm-ico" style={{ background: 'rgba(255,199,107,.12)' }}><Coins size={16} color="#FFC76B" /></span>
          <span><div style={{ fontSize: 14.5, fontWeight: 600 }}>SCRAP EXCHANGE</div><div style={{ fontSize: 11, color: '#76849A' }}>trade scrap for gear &amp; boosts</div></span>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
        <button className="mm-btn" style={{ width: 330, maxWidth: '84vw' }} onClick={() => { AudioFX.click(); onSettings(); }}>
          <span className="mm-ico" style={{ background: 'rgba(118,132,154,.12)' }}><Settings size={15} color="#9FB4C8" /></span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>SETTINGS</span>
        </button>
      </div>

      <div style={{ position: 'relative', zIndex: 2, marginTop: 26, fontSize: 11.5, color: '#5A6A80', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: '#7DEFFF', letterSpacing: '.12em' }}>{RANKS[ri][0].toUpperCase()}</span>
        <span>Lv {levelFromXp(save.xp || 0)}</span>
        <span style={{ color: '#FFC76B' }}>⛁ {save.scrap || 0}</span>
        <span>{save.xp} XP</span>
        {save.ngplus && <span style={{ color: '#FFE27A', letterSpacing: '.1em' }}>NG+</span>}
      </div>
    </div>
  );
}

function TapeoutBay({ save, go }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const cleared = CODE_CHALLENGES.filter(c => save.done[c.id]);
  const isCap = (id) => id === 'chip1';
  const [selId, setSelId] = useState(() => cleared.some(c => isCap(c.id)) ? 'chip1' : (cleared.length ? cleared[cleared.length - 1].id : null));
  const [tab, setTab] = useState('module');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [selId, tab]);
  const ch = selId ? CODE_CHALLENGES.find(c => c.id === selId) : null;
  const out = useMemo(() => ch ? exportRTL(ch) : null, [selId]);
  const text = out ? (tab === 'testbench' ? out.testbench : tab === 'wrapper' ? out.wrapper : out.module) : '';
  const fname = out ? (tab === 'testbench' ? 'tb_' + out.name + '.v' : tab === 'wrapper' ? 'tt_um_' + out.name + '.v' : out.name + '.v') : '';
  const tabs = [['module', 'module'], ['testbench', 'testbench'], ['wrapper', 'TT wrapper']];
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 16px 60px' }}>
      <button className="lnk" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}><ChevronLeft size={14} /> menu</button>
      <div className="eyebrow" style={{ color: '#FACC15', marginTop: 14 }}>tapeout bay</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.02em', margin: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}><Cpu size={22} style={{ color: '#FACC15' }} /> Silicon Export</div>
      <div style={{ fontSize: 13, color: '#8A98AC', lineHeight: 1.5, marginBottom: 18, maxWidth: 600 }}>
        Every module you've signed off is real, synthesizable Verilog. Pull the source, a self-checking testbench, and a Tiny&nbsp;Tapeout-style top wrapper, then drop them into <code>iverilog</code> or EDA&nbsp;Playground to watch your logic run outside the dojo. The golden values baked into each testbench come straight from the dojo's reference simulation.
      </div>
      {cleared.length === 0 ? (
        <div className="card" style={{ padding: '18px', color: '#8A98AC', fontSize: 13, lineHeight: 1.55 }}>
          No modules signed off yet. Clear a <span style={{ color: '#7DEFFF' }}>code challenge</span> — the trials with a live Verilog editor — and its RTL unlocks here for export.
        </div>
      ) : (
        <>
          <div className="eyebrow" style={{ marginBottom: 9 }}>{cleared.length} module{cleared.length > 1 ? 's' : ''} ready</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {cleared.map(c => {
              const sel = c.id === selId, cap = isCap(c.id);
              return (
                <button key={c.id} onClick={() => { AudioFX.click(); setSelId(c.id); }}
                  style={{ padding: '7px 12px', borderRadius: 7, cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + (sel ? (cap ? '#FACC15' : '#22D3EE') : '#233247'), background: sel ? (cap ? 'rgba(250,204,21,.12)' : 'rgba(34,211,238,.10)') : 'rgba(13,18,28,.7)', color: sel ? (cap ? '#FACC15' : '#7DEFFF') : '#9FB0C4' }}>
                  {cap && <Medal size={13} />}{c.iface.name}
                </button>
              );
            })}
          </div>
          {isCap(selId) && <div style={{ fontSize: 12, color: '#FACC15', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}><Star size={13} /> The capstone — a clocked accumulator-ALU. This is the one you tape out.</div>}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#D7E0EA', marginBottom: 3 }}>{ch ? ch.title : ''}</div>
          <div style={{ fontSize: 12, color: '#76849A', marginBottom: 12, lineHeight: 1.5 }}>{ch ? ch.brief : ''}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => { AudioFX.click(); setTab(k); }} style={{ padding: '7px 13px', borderRadius: '7px 7px 0 0', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600, borderBottom: 'none', border: '1px solid ' + (tab === k ? '#2A3A4E' : 'transparent'), background: tab === k ? 'rgba(18,26,38,.95)' : 'transparent', color: tab === k ? '#D7E0EA' : '#76849A' }}>{label}</button>
            ))}
          </div>
          <div style={{ border: '1px solid #2A3A4E', borderRadius: '0 8px 8px 8px', background: 'rgba(10,14,22,.92)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Terminal size={13} style={{ color: '#5A6B80', flexShrink: 0 }} />
              <code style={{ fontSize: 11.5, color: '#7DEFFF' }}>{fname}</code>
              <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); AudioFX.good(); } catch (e) { } }} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: 600, border: '1px solid #2A3A4E', background: copied ? 'rgba(46,165,106,.16)' : 'rgba(20,28,40,.9)', color: copied ? '#5FD89B' : '#9FB0C4', display: 'flex', alignItems: 'center', gap: 5 }}>{copied ? <><Check size={12} /> copied</> : 'copy'}</button>
            </div>
            <textarea readOnly value={text} spellCheck={false} style={{ width: '100%', height: 300, resize: 'vertical', boxSizing: 'border-box', background: 'rgba(6,9,14,.9)', color: '#C8D4E0', border: '1px solid #1B2737', borderRadius: 6, padding: 11, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre', overflow: 'auto' }} />
          </div>
          <div style={{ fontSize: 11.5, color: '#5A6B80', marginTop: 12, lineHeight: 1.6 }}>
            <span style={{ color: '#8A98AC' }}>Run it:</span> save the module and testbench, then <code style={{ color: '#9FB0C4' }}>iverilog -o sim {out ? out.name : ''}.v tb_{out ? out.name : ''}.v && vvp sim</code>. The wrapper <code style={{ color: '#9FB0C4' }}>tt_um_{out ? out.name : ''}</code> is the submission top for a Tiny&nbsp;Tapeout tile.
          </div>
        </>
      )}
    </div>
  );
}

function DrillScreen({ save, go, onReview }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const today = todayNum();
  const skill = save.skill || {};
  const due = dueTopics(skill, today);
  const pickFor = (tp) => {
    const cands = ALL_CHALLENGES.filter(c => TOPIC_OF[c.id] === tp && save.done[c.id]);
    if (!cands.length) return null;
    return cands[Math.abs(hashStr(tp + ':' + today)) % cands.length]; // stable within a day, varies across days
  };
  const items = due.map(tp => { const ch = pickFor(tp); if (!ch) return null; const t = TOPIC_LIST.find(x => x.id === tp); return { tp, label: t ? t.label : tp, ch, rec: skill[tp] }; }).filter(Boolean);
  const seen = TOPIC_LIST.filter(t => skill[t.id] && skill[t.id].seen);
  const future = seen.map(t => skill[t.id].dueDay || 0).filter(d => d > today);
  const nextDay = future.length ? Math.min(...future) : null;
  const weakest = seen.length ? seen.slice().sort((a, b) => conceptMastery(skill[a.id]) - conceptMastery(skill[b.id]))[0] : null;
  const weakCh = weakest ? pickFor(weakest.id) : null;
  const colP = ['#1D2632', '#FFC76B', '#7FB2E8', '#2EA56A'];

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '26px 16px 60px' }}>
      <button className="lnk" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}><ChevronLeft size={14} /> menu</button>
      <div className="eyebrow" style={{ color: '#7DEFFF', marginTop: 14 }}>spaced review</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.02em', margin: '4px 0 6px' }}>Recall Lab</div>
      <div style={{ fontSize: 13, color: '#8A98AC', lineHeight: 1.5, marginBottom: 20, maxWidth: 540 }}>
        Concepts you've cleared resurface here on a spreading schedule. Re-derive each one to push it into long-term memory — a clean recall lengthens the interval, a miss brings it back sooner.
      </div>
      {items.length > 0 ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{items.length} concept{items.length > 1 ? 's' : ''} due</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map(it => {
              const lvl = masteryLevel(it.rec);
              return (
                <div key={it.tp} className="card" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: '#D7E0EA' }}>{it.label}</div>
                    <div style={{ fontSize: 11.5, color: '#76849A', marginTop: 2 }}>recall via <span style={{ color: '#9FB4C8' }}>{it.ch.title}</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 16, height: 6, borderRadius: 3, background: i < lvl ? colP[lvl] : '#161E28' }} />)}</div>
                  <button className="btn sm primary" onClick={() => { AudioFX.click(); onReview(it.ch.id, it.ch.kind); }}>review <ChevronRight size={12} /></button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          {seen.length ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#2EA56A', marginBottom: 6 }}>All caught up.</div>
              <div style={{ fontSize: 12.5, color: '#8A98AC', marginBottom: weakCh ? 18 : 0 }}>
                Nothing is due for recall right now{nextDay != null && isFinite(nextDay) ? ` — next review in ${nextDay - today} day${nextDay - today === 1 ? '' : 's'}` : ''}. Clear more challenges to widen the rotation.
              </div>
              {weakCh && <button className="btn sm" onClick={() => { AudioFX.click(); onReview(weakCh.id, weakCh.kind); }}>drill weakest anyway · {TOPIC_LIST.find(t => t.id === weakest.id).label} <ChevronRight size={12} /></button>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#D7E0EA', marginBottom: 6 }}>No schedule yet.</div>
              <div style={{ fontSize: 12.5, color: '#8A98AC' }}>Clear challenges out in the worlds and they'll start showing up here for spaced review.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}



function ArcadeScreen({ save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('tapeline'); musicSetState('explore'); } catch (e) { } }, []);
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [banner, setBanner] = useState('THE ARCADE');
  const [showHelp, setShowHelp] = useState(true);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const saveRefA = useRef(save); saveRefA.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const forgeKeyA = useRef(0);
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'arcade') { setOverlay(null); return; }
    if (sc.name === 'menu') { setOverlay(null); go({ name: 'menu' }); return; }
    if (sc.name === 'forge' && sc.key == null) sc.key = ++forgeKeyA.current;
    setOverlay(sc);
  }, []); // eslint-disable-line

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      camera.rotation.order = 'YXZ';

      const model = arcadeModel();
      const api = buildArcadeWorld(scene, model);
      const playerLight = new THREE.PointLight(0xbfe0ff, 0.7, 22, 1.5);
      scene.add(playerLight);
      ambRef.current = createAmbience(scene, 'arcade');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.05 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = 'THE ARCADE', frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => {
        if (overlayRef.current || isTouch) return;
        try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { }
      };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => {
        const t = e.touches[0];
        if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; }
      };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post) post.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      let last = performance.now();
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        frame++;
        _moving = false; _sprint = false;
        if (api.spin) { api.spin.rotation.y += dt * 0.8; api.spin.rotation.x = 0.42; }
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 11.5 : 7.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const res = resolveCollisions(nx, nz, 0.55, model.colliders);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else if (it.kind === 'exit') setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'MAIN MENU' });
            else setPrompt({ text: (isTouch ? '⏎ ' : '[E] ') + 'PLAY — ' + it.label });
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        camera.position.set(player.x, 1.7, player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        playerLight.position.set(player.x, 2.6, player.z);
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) {
        try { renderer.dispose(); } catch (e) { } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
        try { renderer.domElement && renderer.domElement.remove(); } catch (e) { }
      }
    };
  }, []); // eslint-disable-line

  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'training') { label = 'TRAINING GROUNDS'; body = <TrainingScreen save={save} go={oGo} />; }
    else if (overlay.name === 'forge') { label = 'FORGE'; body = <ForgeScreen key={overlay.key} ch0={overlay.ch} daily={!!overlay.daily} save={save} go={oGo} onTrainingClear={cb.onTrainingClear} onStat={cb.onStat} />; }
    else if (overlay.name === 'blitz') { label = 'BINARY BLITZ'; body = <BlitzScreen save={save} go={oGo} onBlitzEnd={cb.onBlitzEnd} />; }
    else if (overlay.name === 'bugs') { label = 'BUG BOUNTY'; body = <BugScreen save={save} go={oGo} onBugSolve={cb.onBugSolve} />; }
    else if (overlay.name === 'ach') { label = 'SERVICE RECORD'; body = <AchScreen save={save} go={oGo} />; }
    else if (overlay.name === 'shop') { label = 'SCRAP EXCHANGE'; body = <ShopScreen save={save} go={oGo} onBuy={cb.onBuy} onEquip={cb.onEquip} />; }
    else if (overlay.name === 'manual') { label = 'FIELD MANUAL'; body = <ManualScreen go={oGo} />; }
    else if (overlay.name === 'profiles') { label = 'SAVE TERMINAL'; body = <ProfilesScreen save={save} activeSlot={cb.activeSlot} go={oGo} onLoadSlot={cb.onLoadSlot} onNewSlot={cb.onNewSlot} onDeleteSlot={cb.onDeleteSlot} onImport={cb.onImport} readSlot={cb.readSlot} />; }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(4,5,12,0.94)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: '#FF7DF0' }}>arcade cabinet · {label}</span>
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setOverlay(null); }}>
              step away <X size={12} />
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  };

  if (failed) {
    const model = arcadeModel();
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>THE ARCADE</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render the arcade floor. Direct cabinet links below — same modes, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {model.interactables.filter(i => i.kind === 'arcade').map(it => (
              <button key={it.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', borderColor: '#273245' }}
                onClick={() => openOverlay({ ...it.target })}>
                <span style={{ fontSize: 13, fontWeight: 600, color: it.accent }}>{it.label}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#06060F' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent="#FF7DF0" />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> main menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: '#FF7DF0', opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px #FF7DF0' }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #2A1430', borderRadius: 8, background: 'rgba(10,4,12,0.82)', letterSpacing: '.22em', fontSize: 13, color: '#FF7DF0' }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(10,4,12,0.88)', border: '1px solid #6A2A63', color: '#FF7DF0', fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: '#FF7DF0', marginBottom: 8 }}>arcade floor</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ plays a cabinet.'
                : 'Click to capture the mouse. WASD walks, E plays a cabinet. The lift by the entrance takes you back to the main menu.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      {overlay && renderOverlay()}
    </div>
  );
}

// ============================================================
// TRAIL DUNGEON MODELS — serpentine worlds 3/5/6/7 + DUNGEON_CFG
// Pure dungeon configuration and models live in ./world/.
// ============================================================

// ============================================================
// DUNGEON SCREEN — renderer + walkable worlds 2-7
// ============================================================



// Dense themed environmental structures so worlds read as built places, not empty grids.
// Spread across the hall, clear of nodes and the path corridor. Count scales with floor area.


// Theme decorations that follow the trail: corner pylons at every turn, themed
// frames/pipes/gears along each stretch, a dais under the boss. Reads model.path
// so it fits any layout.






function DungeonScreen({ w, save, go, cb, gfx, setGfx, onSettings }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack(trackForWorld(w)); musicSetState('explore'); } catch (e) { } }, [w]);
  const world = WORLDS.find(x => x.id === w);
  const fights = challengesOf(w);
  const lessonList = LESSONS[w] || [];
  const lessonIds = lessonList.map(L => L.id);
  const cfg = DUNGEON_CFG[w];
  const accHex = '#' + cfg.theme.accent.toString(16).padStart(6, '0');

  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [banner, setBanner] = useState(cfg.zone);
  const [showHelp, setShowHelp] = useState(false);
  const ctxRef = useRef(null);
  const ambRef = useRef(null);
  const engineRef = useRef(null);
  const overlayRef = useRef(null); overlayRef.current = overlay;
  const combatFxRef = useRef(null);
  const oCombatFx = useCallback((s) => { combatFxRef.current = s; }, []);
  const vignetteRef = useRef(null);
  const saveRefD = useRef(save); saveRefD.current = save;
  const inputRef = useRef({ jx: 0, jy: 0, sprint: false });
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const modelMemo = useMemo(() => dungeonModel(w, fights, lessonIds), [w]); // eslint-disable-line
  const activeMode = save.ngplus ? 'architect' : save.mode;

  const openOverlay = useCallback((sc) => {
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    AudioFX.click();
    setOverlay(sc);
  }, []);
  const oGo = useCallback((sc) => {
    if (!sc || sc.name === 'home' || sc.name === 'dungeon' || sc.name === 'world' || sc.name === 'surface') { setOverlay(null); return; }
    setOverlay(sc);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    let renderer, raf = 0;
    const cleanup = [];
    try {
      if (!mount || typeof document === 'undefined') throw new Error('no DOM');
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      tuneRenderer(renderer, isTouch);
      renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1), 2));
      renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
      mount.appendChild(renderer.domElement);
      const canvas = renderer.domElement;
      canvas.style.display = 'block';

      const scene = new THREE.Scene();
      let post = null;
      try { if (!(typeof window !== 'undefined' && 'ontouchstart' in window)) post = makePostFX(renderer, mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight); } catch (e) { post = null; }
      ctxRef.current = { renderer, scene, post };
      const camera = new THREE.PerspectiveCamera(74, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 300);
      scene.add(camera);
      let _vm = null, _vmWeap = null, _vmJabT = -9e9;
      camera.rotation.order = 'YXZ';

      const model = modelMemo;
      const api = buildDungeonWorld(scene, model, model.theme);
      const lamp = new THREE.SpotLight(0xfff0d8, 1.9, 42, 0.56, 0.5, 1.3);
      if (!isTouch) { try { lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.camera.near = 0.6; lamp.shadow.camera.far = 46; lamp.shadow.bias = -0.0025; } catch (e) { } }
      scene.add(lamp); scene.add(lamp.target);
      const fillLight = new THREE.PointLight(model.theme.accent, 0.45, 26, 1.6);
      scene.add(fillLight);
      ambRef.current = createAmbience(scene, 'cave');
      cleanup.push(() => { try { ambRef.current && ambRef.current.dispose(); } catch (e) { } });

      const player = { x: model.spawn.x, z: model.spawn.z, yaw: model.spawn.yaw, pitch: -0.03 };
      const keys = {};
      let dragging = false, lastTX = 0, lastTY = 0, promptKey = '', zoneNow = cfg.zone, frame = 0;
      let _moving = false, _sprint = false; const _bob = {};

      const lockedTest = (it) => {
        if (it.kind === 'fight' && it.boss && !dungeonGateOpen(saveRefD.current, model)) return 'SEALED — clear the ' + cfg.zone.toLowerCase();
        return null;
      };
      const tryInteract = () => {
        if (overlayRef.current) return;
        const it = nearestInteractable(player.x, player.z, model.interactables);
        if (!it) return;
        if (lockedTest(it)) { AudioFX.bad(); return; }
        if (it.kind === 'exit') { AudioFX.click(); go({ name: 'menu' }); return; }
        openOverlay({ ...it.target });
      };
      engineRef.current = { interact: tryInteract };

      const kd = (e) => {
        if (overlayRef.current) return;
        keys[e.code] = true;
        if (e.code === 'KeyM') { try { musicCycleTrack(1); } catch (e) { } }
        if (e.code === 'KeyE' || e.code === 'Enter') tryInteract();
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      };
      const ku = (e) => { keys[e.code] = false; };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

      const onClick = () => { if (overlayRef.current || isTouch) return; try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (e) { } };
      canvas.addEventListener('click', onClick);
      cleanup.push(() => canvas.removeEventListener('click', onClick));

      const onMM = (e) => {
        if (overlayRef.current) return;
        if (document.pointerLockElement === canvas) {
          player.yaw -= e.movementX * 0.0023;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0021));
        } else if (dragging) {
          player.yaw -= e.movementX * 0.004;
          player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0035));
        }
      };
      const onMD = () => { dragging = true; };
      const onMU = () => { dragging = false; };
      document.addEventListener('mousemove', onMM);
      canvas.addEventListener('mousedown', onMD);
      window.addEventListener('mouseup', onMU);
      cleanup.push(() => { document.removeEventListener('mousemove', onMM); canvas.removeEventListener('mousedown', onMD); window.removeEventListener('mouseup', onMU); });

      const onTS = (e) => { const t = e.touches[0]; if (t && t.clientX > window.innerWidth * 0.4) { lastTX = t.clientX; lastTY = t.clientY; dragging = true; } };
      const onTM = (e) => {
        if (!dragging || overlayRef.current) return;
        const t = e.touches[0]; if (!t) return;
        player.yaw -= (t.clientX - lastTX) * 0.0042;
        player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastTY) * 0.0036));
        lastTX = t.clientX; lastTY = t.clientY;
      };
      const onTE = () => { dragging = false; };
      canvas.addEventListener('touchstart', onTS, { passive: true });
      canvas.addEventListener('touchmove', onTM, { passive: true });
      canvas.addEventListener('touchend', onTE);
      cleanup.push(() => { canvas.removeEventListener('touchstart', onTS); canvas.removeEventListener('touchmove', onTM); canvas.removeEventListener('touchend', onTE); });

      const onResize = () => {
        const ww = mount.clientWidth || window.innerWidth, hh = mount.clientHeight || window.innerHeight;
        camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh); if (post) post.resize(ww, hh);
      };
      window.addEventListener('resize', onResize);
      cleanup.push(() => window.removeEventListener('resize', onResize));

      applyDungeonProgress(api, model, saveRefD.current);
      let last = performance.now();
      let _aim = null, _flash = null, _hp = null, _hpTex = null, _lastBar = -1, _prevE = null, _prevP = null, _punchT = -9e9, _flashT = -9e9, _shakeT = -9e9, _vigT = -9e9, _prevOver = null, _prevPhase = 1;
      const drawHpBar = (tex, frac, tele) => {
        const cv = tex.userData.cv, x = cv.getContext('2d'); x.clearRect(0, 0, 256, 64);
        x.fillStyle = 'rgba(8,10,14,0.82)'; x.fillRect(8, 22, 240, 20);
        x.fillStyle = '#FF5252'; x.fillRect(10, 24, 236 * frac, 16);
        if (tele > 0.02) { x.fillStyle = 'rgba(255,205,80,' + (0.35 + 0.5 * tele) + ')'; x.fillRect(10, 45, 236 * Math.min(1, tele), 6); }
        x.strokeStyle = '#1a1410'; x.lineWidth = 2; x.strokeRect(8, 22, 240, 20);
        tex.needsUpdate = true;
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; frame++;
        _moving = false; _sprint = false;
        if (!overlayRef.current) {
          const inp = inputRef.current;
          let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + inp.jx;
          let mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + inp.jy;
          const mag = Math.hypot(mx, mz);
          if (mag > 1) { mx /= mag; mz /= mag; }
          const sp = (keys.ShiftLeft || keys.ShiftRight || inp.sprint ? 15 : 9.4) * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const nx = player.x + (fx * mz + rx * mx) * sp;
          const nz = player.z + (fz * mz + rz * mx) * sp;
          const cols = dungeonGateOpen(saveRefD.current, model) ? model.colliders : model.collidersClosed;
          const res = resolveCollisions(nx, nz, 0.55, cols);
          player.x = res.x; player.z = res.z;
          _moving = mag > 0.01; _sprint = !!(keys.ShiftLeft || keys.ShiftRight || inp.sprint);

          const it = nearestInteractable(player.x, player.z, model.interactables);
          const key = it ? it.id + '|' + (lockedTest(it) || '') : '';
          if (key !== promptKey) {
            promptKey = key;
            if (!it) setPrompt(null);
            else {
              const lock = lockedTest(it);
              let text;
              if (lock) text = lock;
              else if (it.kind === 'fight') {
                const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
                text = (isTouch ? '⏎ ' : '[E] ') + 'FIGHT — ' + (it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : '') + en.name + (it.title ? ' · ' + it.title : '');
                const bks = model.interactables.filter(b => b.kind === 'book' && b.ord && b.ord < (it.ord || 1e9));
                const gov = bks[bks.length - 1];
                if (gov && !((saveRefD.current.lessons || {})[gov.lid])) text += '  ·  ✦ read note #' + gov.ord + ' first';
              } else if (it.kind === 'book') {
                const L = lessonList.find(l => l.id === it.lid);
                text = (isTouch ? '⏎ ' : '[E] ') + 'READ — ' + (it.ord ? '#' + it.ord + ' · ' : '') + (L ? L.title : 'field note');
              } else text = (isTouch ? '⏎ ' : '[E] ') + 'MENU — back to the main menu';
              setPrompt({ text, locked: !!lock });
            }
          }
          const zn = mineZoneAt(model.rects, player.x, player.z) || zoneNow;
          if (zn !== zoneNow) { zoneNow = zn; setBanner(zn); }
        }
        if (frame % 30 === 0) applyDungeonProgress(api, model, saveRefD.current);
        { const _an = scene.userData.anims; if (_an) { const _tn = now / 1000; for (let _i = 0; _i < _an.length; _i++) _an[_i](_tn, dt); } }
        camera.position.set(player.x, 1.7, player.z);
        const _ov = overlayRef.current, _cfx = combatFxRef.current;
        const _fight = _ov && (_ov.name === 'gauntlet' || _ov.name === 'truth' || _ov.name === 'code');
        const _tot = _fight && api && api.totems ? api.totems[_ov.id] : null;
        if (_tot && _tot.creature) {
          const _cr = _tot.creature;
          if (!_aim) _aim = new THREE.PerspectiveCamera();
          if (!_flash) { _flash = new THREE.PointLight(0xfff1c0, 0, 20, 2.0); scene.add(_flash); }
          if (!_hp) {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
            _hpTex = new THREE.CanvasTexture(cv); _hpTex.userData = { cv };
            _hp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _hpTex, transparent: true, depthTest: false }));
            _hp.scale.set(7, 1.75, 1); scene.add(_hp);
          }
          _aim.position.copy(camera.position); _aim.lookAt(_cr.position.x, _cr.position.y + 2.6, _cr.position.z);
          camera.quaternion.slerp(_aim.quaternion, Math.min(1, dt * 5));
          _hp.visible = true; _hp.position.set(_cr.position.x, _cr.position.y + (_cr.userData && _cr.userData.wyrm ? 12.5 : 5.0), _cr.position.z);
          if (_cfx) {
            const ef = Math.max(0, Math.min(1, _cfx.ehp / Math.max(1, _cfx.maxEhp)));
            if (ef !== _lastBar || frame % 6 === 0) { _lastBar = ef; drawHpBar(_hpTex, ef, _cfx.tele || 0); }
            if (_prevE == null) _prevE = _cfx.ehp; if (_prevP == null) _prevP = _cfx.php;
            if (_cfx.ehp < _prevE - 0.001) { _punchT = now; _flashT = now; _cr.userData.hitT = now / 1000; _vmJabT = now; }
            if (_cfx.php < _prevP - 0.001) { _shakeT = now; _vigT = now; }
            if (_cfx.phase != null) { if (_cfx.phase > _prevPhase) { _prevPhase = _cfx.phase; _punchT = now; _flashT = now; _shakeT = now; _vigT = now; if (_cr.userData) _cr.userData.enrage = _cfx.phase; spawnShatter(scene, _cr.position.x, _cr.position.y + 1.8, _cr.position.z, _cfx.phase >= 3 ? 0xFF3B2E : 0xFF7A33); AudioFX.bad(); } else if (_cfx.phase < _prevPhase) { _prevPhase = _cfx.phase; } }
            if (_cfx.over === 'won' && _prevOver !== 'won') { spawnShatter(scene, _cr.position.x, _cr.position.y + 1.6, _cr.position.z, 0x9fe6ff); AudioFX.win(); }
            _prevE = _cfx.ehp; _prevP = _cfx.php; _prevOver = _cfx.over;
          }
          const pk = Math.max(0, 1 - (now - _punchT) / 220);
          camera.fov = 74 - 7 * pk; camera.updateProjectionMatrix();
          _flash.position.set(_cr.position.x, _cr.position.y + 2.2, _cr.position.z);
          _flash.intensity = 2.8 * Math.max(0, 1 - (now - _flashT) / 170);
          const sk = Math.max(0, 1 - (now - _shakeT) / 320);
          if (sk > 0) { camera.position.x += (Math.random() - 0.5) * 0.55 * sk; camera.position.y += (Math.random() - 0.5) * 0.45 * sk; }
          if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.7 * Math.max(0, 1 - (now - _vigT) / 380));
        } else {
          camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
          if (_hp) _hp.visible = false;
          if (_flash) _flash.intensity = 0;
          if (camera.fov !== 74) { camera.fov = 74; camera.updateProjectionMatrix(); }
          if (vignetteRef.current && vignetteRef.current.style.opacity !== '0') vignetteRef.current.style.opacity = '0';
        }
        lamp.position.set(player.x, 1.78, player.z);
        fillLight.position.set(player.x, 2.6, player.z);
        const fx2 = -Math.sin(player.yaw), fz2 = -Math.cos(player.yaw);
        lamp.target.position.set(player.x + fx2 * 7, 1.0 + player.pitch * 4, player.z + fz2 * 7);
        if (api.creatures) { const _ct = now / 1000; for (let _i = 0; _i < api.creatures.length; _i++) { const _c = api.creatures[_i]; const _dx = player.x - _c.it.x, _dz = player.z - _c.it.z; updateCreature(_c.grp, _ct, { dt, dx: _dx, dz: _dz, dist: Math.hypot(_dx, _dz) }); } }
        const _stepped = stepCamera(camera, 1.7, dt, _moving, _sprint, _bob);
        if (ambRef.current) { ambRef.current.update(dt, now / 1000, _moving, _sprint); if (_stepped) ambRef.current.footstep(); }
        { const gw = (saveRefD.current.gear && saveRefD.current.gear.weapon) || 'w_iron'; if (gw !== _vmWeap) { if (_vm) camera.remove(_vm); _vm = makeViewModel(gw); camera.add(_vm); _vmWeap = gw; } if (_vm) updateViewModel(_vm, now, _moving, _vmJabT); }
        FR.tick(post ? 1 : 0);
        if (post) post.render(scene, camera); else renderer.render(scene, camera);
      };
      tick();
      cleanup.push(() => cancelAnimationFrame(raf));
    } catch (e) {
      setFailed(true);
    }
    return () => {
      cleanup.forEach(f => { try { f(); } catch (e) { } });
      if (renderer) { try { renderer.dispose(); } catch (e) { } try { renderer.domElement && renderer.domElement.remove(); } catch (e) { } } try { post && post.dispose(); } catch (ePd) { } try { renderer && renderer.forceContextLoss && renderer.forceContextLoss(); } catch (ePf) { }
    };
  }, []); // eslint-disable-line

  useEffect(() => { applyGfx(ctxRef.current, gfx); }, [gfx]); // eslint-disable-line

  const renderOverlay = () => {
    if (!overlay) return null;
    let label = '', body = null;
    if (overlay.name === 'gauntlet') {
      const en = enemyFor(overlay.id, w, 30, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <GauntletScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'truth') {
      const en = enemyFor(overlay.id, w, 35, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <TruthScreen key={overlay.id} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'code') {
      const en = enemyFor(overlay.id, w, 50, modelMemo.bossId === overlay.id, activeMode, save.ngplus);
      label = 'ENGAGED — ' + en.name;
      body = <CodeScreen key={overlay.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={overlay.id} save={save} go={oGo} onComplete={cb.completeChallenge} onBossWin={cb.onBossWin} onStat={cb.onStat} onCombatEnd={cb.onCombatEnd} onConsume={cb.onConsume} onCombatFx={oCombatFx} />;
    } else if (overlay.name === 'note') {
      const L = lessonList.find(l => l.id === overlay.id);
      const read = !!(save.lessons && save.lessons[overlay.id]);
      label = 'FIELD NOTE';
      body = L ? (
        <div style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow" style={{ color: accHex, marginBottom: 8 }}>recovered field note · {world.name.toLowerCase()}</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 600 }}>{L.title}</h2>
            <div className="lessonbody" style={{ fontSize: 13.5, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
            {L.code && <pre className="codeblock" style={{ marginTop: 12 }}>{L.code}</pre>}
            {LESSON_DEPTH[L.id] && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1B2433' }}>
                <div className="eyebrow" style={{ marginBottom: 7, color: '#6FB7C9' }}>going deeper</div>
                <div style={{ fontSize: 13, color: '#A7B6C8' }}><Paragraphs text={LESSON_DEPTH[L.id]} /></div>
              </div>
            )}
            <button className="btn primary sm" style={{ marginTop: 14 }}
              onClick={() => { AudioFX.good(); if (!read) cb.onLessonRead(overlay.id); }}>
              {read ? 'logged ✓' : 'log it to the manual'}
            </button>
          </div>
        </div>
      ) : <div style={{ marginTop: 20, color: '#76849A' }}>The pages have rotted away.</div>;
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: overlay.name === 'note' ? 'rgba(3,5,9,0.93)' : 'radial-gradient(ellipse at 50% 40%, rgba(3,5,9,0.28) 0%, rgba(3,5,9,0.88) 80%)', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '14px 18px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
            <span className="eyebrow" style={{ color: overlay.name === 'note' ? '#9FB2C9' : '#FF8B82', letterSpacing: '0.14em' }}>{overlay.name === 'note' ? '✦ ' : '⚔ '}{label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#FFC76B', fontVariantNumeric: 'tabular-nums' }}><Coins size={13} /> {save.scrap || 0}</span>
            {overlay.name !== 'note' && <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(v => !v); }}><BookOpen size={12} /> field notes</button>}
            <button className="lnk" onClick={() => { AudioFX.click(); setNotesOpen(false); setOverlay(null); }}>
              {overlay.name === 'note' ? 'close' : 'flee'} <X size={12} />
            </button>
          </div>
          {body}
        </div>
        {notesOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(3,5,9,0.97)', overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #161D29', paddingBottom: 10 }}>
                <span className="eyebrow" style={{ color: '#7DEFFF', display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookOpen size={13} /> FIELD NOTES — {(world && world.name) || ''}</span>
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setNotesOpen(false); }}>close <X size={12} /></button>
              </div>
              {(() => { const logged = (LESSONS[w] || []).filter(l => save.lessons && save.lessons[l.id]); return logged.length ? logged.map(L => (
                <div key={L.id} className="card" style={{ padding: '16px 18px', marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{L.title}</h3>
                  <div className="lessonbody" style={{ fontSize: 13, color: '#B9C6D6' }}><Paragraphs text={L.body} /></div>
                  {L.code && <pre className="codeblock" style={{ marginTop: 10 }}>{L.code}</pre>}
                </div>
              )) : <div style={{ marginTop: 18, color: '#7E8CA0', fontSize: 13 }}>No field notes logged yet — find and read notes out in the world to keep them here for reference during fights.</div>; })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (failed) {
    const model = modelMemo;
    const gateOpen = dungeonGateOpen(save, model);
    const ordOfL = {}; model.interactables.forEach(i => { if (i.kind === 'book') ordOfL[i.lid] = i.ord; });
    const fightsOrdered = model.interactables.filter(i => i.kind === 'fight').slice().sort((a, b) => (a.ord || 99) - (b.ord || 99));
    return (
      <div style={{ marginTop: 22, maxWidth: 640, position: 'relative' }}>
        {overlay && renderOverlay()}
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={14} /> main menu</button>
        <div className="card" style={{ padding: '16px 18px', marginTop: 8 }}>
          <div className="eyebrow" style={{ color: '#FF8B82', marginBottom: 8 }}>NO WEBGL SIGNAL</div>
          <div style={{ fontSize: 13, color: '#B9C6D6', marginBottom: 14 }}>
            This device can't render {world.name} in 3D. Pick a fight below — same battles, no walking.
          </div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {fightsOrdered.map(it => {
              const en = enemyFor(it.id, w, it.xp || 30, it.boss, activeMode, save.ngplus);
              const sealed = it.boss && !gateOpen;
              const done = !!activeDone(save)[it.id];
              return (
                <button key={it.id} className="card" disabled={sealed}
                  style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: sealed ? 'not-allowed' : 'pointer', opacity: sealed ? 0.45 : 1, borderColor: it.boss ? '#7A6310' : undefined }}
                  onClick={() => openOverlay({ ...it.target })}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: done ? '#7CE7A2' : it.boss ? '#FFE27A' : '#E8F1FA' }}>{it.boss ? '★ FINAL · ' : it.ord ? '#' + it.ord + ' · ' : ''}{en.name}{done ? ' ✓' : ''}</span>
                  <div style={{ fontSize: 11, color: '#76849A' }}>{sealed ? 'SEALED — clear the hall first' : (it.title || it.id)}</div>
                </button>
              );
            })}
            {lessonList.map(L => (
              <button key={L.id} className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                onClick={() => openOverlay({ name: 'note', id: L.id })}>
                <span style={{ fontSize: 13, color: accHex }}>{ordOfL[L.id] ? '#' + ordOfL[L.id] + ' · ' : ''}FIELD NOTE — {L.title}{save.lessons && save.lessons[L.id] ? ' ✓' : ''}</span>
              </button>
            ))}
            <button className="card" style={{ padding: '10px 13px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => go({ name: 'menu' })}>
              <span style={{ fontSize: 13 }}>MAIN MENU</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#' + cfg.theme.bg.toString(16).padStart(6, '0') }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <CinematicFX accent={accHex} />
      <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => { AudioFX.click(); onSettings(); }} title="settings"><Settings size={13} /></button>
      <EnterFade />

      <button className="btn sm" style={{ position: 'absolute', top: 12, left: 12, zIndex: 25 }}
        onClick={() => { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { } AudioFX.click(); go({ name: 'menu' }); }}>
        <ChevronLeft size={12} /> menu
      </button>

      {!overlay && !isTouch && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 5, height: 5, borderRadius: 99, background: accHex, opacity: 0.85, transform: 'translate(-50%,-50%)', zIndex: 22, boxShadow: '0 0 8px ' + accHex }} />
      )}

      {banner && !overlay && (
        <div key={banner} className="popin" style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <div style={{ display: 'inline-block', padding: '7px 22px', border: '1px solid #1D2632', borderRadius: 8, background: 'rgba(6,8,12,0.82)', letterSpacing: '.22em', fontSize: 13, color: accHex }}>
            {banner}
          </div>
        </div>
      )}

      {prompt && !overlay && (
        <div style={{ position: 'absolute', bottom: isTouch ? 120 : 64, left: 0, right: 0, textAlign: 'center', zIndex: 22, pointerEvents: 'none' }}>
          <span style={{ padding: '8px 16px', borderRadius: 7, background: 'rgba(6,8,12,0.88)', border: '1px solid ' + (prompt.locked ? '#B14A52' : '#2A3344'), color: prompt.locked ? '#FF8B82' : accHex, fontSize: 13, letterSpacing: '.08em' }}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && !overlay && (
        <div style={{ position: 'absolute', bottom: 64, left: 16, zIndex: 23, maxWidth: 290 }} className="card">
          <div style={{ padding: '12px 14px' }}>
            <div className="eyebrow" style={{ color: accHex, marginBottom: 8 }}>{cfg.zone.toLowerCase()} · access granted</div>
            <div style={{ fontSize: 12.5, color: '#B9C6D6', lineHeight: 1.55 }}>
              {isTouch
                ? 'Left stick walks. Drag the right side to look. ⏎ engages.'
                : 'Click to capture the mouse. WASD walks, Shift sprints, E engages. Clear the hall to unseal the gate — the boss waits beyond it.'}
            </div>
            <button className="lnk" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { AudioFX.click(); setShowHelp(false); }}>got it</button>
          </div>
        </div>
      )}

      {isTouch && !overlay && <TouchControls inputRef={inputRef} onInteract={() => engineRef.current && engineRef.current.interact()} />}

      <div ref={vignetteRef} style={{ position: 'absolute', inset: 0, zIndex: 39, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse at center, rgba(170,20,20,0) 38%, rgba(140,8,8,0.92) 100%)' }} />

      {overlay && renderOverlay()}
    </div>
  );
}

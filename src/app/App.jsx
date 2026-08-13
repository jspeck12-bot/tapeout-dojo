import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Cpu, Zap, Trophy,
  RotateCcw,
} from "lucide-react";
import {
  reviewUpdate, todayNum,
} from '../game/recall.js';
import {
  LESSONS,
  ACHIEVEMENTS, RANKS, MODES, modeOf, TOPIC_OF,
} from '../game/content.js';
import { noteMeta } from '../game/codex.js';
import { bossSpec, grantRemembrance } from '../game/bosses.js';
import {
  levelFromXp, ITEM_BY_ID,
} from '../game/rpg.js';
import {
  SAVE_KEY, META_KEY, SLOT_KEY,
  normalizeSave, normalizeSlot, cloneSaveForMutation, todayStr, yesterdayStr,
} from './save.js';
import {
  AudioFX,
} from '../audio/index.js';
import {
  CSS,
  Toasts, Confetti, Modal, rankIndex, Header,
} from '../ui/foundations.jsx';
import { MainMenu, TapeoutBay, DrillScreen } from '../ui/menu.jsx';
import { PrologueScreen } from '../ui/PrologueScreen.jsx';
import { CodexScreen } from '../ui/codex/CodexScreen.jsx';
import { BossRushScreen } from '../ui/BossRushScreen.jsx';
import {
  GfxPanel,
} from '../ui/world-shared.jsx';
import { CampusScreen } from '../ui/worlds/CampusScreen.jsx';
import { MineScreen } from '../ui/worlds/MineScreen.jsx';
import { ArcadeScreen } from '../ui/worlds/ArcadeScreen.jsx';
import { DungeonScreen } from '../ui/worlds/DungeonScreen.jsx';
import { StyleGuideScreen } from '../ui/worlds/StyleGuideScreen.jsx';
import { UiKitScreen } from '../ui/UiKitScreen.jsx';
import { WorkbenchScreen } from '../ui/WorkbenchScreen.jsx';
import { WorldSelectScreen } from '../ui/WorldSelectScreen.jsx';
import {
  ShopScreen, LevelUpModal,
} from '../ui/combat.jsx';
import {
  WorldScreen, GauntletScreen, TruthScreen, draftStore, CodeScreen,
  BlitzScreen, BugScreen, AchScreen, ManualScreen,
} from '../ui/challenges.jsx';
import {
  ForgeScreen, TrainingScreen, ProfilesScreen,
} from '../ui/meta.jsx';
import { FR } from '../telemetry/flight-recorder.js';
import {
  ALL_CHALLENGES, worldDone,
} from '../world/challenges.js';

function devScreenFromUrl() {
  if (typeof window === 'undefined') return null;
  const hostname = window.location?.hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return null;
  const params = new URLSearchParams(window.location.search);
  const name = params.get('screen');
  if (!['campus', 'mine', 'arcade', 'dungeon', 'styleguide', 'uikit', 'workbench', 'menu', 'worlds'].includes(name)) return null;
  if (name === 'dungeon') {
    const world = Math.max(2, Math.min(7, Number(params.get('w')) || 2));
    return { name, w: world };
  }
  return { name };
}

export function App() {
  const devScreen = useRef(devScreenFromUrl()).current;
  const [save, setSave] = useState(() => normalizeSave(null));
  const [activeSlot, setActiveSlot] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState(devScreen || { name: 'menu' });
  const drillReturnRef = useRef(false);
  const [toasts, setToasts] = useState([]);
  const [rankModal, setRankModal] = useState(null);
  const [tapeoutModal, setTapeoutModal] = useState(null);
  const [levelModal, setLevelModal] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gfx, setGfx] = useState({ exposure: 1.08, lights: 1.1, ambient: 0.92, fog: 0.032, normal: 0.95, glow: 0.7, bloom: 0.58 });
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
          slot = normalizeSlot(meta.active);
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
      if (!s.tutorial.completed && !devScreen) setScreen({ name: 'prologue', replay: false });
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
    const next = cloneSaveForMutation(prev);
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
      notify: (title, sub, kind) => fx.push([title, sub, kind]),
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
        if (ch.boss) {
          const spec = bossSpec(id);
          const reward = grantRemembrance(s, id);
          if (spec && reward) {
            const item = ITEM_BY_ID[reward];
            ctx.notify('REMEMBRANCE ACQUIRED', item ? item.name : spec.name, 'ach');
          }
        }
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

  const onLessonRecall = useCallback((lid, correct) => {
    try { FR.ev(correct ? 'recall-pass' : 'recall-fail', { id: lid }); } catch (e) { }
    mutate((s, ctx) => {
      const prior = s.noteRecall[lid] || { attempts: 0, correct: 0, streak: 0 };
      s.noteRecall[lid] = {
        attempts: prior.attempts + 1,
        correct: prior.correct + (correct ? 1 : 0),
        streak: correct ? prior.streak + 1 : 0,
        lastDay: todayNum(),
      };
      const topic = noteMeta(lid).topic;
      s.skill[topic] = reviewUpdate(s.skill[topic], correct ? 1 : 0, todayNum());
      if (!correct || s.lessons[lid]) return;
      s.lessons[lid] = true;
      ctx.addXp(5, 'field-note recall passed');
      const allLessons = Object.values(LESSONS).flat();
      if (allLessons.every(lesson => s.lessons[lesson.id])) ctx.award('scholar');
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

  const onWorldDiscovered = useCallback((world) => {
    mutate((s) => { s.exploration.discovered[world] = true; });
  }, [mutate]);

  const onExploreFeature = useCallback((feature) => {
    const state = saveRef.current.exploration;
    const bucket = feature.kind === 'grace' ? 'graces' : feature.kind === 'lore' ? 'lore' : 'caches';
    if (state[bucket][feature.id]) return;
    try { FR.ev('discover', { id: feature.id, kind: feature.kind }); } catch (e) { }
    mutate((s, ctx) => {
      s.exploration[bucket][feature.id] = true;
      if (feature.kind === 'cache') s.scrap += feature.scrap;
      if (feature.kind === 'lore') ctx.addXp(2, 'chip-history terminal recovered');
    });
    if (feature.kind === 'grace') toast('TRACE GRACE SYNCED', 'Checkpoint and retry node online.', 'ach');
    else if (feature.kind === 'cache') toast(`+${feature.scrap} SCRAP`, 'Hidden cache recovered.');
    else toast('HISTORY ARCHIVED', feature.title);
  }, [mutate, toast]);

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
    slot = normalizeSlot(slot);
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

  const onTutorialProgress = useCallback((step) => {
    mutate((s) => {
      s.tutorial = { ...s.tutorial, step };
    });
  }, [mutate]);

  const onTutorialMode = useCallback((mode) => {
    mutate((s) => { s.mode = mode; });
  }, [mutate]);

  const onTutorialComplete = useCallback(({ skipped, replay }) => {
    if (!skipped) {
      onLessonRecall('L1a', true);
      completeChallenge('b1', 1, 30);
    }
    mutate((s) => {
      s.tutorial = {
        completed: true,
        skipped: replay ? !!s.tutorial.skipped : !!skipped,
        step: 7,
        replays: (s.tutorial.replays || 0) + (replay ? 1 : 0),
      };
    });
    go({ name: skipped ? 'campus' : 'mine' });
  }, [completeChallenge, go, mutate, onLessonRecall]);

  // confetti auto-clear
  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(null), 4200);
    return () => clearTimeout(t);
  }, [confetti]);

  const worldCallbacks = useMemo(() => ({
    onLessonRecall,
    completeChallenge,
    onBossWin,
    onStat,
    onTrainingClear,
    onBlitzEnd,
    onBugSolve,
    onVisited,
    onWorldDiscovered,
    onExploreFeature,
    onCombatEnd,
    onConsume,
    onBuy,
    onEquip,
    activeSlot,
    onLoadSlot,
    onNewSlot,
    onDeleteSlot,
    onImport,
    readSlot,
  }), [
    onLessonRecall, completeChallenge, onBossWin, onStat, onTrainingClear,
    onBlitzEnd, onBugSolve, onVisited, onWorldDiscovered, onExploreFeature,
    onCombatEnd, onConsume, onBuy, onEquip,
    activeSlot, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot,
  ]);

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
      {!['menu', 'prologue', 'campus', 'mine', 'arcade', 'dungeon', 'home', 'uikit', 'workbench', 'worlds'].includes(screen.name) && <Header save={save} onHome={() => go({ name: 'menu' })} onToggleSound={toggleSound} onSettings={() => setSettingsOpen(true)} />}
      <div className="wrap">
        {screen.name === 'menu' && <MainMenu save={save} go={go} onSettings={() => setSettingsOpen(true)} onNewGame={() => { onNewSlot(activeSlot); go({ name: 'prologue', replay: false }); }} onReplayTutorial={() => go({ name: 'prologue', replay: true })} />}
        {screen.name === 'prologue' && <PrologueScreen save={save} replay={!!screen.replay} onProgress={onTutorialProgress} onChooseMode={onTutorialMode} onComplete={onTutorialComplete} />}
        {screen.name === 'codex' && <CodexScreen save={save} go={go} onRecall={onLessonRecall} />}
        {screen.name === 'bossrush' && <BossRushScreen save={save} go={go} />}
        {screen.name === 'drill' && <DrillScreen save={save} go={go} onReview={(id, kind) => { drillReturnRef.current = true; go({ name: kind, id }); }} />}
        {screen.name === 'tapeout' && <TapeoutBay save={save} go={go} />}
        {screen.name === 'world' && <WorldScreen w={screen.w} save={save} go={go} onLessonRecall={onLessonRecall} />}
        {screen.name === 'gauntlet' && <GauntletScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'truth' && <TruthScreen key={screen.id} id={screen.id} save={save} go={go} onComplete={completeChallenge} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'code' && <CodeScreen key={screen.id + '|' + (save.ngplus ? 'ng' : save.mode)} id={screen.id} save={save} go={go} onComplete={completeChallenge} onBossWin={onBossWin} onStat={onStat} onCombatEnd={onCombatEnd} onConsume={onConsume} />}
        {screen.name === 'blitz' && <BlitzScreen save={save} go={go} onBlitzEnd={onBlitzEnd} />}
        {screen.name === 'bugs' && <BugScreen save={save} go={go} onBugSolve={onBugSolve} />}
        {(screen.name === 'campus' || screen.name === 'home') && <CampusScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={worldCallbacks} />}
        {screen.name === 'mine' && <MineScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={worldCallbacks} />}
        {screen.name === 'arcade' && <ArcadeScreen save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={worldCallbacks} />}
        {screen.name === 'dungeon' && <DungeonScreen key={screen.w} w={screen.w} save={save} go={go} gfx={gfx} setGfx={setGfx} onSettings={() => setSettingsOpen(true)} cb={worldCallbacks} />}
        {screen.name === 'styleguide' && <StyleGuideScreen go={go} onSettings={() => setSettingsOpen(true)} />}
        {screen.name === 'uikit' && <UiKitScreen go={go} />}
        {screen.name === 'workbench' && <WorkbenchScreen go={go} />}
        {screen.name === 'worlds' && <WorldSelectScreen save={save} go={go} />}
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

          <div className="eyebrow" style={{ marginBottom: 8, color: '#7DEFFF' }}>controls</div>
          <div className="card" style={{ padding: '11px 13px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 14px', fontSize: 12 }}>
            <span style={{ color: '#E8F1FA' }}>WASD / arrows</span><span style={{ color: '#76849A' }}>move</span>
            <span style={{ color: '#E8F1FA' }}>mouse / drag</span><span style={{ color: '#76849A' }}>look</span>
            <span style={{ color: '#E8F1FA' }}>Shift</span><span style={{ color: '#76849A' }}>sprint</span>
            <span style={{ color: '#E8F1FA' }}>E / Enter</span><span style={{ color: '#76849A' }}>interact</span>
            <span style={{ color: '#E8F1FA' }}>M</span><span style={{ color: '#76849A' }}>cycle soundtrack</span>
            <span style={{ color: '#E8F1FA' }}>`</span><span style={{ color: '#76849A' }}>flight note</span>
          </div>

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

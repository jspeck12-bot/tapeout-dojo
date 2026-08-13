import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pickaxe, Binary, Flame, Mountain, Clock, Castle, Cpu, Zap, Lock,
  ChevronLeft, Check, BookOpen, Bug, Timer, Award,
  RotateCcw, Play, Eye, Lightbulb, Terminal, ChevronRight, ChevronDown,
  Sparkles, Medal, SkipForward,
} from "lucide-react";
import { AudioFX, musicEnsure, musicSetState } from '../audio/index.js';
import { vCompile, runChallengeTest } from '../engine/verilog.js';
import { levelizeNetlist, netlistOf } from '../engine/debug/netlist.js';
import { firstDivergence } from '../engine/debug/diagnostics.js';
import {
  mulberry32, WORLDS, LESSONS, LESSON_DEPTH,
  GAUNTLETS, TRUTH_CHALLENGES, CODE_CHALLENGES, REMIX, BUG_HUNTS,
  ACHIEVEMENTS, RANKS, modeOf, BOSS_TIME, TOPIC_LIST, TOPIC_OF, blitzGen,
} from '../game/content.js';
import { enemyFor } from '../game/rpg.js';
import { dueTopics, masteryLevel, todayNum } from '../game/recall.js';
import {
  Inline, Paragraphs, DataTable, PortTable, StarRow,
  highlightVerilog, CodeEditor, Waveform, CombResults, ConsoleOut, rankIndex,
} from './foundations.jsx';
import { useCombat, CombatHUD, FlatlineOverlay } from './combat.jsx';
import { VictoryReport } from './victory/VictoryReport.jsx';
import { NoteTerminal } from './codex/NoteTerminal.jsx';
import { FR } from '../telemetry/flight-recorder.js';
import { ALL_CHALLENGES, challengesOf, activeDone } from '../world/challenges.js';
import { stationSequence } from '../world/progression.js';
import { DUNGEON_CFG } from '../world/dungeon-config.js';

// Pattern-matched help for compiler errors, pointing back at the field note.
const ERR_HELP = [
  { re: /declared more than once/i, tip: 'ports declared in the header are already declared — no second declaration in the body.', q: /declar|module|port/ },
  { re: /is a keyword/i, tip: 'that word belongs to Verilog — pick another name.', q: null },
  { re: /isn't a constant/i, tip: 'widths and part-selects need literal numbers (or parameters).', q: /vector|bit|bus/ },
  { re: /backwards/i, tip: 'vectors go [msb:lsb] — bigger index first.', q: /vector|bus/ },
  { re: /doesn't exist/i, tip: 'you indexed past the declared width — check the [msb:lsb] range.', q: /vector|bus/ },
  { re: /Concatenation wider/i, tip: 'keep concatenations 32 bits or narrower in the Dojo.', q: /concat/ },
  { re: /by zero/i, tip: 'guard the divisor — real dividers have no exceptions, only wrong answers.', q: null },
  { re: /isn't supported in the Dojo/i, tip: 'the Dojo speaks the synthesizable subset — express it with assign, always, if, case.', q: /always|assign/ },
  { re: /isn't declared|not declared|undeclared|unknown signal/i, tip: 'declare it (wire/reg) or add it to the port list before use.', q: /declar|wire|reg/ },
  { re: /^Expected/i, tip: 'syntax slip — a missing ; often gets reported one line late, so check the line above too.', q: /assign|first/ },
];
function errHelpFor(msg, world) {
  const h = ERR_HELP.find(e => e.re.test(msg || ''));
  if (!h) return null;
  let note = null;
  try {
    if (h.q) {
      const lessons = LESSONS[world] || [];
      const L = lessons.find(l => h.q.test((l.title || '').toLowerCase()));
      if (L) {
        const seq = stationSequence(challengesOf(world).filter(c => !c.boss), lessons.map(x => x.id));
        let ord = null; seq.forEach((s, i) => { if (s.kind === 'book' && s.lid === L.id) ord = i + 1; });
        note = { ord, title: L.title };
      }
    }
  } catch (e) { note = null; }
  return { tip: h.tip, note };
}

// Pure diagnostics, recall scheduling, and RTL export live in focused modules.

// CONTENT, NG+ REMIX, and TRAINING GENERATORS live in ./game/content.js.

// RPG SPINE lives in ./game/rpg.js.

// UI FOUNDATIONS live in ./ui/foundations.jsx.

// ============================================================
// WORLD INDEX + 2D SCREENS — WorldScreen
// Pure challenge registry and unlock helpers live in ./world/challenges.js.
// ============================================================
const WORLD_ICONS = { 1: Pickaxe, 2: Binary, 3: Flame, 4: Mountain, 5: Clock, 6: Castle, 7: Cpu };

function WorldScreen({ w, save, go, onLessonRecall }) {
  const world = WORLDS.find(x => x.id === w);
  const lessons = LESSONS[w] || [];
  const chs = challengesOf(w);
  // station numbers — same learning order the 3D worlds use
  const _seq = stationSequence(chs.filter(c => !c.boss), lessons.map(L => L.id));
  const stOrd = {}; _seq.forEach((s, i) => { stOrd[s.kind === 'book' ? s.lid : s.f.id] = i + 1; });
  const bossOrd = _seq.length + 1;
  const [openLesson, setOpenLesson] = useState(null);
  const Icon = WORLD_ICONS[w];
  return (
    <div style={{ marginTop: 22 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 2px' }}>
        <Icon size={22} color={world.color} strokeWidth={1.7} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '.05em' }}>{world.name}</h1>
      </div>
      <div style={{ color: '#76849A', fontSize: 13, maxWidth: 640 }}>{world.desc}</div>
      {w === 1 && (
        <button className="card" onClick={() => { AudioFX.click(); go({ name: 'mine' }); }}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '13px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: '#7A6310', margin: '14px 0 0', maxWidth: 640 }}>
          <Pickaxe size={16} color="#FFC76B" />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: '#FFC76B', letterSpacing: '.05em' }}>DESCEND INTO THE MINES</div>
            <div style={{ fontSize: 11.5, color: '#76849A' }}>Walk the shaft. Fight the galleries. The wyrm sleeps at the bottom.</div>
          </div>
          <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
      )}

      {w >= 2 && DUNGEON_CFG[w] && (
        <button className="card" onClick={() => { AudioFX.click(); go({ name: 'dungeon', w }); }}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '13px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: world.color, margin: '14px 0 0', maxWidth: 640 }}>
          <Icon size={16} color={world.color} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: world.color, letterSpacing: '.05em' }}>{DUNGEON_CFG[w].descend.label}</div>
            <div style={{ fontSize: 11.5, color: '#76849A' }}>{DUNGEON_CFG[w].descend.sub}</div>
          </div>
          <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
        </button>
      )}

      {lessons.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>field notes · recall gates XP · numbered = read order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {lessons.map(L => {
              const read = !!save.lessons[L.id];
              const open = openLesson === L.id;
              return (
                <div key={L.id} className="card" style={{ overflow: 'hidden' }}>
                  <button
                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '11px 15px', background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => {
                      AudioFX.click();
                      setOpenLesson(open ? null : L.id);
                    }}>
                    <BookOpen size={14} color={read ? world.color : '#5A6A80'} />
                    <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(stOrd[L.id] || 0).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13.5, color: read ? '#D7E0EA' : '#A9B7C9' }}>{L.title}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {read && <Check size={13} color={world.color} />}
                      {open ? <ChevronDown size={14} color="#5A6A80" /> : <ChevronRight size={14} color="#5A6A80" />}
                    </span>
                  </button>
                  {open && (
                    <div style={{ padding: 10, borderTop: '1px solid #161D29' }}>
                      <NoteTerminal lesson={L} depth={LESSON_DEPTH[L.id]} worldLabel={world.name}
                        accent={world.color} collected={read}
                        recallRecord={save.noteRecall?.[L.id]}
                        onRecall={correct => onLessonRecall(L.id, correct)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{w === 7 ? 'the final build' : 'challenges · numbers match the trail stations'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {chs.map((c, idx) => {
            const rec = activeDone(save)[c.id];
            return (
              <button key={c.id} className="card" onClick={() => { AudioFX.click(); go({ name: c.kind, id: c.id }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: c.boss ? (rec ? world.color : '#3A2E14') : '#1D2632', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = world.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = c.boss ? (rec ? world.color : '#3A2E14') : '#1D2632'}>
                <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(c.boss ? bossOrd : (stOrd[c.id] || idx + 1)).padStart(2, '0')}</span>
                {c.boss
                  ? <Zap size={15} color="#FACC15" fill={rec ? '#FACC15' : 'none'} />
                  : (c.kind === 'code' ? <Terminal size={14} color={world.color} /> : <Sparkles size={14} color={world.color} />)}
                <span style={{ fontSize: 14, color: rec ? '#D7E0EA' : '#C2CFDE', fontWeight: c.boss ? 600 : 400, letterSpacing: c.boss ? '.04em' : 0 }}>{c.title}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#5A6A80' }}>{c.xp} xp</span>
                  {rec ? <StarRow n={rec.stars} /> : <span style={{ fontSize: 11, color: '#3A4759' }}>—</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- gauntlet screen ----------
function GauntletScreen({ id, save, go, onComplete, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('combat'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const g = GAUNTLETS.find(x => x.id === id);
  const world = WORLDS.find(x => x.id === g.world);
  const [run, setRun] = useState(() => newRun());
  const firstTimeRef = useRef(!save.done[id]);
  function newRun() {
    const rng = mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9));
    return { rng, qIdx: 0, q: g.gen(rng, 0), wrongs: 0, phase: 'ask', input: '', picked: null, lastRight: false, finished: false, stars: 0 };
  }
  const TOTAL = 5;
  const effModeG = save.ngplus ? 'architect' : save.mode;
  const enemyG = useMemo(() => enemyFor(g.id, g.world, g.xp, false, effModeG, !!save.ngplus), []); // eslint-disable-line
  const combat = useCombat({ enemy: enemyG, save, live: !(activeDone(save)[g.id]), onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line
  const submitText = () => {
    if (!run.input.trim()) return;
    const right = run.q.check(run.input);
    onStat(TOPIC_OF[g.id] || 'numbers', right);
    combat.onAnswer(right);
    if (!right) FR.ev('gfail', { id });
    right ? AudioFX.good() : AudioFX.bad();
    setRun(r => ({ ...r, phase: 'show', lastRight: right, wrongs: r.wrongs + (right ? 0 : 1) }));
  };
  const pickMC = (i) => {
    const right = i === run.q.correct;
    onStat(TOPIC_OF[g.id] || 'numbers', right);
    combat.onAnswer(right);
    if (!right) FR.ev('gfail', { id });
    right ? AudioFX.good() : AudioFX.bad();
    setRun(r => ({ ...r, phase: 'show', picked: i, lastRight: right, wrongs: r.wrongs + (right ? 0 : 1) }));
  };
  const next = () => {
    AudioFX.click();
    if (run.qIdx + 1 >= TOTAL) {
      const stars = run.wrongs === 0 ? 3 : run.wrongs <= 2 ? 2 : 1;
      setRun(r => ({ ...r, finished: true, stars, firstClear: firstTimeRef.current }));
      combat.victory();
      onComplete(g.id, stars, g.xp);
      firstTimeRef.current = false;
      return;
    }
    setRun(r => ({ ...r, qIdx: r.qIdx + 1, q: g.gen(r.rng, r.qIdx + 1), phase: 'ask', input: '', picked: null }));
  };
  const already = !!save.done[g.id];

  if (run.finished) {
    const lootScrap = (combat.loot && combat.loot.scrap) || 0;
    const flawless = !!(combat.loot && combat.loot.flawless) || run.wrongs === 0;
    return (
      <div style={{ marginTop: 22, maxWidth: 560 }}>
        <CombatHUD c={combat} save={save} />
        <VictoryReport
          overlay
          tone={flawless || run.stars === 3 ? 'brass' : 'ok'}
          kicker={flawless ? 'bin-1 yield · flawless ×1.5' : `${g.title} · yield report`}
          title={run.wrongs === 0 ? 'ZERO DEFECT' : run.wrongs <= 2 ? 'SIGNED OFF' : 'SURVIVED'}
          body={
            (run.wrongs === 0
              ? 'Five for five — not a single missed bit.'
              : `${TOTAL - run.wrongs}/${TOTAL} on first attempts.`)
            + (run.firstClear ? ` +${g.xp} XP.` : ' Replay — no XP.')
          }
          stars={run.stars}
          stats={[
            { id: 'scrap', label: 'reclaimed', value: lootScrap, prefix: '+', accent: 'brass' },
            { id: 'xp', label: 'process credit', value: run.firstClear ? g.xp : 0, prefix: '+', accent: 'ok' },
            { id: 'hit', label: 'first tries', value: `${TOTAL - run.wrongs}/${TOTAL}`, accent: 'cyan' },
          ]}
          primary={{
            label: `back to ${world.name}`,
            onClick: () => { AudioFX.click(); go({ name: 'world', w: g.world }); },
          }}
          secondary={{
            label: 'run it again',
            hotkey: 'r',
            onClick: () => { AudioFX.click(); setRun(newRun()); },
          }}
          hint="ENTER · continue   ·   R · reprobe"
        />
      </div>
    );
  }

  const q = run.q;
  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: g.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: g.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{g.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{g.xp} xp{already ? ' · cleared' : ''}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>{g.intro}</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} style={{ width: 26, height: 5, borderRadius: 99, background: i < run.qIdx ? world.color : i === run.qIdx ? '#3A4A63' : '#161D29' }} />
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: run.wrongs ? '#FF8B82' : '#5A6A80' }}>{run.wrongs} missed</span>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, lineHeight: 1.7 }}><Inline text={q.text} /></div>
        {q.table && <DataTable table={q.table} accent={world.color} />}

        {q.kind === 'mc' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
            {q.options.map((o, i) => {
              let cls = 'opt';
              if (run.phase === 'show') {
                if (i === q.correct) cls += ' right';
                else if (i === run.picked) cls += ' wrong';
              }
              return (
                <button key={i} className={cls} disabled={run.phase === 'show'} onClick={() => pickMC(i)}>
                  <span style={{ color: '#5A6A80', marginRight: 8 }}>{String.fromCharCode(65 + i)}</span><Inline text={o} />
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              className="field"
              value={run.input}
              disabled={run.phase === 'show'}
              autoFocus
              onChange={e => setRun(r => ({ ...r, input: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && run.phase === 'ask') submitText(); }}
              placeholder="answer…"
              aria-label="answer"
            />
            {run.phase === 'ask' && <button className="btn primary" onClick={submitText}>submit</button>}
          </div>
        )}

        {run.phase === 'show' && (
          <div className={run.lastRight ? '' : 'shake'} style={{ marginTop: 14, padding: '11px 14px', borderRadius: 7, border: '1px solid', borderColor: run.lastRight ? '#2EA56A' : '#B14A52', background: run.lastRight ? '#0E2418' : '#2A1216', fontSize: 13 }}>
            <div style={{ color: run.lastRight ? '#7CE7A2' : '#FF8B82', fontWeight: 600, marginBottom: 4 }}>
              {run.lastRight ? 'CORRECT' : 'MISS'}{!run.lastRight && q.answer ? <span style={{ fontWeight: 400 }}> — answer: <Inline text={q.answer} /></span> : null}
            </div>
            <div style={{ color: '#B9C6D6' }}><Inline text={q.explain} /></div>
            <button className="btn sm primary" style={{ marginTop: 10 }} onClick={next} autoFocus>
              {run.qIdx + 1 >= TOTAL ? 'finish' : 'next'} <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- truth-table screen ----------
function TruthScreen({ id, save, go, onComplete, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('combat'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const tc = TRUTH_CHALLENGES.find(t => t.id === id);
  const world = WORLDS.find(x => x.id === tc.world);
  const [item] = useState(() => tc.pool[Math.floor(Math.random() * tc.pool.length)]);
  const rows = useMemo(() => Array.from({ length: 8 }, (_, x) => [(x >> 2) & 1, (x >> 1) & 1, x & 1]), []);
  const [cells, setCells] = useState(Array(8).fill(null));
  const [badRows, setBadRows] = useState(new Set());
  const [subs, setSubs] = useState(0);
  const [done, setDone] = useState(false);
  const [doneMeta, setDoneMeta] = useState(null);
  const already = !!save.done[tc.id];
  const enemyT = useMemo(() => enemyFor(tc.id, tc.world, tc.xp, false, save.ngplus ? 'architect' : save.mode, !!save.ngplus), []); // eslint-disable-line
  const combat = useCombat({ enemy: enemyT, save, live: !(activeDone(save)[tc.id]), onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line

  const toggle = (i) => {
    if (done) return;
    AudioFX.click();
    setCells(c => c.map((v, j) => j === i ? (v === null ? 0 : v === 0 ? 1 : 0) : v));
    setBadRows(b => { const nb = new Set(b); nb.delete(i); return nb; });
  };
  const submit = () => {
    if (cells.some(c => c === null)) { AudioFX.bad(); setBadRows(new Set(cells.map((c, i) => c === null ? i : -1).filter(i => i >= 0))); return; }
    const bad = new Set();
    rows.forEach((r, i) => { if (item.fn(r[0], r[1], r[2]) !== cells[i]) bad.add(i); });
    onStat('boolean', bad.size === 0);
    setSubs(s => s + 1);
    if (bad.size === 0) {
      combat.victory();
      AudioFX.win();
      setDone(true);
      const stars = subs === 0 ? 3 : subs <= 2 ? 2 : 1;
      setDoneMeta({ stars, firstClear: !already });
      onComplete(tc.id, stars, tc.xp);
    } else {
      FR.ev('tfail', { id });
      combat.onRun({ ok: false, frac: (8 - bad.size) / 8 });
      AudioFX.bad();
      setBadRows(bad);
    }
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 560 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: tc.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: tc.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{tc.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{tc.xp} xp{already ? ' · cleared' : ''}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>{tc.intro}</div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 16, marginBottom: 12 }}><code className="codespan" style={{ fontSize: 15, padding: '4px 10px', color: world.color }}>{item.label}</code></div>
        <table className="tbl">
          <thead><tr>{item.vars.map(v => <th key={v}>{v}</th>)}<th style={{ color: world.color }}>Y</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((b, j) => <td key={j} style={{ color: '#8FA3BC' }}>{b}</td>)}
                <td>
                  <button className={'ycell' + (badRows.has(i) ? ' bad' : '')} onClick={() => toggle(i)} disabled={done} aria-label={`row ${i} output`}>
                    {cells[i] === null ? '·' : cells[i]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!done ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn primary" onClick={submit}><Play size={13} /> verify table</button>
            {subs > 0 && <span style={{ fontSize: 12, color: '#FF8B82' }}>{badRows.size} row{badRows.size === 1 ? '' : 's'} wrong — fix the marked cells</span>}
          </div>
        ) : (
          <VictoryReport
            overlay
            tone={(doneMeta && doneMeta.stars === 3) ? 'brass' : 'ok'}
            kicker={(doneMeta && doneMeta.stars === 3) ? 'bin-1 yield · first submit' : 'yield report · truth table'}
            title={(doneMeta && doneMeta.stars === 3) ? 'ZERO DEFECT' : 'TABLE VERIFIED'}
            body="This table now uniquely defines the circuit. Any implementation matching it is the same hardware."
            stars={doneMeta ? doneMeta.stars : 0}
            stats={[
              { id: 'scrap', label: 'reclaimed', value: (combat.loot && combat.loot.scrap) || 0, prefix: '+', accent: 'brass' },
              { id: 'xp', label: 'process credit', value: (doneMeta && doneMeta.firstClear) ? tc.xp : 0, prefix: '+', accent: 'ok' },
              { id: 'tries', label: 'submits', value: subs === 0 ? 1 : subs, accent: 'cyan' },
            ]}
            primary={{
              label: `back to ${world.name}`,
              onClick: () => { AudioFX.click(); go({ name: 'world', w: tc.world }); },
            }}
            hint="ENTER · continue"
          />
        )}
      </div>
    </div>
  );
}

// ---------- code challenge screen ----------
const draftStore = {};
// ============================================================
// DEBUG BAY UI — hardware schematic view
// ============================================================
// "View as hardware": renders the compiled module as a levelized gate
// schematic. Your assign IS these gates; an uncovered always-path IS that
// red dashed latch loop. SVG, headless-safe, no draw effects.
function SchematicView({ mod, iface, accent }) {
  const lay = useMemo(() => {
    try { return levelizeNetlist(netlistOf(mod)); }
    catch (e) { return { err: (e && e.message) || 'failed' }; }
  }, [mod]);
  if (!lay || lay.err) return <div style={{ fontSize: 12, color: '#5A6A80', padding: 8 }}>hardware view unavailable — {lay && lay.err}</div>;
  if (lay.nodes.length > 130) return <div style={{ fontSize: 12, color: '#5A6A80', padding: 8 }}>this one is too big to draw ({lay.nodes.length} elements) — trust the waveform</div>;
  const acc = accent || '#7DEFFF';
  const stroke = '#41546F', fill = '#101823', txt = '#C9D6E6';
  const els = [];
  // wires under nodes
  lay.edges.forEach((e, i) => {
    const a = lay.nodes[e.from], b = lay.nodes[e.to];
    const fx = a.x + a.wd, fy = a.y + a.ht / 2;
    const ty = b.y + b.ht * (e.pin + 1) / (b.ins.length + 1), tx = b.x;
    const dx = Math.max(22, (tx - fx) / 2);
    const busy = (a.w || 1) > 1;
    els.push(<path key={'w' + i}
      d={`M ${fx} ${fy} C ${fx + dx} ${fy}, ${tx - dx} ${ty}, ${tx} ${ty}`}
      stroke={e.fb ? '#FF8B82' : busy ? acc : stroke} strokeWidth={busy ? 2.3 : 1.25}
      strokeDasharray={e.fb ? '5 4' : undefined} fill="none" opacity={e.fb ? 0.9 : 0.8} />);
    if (busy) els.push(<text key={'wl' + i} x={fx + 7} y={fy - 4} fontSize="9" fill={acc} opacity="0.8">{a.w}</text>);
  });
  // nodes
  lay.nodes.forEach(n => {
    const { x, y, wd: w, ht: h, type: t } = n;
    const k = 'n' + n.id;
    const lbl = (tx2, ty2, s, col, size, kk) => <text key={k + (kk || 'l')} x={tx2} y={ty2} fontSize={size || 10.5} textAnchor="middle" fill={col || txt} fontFamily="ui-monospace, monospace">{s}</text>;
    if (t === 'IN' || t === 'OUT') {
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={h / 2} fill={t === 'OUT' ? 'rgba(125,239,255,.08)' : fill} stroke={t === 'OUT' ? acc : stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, n.label + (n.w > 1 ? '[' + (n.w - 1) + ':0]' : ''), t === 'OUT' ? acc : '#9FB4C8', 10));
    } else if (t === 'CONST') {
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, n.label, '#8FA3BC', 10));
    } else if (t === 'DFF' || t === 'LATCH') {
      const bad = t === 'LATCH';
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={bad ? '#FF8B82' : '#FFE27A'} strokeWidth={1.4} strokeDasharray={bad ? '4 3' : undefined} />);
      els.push(<path key={k + 'c'} d={`M ${x} ${y + h - 13} l 8 5.5 l -8 5.5`} stroke={bad ? '#FF8B82' : '#FFE27A'} fill="none" strokeWidth="1.2" />);
      els.push(lbl(x + w / 2, y + 13, n.label, bad ? '#FF8B82' : '#FFE27A', 10));
      els.push(lbl(x + w / 2, y + h / 2 + 8, bad ? 'LATCH ⚠' : 'DFF', bad ? '#FF8B82' : '#B9A24A', 9, 'l2'));
    } else if (t === 'MUX') {
      els.push(<path key={k} d={`M ${x} ${y} L ${x + w} ${y + 9} L ${x + w} ${y + h - 9} L ${x} ${y + h} Z`} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, 'mux', '#8FA3BC', 9));
    } else if (t === 'NOT' || t === 'NEG') {
      els.push(<path key={k} d={`M ${x} ${y + 3} L ${x + w - 9} ${y + h / 2} L ${x} ${y + h - 3} Z`} fill={fill} stroke={stroke} />);
      els.push(<circle key={k + 'b'} cx={x + w - 5} cy={y + h / 2} r={3.6} fill={fill} stroke={stroke} />);
      if (t === 'NEG') els.push(lbl(x + 10, y + h / 2 + 3.5, '−', txt, 11));
    } else if (t === 'AND' || t === 'OR' || t === 'XOR' || t === 'XNOR') {
      const orish = t !== 'AND';
      const back = orish ? `M ${x} ${y} Q ${x + 12} ${y + h / 2} ${x} ${y + h}` : `M ${x} ${y} L ${x} ${y + h}`;
      els.push(<path key={k} d={`${back} L ${x + w * 0.45} ${y + h} Q ${x + w} ${y + h} ${x + w} ${y + h / 2} Q ${x + w} ${y} ${x + w * 0.45} ${y} Z`} fill={fill} stroke={stroke} />);
      if (t === 'XOR' || t === 'XNOR') els.push(<path key={k + 'x'} d={`M ${x - 5} ${y} Q ${x + 7} ${y + h / 2} ${x - 5} ${y + h}`} stroke={stroke} fill="none" />);
      if (t === 'XNOR') els.push(<circle key={k + 'b'} cx={x + w + 4} cy={y + h / 2} r={3.6} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w * 0.52, y + h / 2 + 3.5, n.label, '#8FA3BC', 10));
    } else if (t === 'ADD' || t === 'SUB' || t === 'MUL') {
      els.push(<circle key={k} cx={x + w / 2} cy={y + h / 2} r={w / 2} fill={fill} stroke={stroke} />);
      els.push(lbl(x + w / 2, y + h / 2 + 4.5, t === 'ADD' ? '+' : t === 'SUB' ? '−' : '×', txt, 14));
    } else {
      els.push(<rect key={k} x={x} y={y} width={w} height={h} rx={5} fill={fill} stroke={t === 'NET' ? '#FF8B82' : stroke} strokeDasharray={t === 'NET' ? '4 3' : undefined} />);
      els.push(lbl(x + w / 2, y + h / 2 + 3.5, t === 'PROC' ? n.label : t === 'CMP' || t === 'RED' ? n.label : t === 'NET' ? n.label + ' ↩' : n.label, t === 'NET' ? '#FF8B82' : '#9FB4C8', 9.5));
    }
  });
  return (
    <div>
      {lay.latched.length > 0 && (
        <div style={{ fontSize: 12, color: '#FF8B82', marginBottom: 6 }}>
          ⚠ inferred latch on <b>{lay.latched.join(', ')}</b> — some path through your always block keeps the old value. That dashed loop below is the accidental memory.
        </div>
      )}
      <div style={{ overflow: 'auto', maxHeight: 380, border: '1px solid #1B2534', borderRadius: 8, background: '#0A0F16' }}>
        <svg width={lay.W} height={lay.H} style={{ display: 'block' }}>{els}</svg>
      </div>
      <div style={{ fontSize: 10.5, color: '#5A6A80', marginTop: 5 }}>
        your code, as silicon — gold box = flip-flop (state) · dashed red = feedback · thick {'\u007B'}wire{'\u007D'} = multi-bit bus · signal flows left → right
      </div>
    </div>
  );
}

function CodeScreen({ id, save, go, onComplete, onBossWin, onStat, onCombatEnd, onConsume, onCombatFx }) {
  useEffect(() => { try { musicEnsure(); musicSetState('boss'); } catch (e) { } return () => { try { musicSetState('explore'); } catch (e) { } }; }, []);
  const base = CODE_CHALLENGES.find(c => c.id === id);
  const ng = !!save.ngplus && !!REMIX[id];
  const ch = ng ? { ...base, ...REMIX[id], id: base.id, world: base.world } : base;
  const effMode = save.ngplus ? 'architect' : save.mode;
  const M = modeOf(effMode);
  const starter = effMode === 'architect'
    ? `// ARCHITECT MODE — build module ${ch.iface.name} from the interface spec\n\n`
    : ch.starter;
  const dk = id + '|' + effMode + (ng ? '+' : '');
  const world = WORLDS.find(x => x.id === ch.world);
  const [code, setCode] = useState(() => draftStore[dk] !== undefined ? draftStore[dk] : starter);
  const [out, setOut] = useState(null);
  const [dbgView, setDbgView] = useState('sig');
  const [errLines, setErrLines] = useState(new Set());
  const [hintsOpen, setHintsOpen] = useState(0);
  const [solOpen, setSolOpen] = useState(false);
  const attemptsRef = useRef(0);
  const solUsedRef = useRef(false);
  const timeUpRef = useRef(false);
  const [passed, setPassed] = useState(false);
  const [passMeta, setPassMeta] = useState(null);
  const [reportOpen, setReportOpen] = useState(true);
  const dmap = save.ngplus ? (save.doneNg || {}) : save.done;
  const already = !!dmap[id];
  const activeTest = effMode === 'apprentice' ? ch.test : (ch.testHard || ch.test);
  const topic = TOPIC_OF[id] || 'gates';
  const bossT = (effMode === 'architect' && ch.boss && BOSS_TIME[id]) ? BOSS_TIME[id] : 0;
  const [timeLeft, setTimeLeft] = useState(bossT);
  const expired = bossT > 0 && timeLeft === 0;
  const chsW = challengesOf(ch.world);
  const isBossFight = !!ch.boss || chsW[chsW.length - 1].id === ch.id;
  const enemy = useMemo(() => enemyFor(ch.id, ch.world, ch.xp, isBossFight, effMode, ng), []); // eslint-disable-line
  const combat = useCombat({ enemy, save, live: !already, onEnd: onCombatEnd, onConsume });
  useEffect(() => { if (onCombatFx) onCombatFx({ ehp: combat.ehp, maxEhp: combat.enemy.hp, php: combat.php, maxPhp: combat.stats.maxHp, tele: combat.tele, over: combat.over, phase: combat.phase, boss: combat.enemy.boss }); }, [combat.ehp, combat.php, combat.tele, combat.over, combat.phase]); // eslint-disable-line

  const setCodeWrapped = (v) => { draftStore[dk] = v; setCode(v); };

  useEffect(() => {
    if (!bossT || passed || expired) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [bossT, passed, expired]);
  useEffect(() => { if (expired) timeUpRef.current = true; }, [expired]);

  const run = () => {
    if (combat.dead) return;
    AudioFX.click();
    const res = vCompile(code, ch.iface);
    const lines = [];
    const eset = new Set();
    if (!res.ok) {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: 0 });
      res.errors.forEach(e => {
        lines.push({ cls: 'c-err', text: `ERROR${e.line ? ' line ' + e.line : ''}: ${e.msg}` });
        if (e.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + e.hint });
        const eh = errHelpFor(e.msg, ch.world);
        if (eh) lines.push({ cls: 'c-hint', text: '  📖 ' + (eh.note && eh.note.ord ? 'field note #' + eh.note.ord + ' · ' + eh.note.title + ' — ' : '') + eh.tip });
        if (e.line) eset.add(e.line);
      });
      lines.push({ cls: 'c-dim', text: `// ${res.errors.length} error${res.errors.length > 1 ? 's' : ''} — fix and re-run` });
      FR.ev('cfail', { id: ch.id });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result: null });
      return;
    }
    (res.warnings || []).forEach(w => lines.push({ cls: 'c-warn', text: `warning line ${w.line}: ${w.msg}` }));
    try {
      const _net = netlistOf(res.mod);
      if (_net.latched.length) lines.push({ cls: 'c-warn', text: 'warning: inferred latch on ' + _net.latched.join(', ') + ' — a path through your always block keeps the old value. Open VIEW AS HARDWARE to see the loop.' });
    } catch (e) { }
    let result;
    try {
      result = runChallengeTest(res.mod, activeTest);
    } catch (e) {
      lines.push({ cls: 'c-err', text: 'SIM ERROR: ' + e.message });
      combat.onRun({ ok: false, frac: 0 });
      FR.ev('sfail', { id: ch.id });
      setErrLines(new Set()); setOut({ lines, result: null, mod: res.mod });
      AudioFX.bad();
      return;
    }
    if (result.runtimeError) {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: 0 });
      lines.push({ cls: 'c-err', text: `RUNTIME${result.runtimeError.line ? ' line ' + result.runtimeError.line : ''}: ${result.runtimeError.msg}` });
      if (result.runtimeError.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + result.runtimeError.hint });
      if (result.runtimeError.line) eset.add(result.runtimeError.line);
      FR.ev('rfail', { id: ch.id });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result, mod: res.mod });
      return;
    }
    if (result.pass) {
      onStat(topic, true);
      lines.push({ cls: 'c-ok', text: `TESTBENCH PASSED — ${result.total}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} ✓` });
      if (!passed && !already) {
        let stars = solUsedRef.current ? 1 : (attemptsRef.current === 0 && hintsOpen === 0 ? 3 : 2);
        if (timeUpRef.current) stars = Math.min(stars, 1);
        lines.push({ cls: 'c-dim', text: `// synthesis-clean. logged as ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` });
        if (timeUpRef.current) lines.push({ cls: 'c-warn', text: '// boss timer expired — clean work, late tapeout. capped at 1★' });
        combat.onRun({ ok: true, frac: 1 });
        onComplete(ch.id, stars, ch.xp);
        if (ch.id === 'chip1') onBossWin(ng);
        setPassMeta({ stars, firstClear: true });
      } else {
        lines.push({ cls: 'c-dim', text: '// already in the record books — clean run' });
        setPassMeta({ stars: (dmap[id] && dmap[id].stars) || 0, firstClear: false });
      }
      FR.ev('pass', { id: ch.id });
      setPassed(true);
      AudioFX.win();
    } else {
      attemptsRef.current++;
      onStat(topic, false);
      combat.onRun({ ok: false, frac: result.total ? result.passCount / result.total : 0 });
      lines.push({ cls: 'c-err', text: `TESTBENCH FAILED — ${result.passCount}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} passing` });
      lines.push({ cls: 'c-dim', text: result.kind === 'comb' ? '// mismatches highlighted below' : '// red cycles in the waveform are where you and the reference disagree' });
      FR.ev('bfail', { id: ch.id, frac: result.total ? +(result.passCount / result.total).toFixed(2) : 0 });
      AudioFX.bad();
    }
    setErrLines(new Set());
    setOut({ lines, result, mod: res.mod });
  };

  const reveal = () => {
    AudioFX.click();
    solUsedRef.current = true;
    setSolOpen(true);
  };

  const inputNames = ch.iface.ports.filter(p => p.d === 'in' && p.n !== 'clk').map(p => p.n);
  const widths = {};
  ch.iface.ports.forEach(p => widths[p.n] = p.w);

  return (
    <div style={{ marginTop: 22 }}>
      {combat.dead && <FlatlineOverlay c={combat} onRetreat={() => go({ name: 'world', w: ch.world })} />}
      <button className="lnk" onClick={() => go({ name: 'world', w: ch.world })}><ChevronLeft size={14} /> {world.name}</button>
      <CombatHUD c={combat} save={save} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 10px', flexWrap: 'wrap' }}>
        {ch.boss && <Zap size={17} color="#FACC15" fill="#FACC15" />}
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.04em', color: ch.boss ? '#FFE27A' : '#E8F1FA' }}>{ch.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{ch.xp} xp{M.mult > 1 ? ` ×${M.mult}` : ''}{already ? ' · cleared' : ''}</span>
        {ng && <span style={{ fontSize: 10, letterSpacing: '.14em', color: '#FFE27A', border: '1px solid #7A6310', borderRadius: 4, padding: '2px 6px' }}>NG+</span>}
        {already && <StarRow n={dmap[id].stars} />}
      </div>

      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 13.5, color: '#B9C6D6' }}>
            <div className="lessonbody"><Paragraphs text={ch.brief} /></div>
            {ch.table && <DataTable table={ch.table} accent={world.color} />}
            <div className="eyebrow" style={{ margin: '14px 0 6px' }}>interface · module {ch.iface.name}</div>
            <PortTable iface={ch.iface} accent={world.color} />
          </div>

          {M.maxHints === 0 ? (
            <div className="card" style={{ marginTop: 10, padding: '12px 16px', fontSize: 12.5, color: '#8A93A3' }}>
              <span style={{ color: '#FFC76B', letterSpacing: '.14em', fontSize: 10.5 }}>ARCHITECT</span> — no hints, no starter{ng ? ', remixed spec' : ''}, {M.mult}× XP. The interface table is the whole spec.
              {bossT > 0 && <div style={{ marginTop: 6, color: '#76849A' }}>Boss timer armed — finish inside {Math.floor(bossT / 60)}:{String(bossT % 60).padStart(2, '0')} or the clear caps at 1★.</div>}
            </div>
          ) : (
          <div className="card" style={{ marginTop: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={14} color="#FFC76B" />
              <span className="eyebrow">hints · {hintsOpen}/{Math.min(ch.hints.length, M.maxHints)} used</span>
              {hintsOpen < Math.min(ch.hints.length, M.maxHints) && (
                <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setHintsOpen(h => h + 1); }}>reveal hint {hintsOpen + 1}</button>
              )}
            </div>
            {ch.hints.slice(0, hintsOpen).map((h, i) => (
              <div key={i} style={{ fontSize: 12.5, color: '#B9C6D6', marginTop: 8, paddingLeft: 10, borderLeft: '2px solid #3A2E14' }}><Inline text={h} /></div>
            ))}
            {isFinite(M.solAfter) && attemptsRef.current >= M.solAfter && !solOpen && (
              <button className="lnk" style={{ marginTop: 10, color: '#FFC76B' }} onClick={reveal}><Eye size={13} /> show solution (caps run at 1★)</button>
            )}
            {solOpen && (
              <pre className="code-common" style={{ marginTop: 10, background: '#0A0E14', border: '1px solid #3A2E14', borderRadius: 7, padding: '10px 13px', overflowX: 'auto', fontSize: 12.5 }}
                dangerouslySetInnerHTML={{ __html: highlightVerilog(ch.solution).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
            )}
          </div>
          )}
        </div>

        <div>
          <CodeEditor value={code} onChange={setCodeWrapped} onRun={run} errLines={errLines} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
            <button className={'btn ' + (ch.boss ? 'gold' : 'primary')} onClick={run}><Play size={13} /> COMPILE & RUN</button>
            <span className="eyebrow hidesm">ctrl+enter</span>
            {bossT > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', fontVariantNumeric: 'tabular-nums', color: expired ? '#FF8B82' : timeLeft <= 30 ? '#FFC76B' : '#7DEFFF', border: '1px solid #1D2632', borderRadius: 5, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Timer size={11} />{expired ? 'ESCAPED' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </span>
            )}
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setCodeWrapped(starter); setOut(null); setErrLines(new Set()); }}><RotateCcw size={12} /> reset code</button>
          </div>
          <ConsoleOut state={out} />
          {out && out.result && !out.result.runtimeError && (
            <div style={{ marginTop: 10 }}>
              {(() => { const d = firstDivergence(out.result, widths); return d ? <div style={{ fontSize: 12, color: '#FF8B82', marginBottom: 7 }}>◈ {d}</div> : null; })()}
              {out.mod && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button className={'btn sm' + (dbgView !== 'hw' ? ' primary' : '')} onClick={() => { AudioFX.click(); setDbgView('sig'); }}>signals</button>
                  <button className={'btn sm' + (dbgView === 'hw' ? ' primary' : '')} onClick={() => { AudioFX.click(); setDbgView('hw'); FR.ev('hw', { id: ch.id }); }}>view as hardware</button>
                </div>
              )}
              {dbgView === 'hw' && out.mod
                ? <SchematicView mod={out.mod} iface={ch.iface} accent={world.color} />
                : out.result.kind === 'comb'
                  ? <CombResults result={out.result} iface={ch.iface} />
                  : <Waveform trace={out.result.trace} watch={activeTest.watch} inputNames={inputNames} widths={widths} accent={world.color} />}
            </div>
          )}
          {passed && (
            <div className="popin" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => go({ name: 'world', w: ch.world })}>back to {world.name} <ChevronRight size={13} /></button>
              {nextChallengeAfter(ch.id) && (
                <button className="btn" onClick={() => { const n = nextChallengeAfter(ch.id); go({ name: n.kind, id: n.id }); }}>
                  next: {nextChallengeAfter(ch.id).title} <SkipForward size={13} />
                </button>
              )}
            </div>
          )}
          {passed && reportOpen && (
            <VictoryReport
              overlay
              tone={ch.boss || (passMeta && passMeta.stars === 3) ? 'brass' : 'ok'}
              kicker={ch.boss ? 'lot closed · boss destroyed' : ((passMeta && passMeta.stars === 3) ? 'bin-1 yield · synthesis-clean' : 'yield report · testbench')}
              title={ch.boss ? ch.title : ((passMeta && passMeta.stars === 3) ? 'ZERO DEFECT' : 'SIGNED OFF')}
              body={
                (passMeta && passMeta.firstClear)
                  ? 'Synthesis-clean. The testbench signed the lot. Reclaimed metal is in the hopper.'
                  : 'Already in the record books — clean run. Replay grants no XP.'
              }
              stars={passMeta ? passMeta.stars : 0}
              stats={[
                { id: 'scrap', label: 'reclaimed', value: (combat.loot && combat.loot.scrap) || 0, prefix: '+', accent: 'brass' },
                { id: 'xp', label: 'process credit', value: (passMeta && passMeta.firstClear) ? ch.xp : 0, prefix: '+', accent: 'ok' },
              ]}
              primary={{
                label: `back to ${world.name}`,
                onClick: () => { AudioFX.click(); go({ name: 'world', w: ch.world }); },
              }}
              secondary={nextChallengeAfter(ch.id)
                ? {
                  label: `next: ${nextChallengeAfter(ch.id).title}`,
                  onClick: () => {
                    AudioFX.click();
                    const n = nextChallengeAfter(ch.id);
                    go({ name: n.kind, id: n.id });
                  },
                }
                : {
                  label: 'inspect hardware',
                  onClick: () => { AudioFX.click(); setReportOpen(false); },
                }}
              hint="ENTER · continue"
            />
          )}
        </div>
      </div>
    </div>
  );
}
function nextChallengeAfter(id) {
  const ch = ALL_CHALLENGES.find(c => c.id === id);
  if (!ch) return null;
  const list = challengesOf(ch.world);
  const idx = list.findIndex(c => c.id === id);
  return idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null;
}

// ---------- Binary Blitz ----------
function BlitzScreen({ save, go, onBlitzEnd }) {
  const [phase, setPhase] = useState('idle'); // idle | run | done
  const [time, setTime] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBest, setComboBest] = useState(0);
  const [q, setQ] = useState(null);
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(null); // 'ok' | {answer}
  const rngRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const timeLeftRef = useRef(60);
  const stateRef = useRef({ score: 0, comboBest: 0 });

  const start = () => {
    AudioFX.click();
    rngRef.current = mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9));
    stateRef.current = { score: 0, comboBest: 0 };
    setScore(0); setCombo(0); setComboBest(0); setTime(60); setInput(''); setFlash(null);
    setQ(blitzGen(0, rngRef.current));
    setPhase('run');
    clearInterval(timerRef.current);
    timeLeftRef.current = 60;
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      const t = timeLeftRef.current;
      setTime(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        setPhase('done');
        onBlitzEnd(stateRef.current.score, stateRef.current.comboBest);
      } else if (t <= 5) {
        AudioFX.tick();
      }
    }, 1000);
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => { if (phase === 'run' && inputRef.current) inputRef.current.focus(); }, [phase, q]);

  const submit = () => {
    if (!input.trim() || phase !== 'run') return;
    if (q.check(input)) {
      AudioFX.good();
      const ns = score + 1, nc = combo + 1;
      stateRef.current.score = ns;
      stateRef.current.comboBest = Math.max(stateRef.current.comboBest, nc);
      setScore(ns); setCombo(nc); setComboBest(b => Math.max(b, nc));
      setFlash('ok');
      setQ(blitzGen(ns, rngRef.current));
    } else {
      AudioFX.bad();
      setCombo(0);
      setFlash({ answer: q.answer });
      setQ(blitzGen(score, rngRef.current));
    }
    setInput('');
    setTimeout(() => setFlash(null), 900);
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 560 }}>
      <button className="lnk" onClick={() => { clearInterval(timerRef.current); go({ name: 'home' }); }}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Timer size={18} color="#7DEFFF" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>BINARY BLITZ</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>high score {save.blitzHigh}</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>
        60 seconds of conversions. Difficulty ramps with your score: nibbles → hex → bytes → two's complement. +1 XP per correct answer. This is how sight-reading gets built.
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#76849A', marginBottom: 16 }}>Type the answer, hit Enter. Wrong answers cost the combo, never the clock.</div>
          <button className="btn primary" style={{ fontSize: 15, padding: '11px 22px' }} onClick={start}><Play size={15} /> START RUN</button>
        </div>
      )}

      {phase === 'run' && q && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
            <span style={{ color: time <= 10 ? '#FF8B82' : '#76849A' }}>⏱ {time}s</span>
            <span style={{ color: '#7DEFFF' }}>score {score}</span>
            <span style={{ color: combo >= 5 ? '#FFC76B' : '#76849A' }}>{combo >= 2 ? `combo ×${combo}` : 'combo —'}</span>
          </div>
          <div className="hbar" style={{ marginBottom: 18 }}><div style={{ width: (time / 60 * 100) + '%', background: time <= 10 ? '#B14A52' : 'linear-gradient(90deg,#155E6B,#22D3EE)', transition: 'width 1s linear' }} /></div>
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div className="eyebrow">{q.sub}</div>
            <div style={{ fontSize: 34, letterSpacing: '.06em', margin: '8px 0 2px', color: '#E8F1FA' }}>{q.text}</div>
            <div style={{ height: 18, fontSize: 12 }}>
              {flash === 'ok' && <span style={{ color: '#7CE7A2' }}>✓ +1</span>}
              {flash && flash !== 'ok' && <span style={{ color: '#FF8B82' }}>✗ was {flash.answer}</span>}
            </div>
          </div>
          <input ref={inputRef} className="field" style={{ textAlign: 'center', fontSize: 19 }} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="…" aria-label="blitz answer" />
        </div>
      )}

      {phase === 'done' && (
        <div className="card popin" style={{ padding: 28, textAlign: 'center', borderColor: score > save.blitzHigh ? '#FACC15' : '#1D2632' }}>
          <div className="eyebrow" style={{ color: '#7DEFFF' }}>run complete</div>
          <div style={{ fontSize: 42, fontWeight: 600, margin: '6px 0 2px' }}>{score}</div>
          <div style={{ fontSize: 12.5, color: '#76849A', marginBottom: 6 }}>best combo ×{comboBest} · +{score} XP</div>
          {score >= save.blitzHigh && score > 0 && <div style={{ color: '#FFE27A', fontSize: 13, marginBottom: 6 }}>NEW HIGH SCORE</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={start}><RotateCcw size={13} /> run it back</button>
            <button className="btn" onClick={() => go({ name: 'home' })}>the fab</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Bug Bounty ----------
function BugScreen({ save, go, onBugSolve }) {
  const [openId, setOpenId] = useState(null);
  const [tries, setTries] = useState(0);
  const [picked, setPicked] = useState(new Set());
  const [state, setState] = useState('hunt'); // hunt | solved | revealed
  const bug = BUG_HUNTS.find(b => b.id === openId);

  const openCase = (id) => { AudioFX.click(); setOpenId(id); setTries(0); setPicked(new Set()); setState('hunt'); };
  const clickLine = (i) => {
    if (state !== 'hunt' || picked.has(i)) return;
    if (i === bug.bug) {
      AudioFX.win();
      setState('solved');
      onBugSolve(bug.id, tries === 0);
    } else {
      AudioFX.bad();
      const np = new Set(picked); np.add(i); setPicked(np);
      const nt = tries + 1;
      setTries(nt);
      if (nt >= 2) setState('revealed');
    }
  };

  if (bug) {
    return (
      <div style={{ marginTop: 22, maxWidth: 640 }}>
        <button className="lnk" onClick={() => setOpenId(null)}><ChevronLeft size={14} /> case files</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
          <Bug size={17} color="#FB7185" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{bug.title}</h2>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{bug.cat}</span>
        </div>
        <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 12 }}>
          One line is lying. Click it. {state === 'hunt' && (tries === 0 ? 'First click for the clean solve.' : '1 miss — last chance.')}
        </div>
        <div className="card" style={{ padding: '12px 6px', overflowX: 'auto' }}>
          {bug.lines.map((ln, i) => {
            let cls = 'bugline';
            if (state !== 'hunt' && i === bug.bug) cls += state === 'solved' ? ' hit' : ' reveal';
            else if (picked.has(i)) cls += ' miss';
            return (
              <button key={i} className={cls} disabled={state !== 'hunt'} onClick={() => clickLine(i)}>
                <span style={{ color: '#3A4759', marginRight: 12 }}>{String(i + 1).padStart(2, ' ')}</span>{ln}
              </button>
            );
          })}
        </div>
        {state !== 'hunt' && (
          <div className="popin card" style={{ marginTop: 12, padding: '14px 16px', borderColor: state === 'solved' ? '#2EA56A' : '#7A6310' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: state === 'solved' ? '#7CE7A2' : '#FFC76B', marginBottom: 6 }}>
              {state === 'solved' ? (tries === 0 ? 'CLEAN SOLVE — line ' + (bug.bug + 1) : 'SOLVED — line ' + (bug.bug + 1)) : 'REVEALED — line ' + (bug.bug + 1)}
            </div>
            <div style={{ fontSize: 13, color: '#B9C6D6' }}>{bug.why}</div>
            <div style={{ fontSize: 12.5, color: '#7CE7A2', marginTop: 8 }}>fix → <code className="codespan">{bug.fix}</code></div>
            <button className="btn sm primary" style={{ marginTop: 12 }} onClick={() => setOpenId(null)}>next case <ChevronRight size={12} /></button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Bug size={18} color="#FB7185" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>BUG BOUNTY</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{save.bugsSolved.length}/12 squashed</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 14 }}>
        Twelve modules from the rejected pile, each hiding one bug. Click the guilty line — first-click solves pay 15 XP, second-click 8. These are the exact mistakes that eat real engineers' afternoons.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {BUG_HUNTS.map((b, idx) => {
          const solved = save.bugsSolved.includes(b.id);
          return (
            <button key={b.id} className="card" onClick={() => openCase(b.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#FB7185'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1D2632'}>
              <span style={{ fontSize: 11, color: '#5A6A80', width: 20 }}>{String(idx + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 13.5, color: solved ? '#76849A' : '#C2CFDE' }}>{b.title}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, color: '#5A6A80' }}>{b.cat}</span>
                {solved ? <Check size={14} color="#7CE7A2" /> : <span style={{ fontSize: 11, color: '#3A4759' }}>—</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- achievements ----------
function AchScreen({ save, go }) {
  const ri = rankIndex(save.xp);
  return (
    <div style={{ marginTop: 22, maxWidth: 640 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <Award size={18} color="#FACC15" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>SERVICE RECORD</h2>
      </div>
      <StatsPanel save={save} />
      <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>career ladder</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RANKS.map((r, i) => (
            <span key={r[0]} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 99, border: '1px solid', borderColor: i === ri ? '#22D3EE' : i < ri ? '#2EA56A' : '#1D2632', color: i === ri ? '#7DEFFF' : i < ri ? '#7CE7A2' : '#5A6A80' }}>
              {r[0]} · {r[1]}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {ACHIEVEMENTS.map(a => {
          const got = save.ach.includes(a.id);
          return (
            <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', opacity: got ? 1 : 0.55 }}>
              {got ? <Medal size={16} color="#FACC15" /> : <Lock size={14} color="#3A4759" />}
              <div>
                <div style={{ fontSize: 13.5, color: got ? '#FFE27A' : '#76849A' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: '#5A6A80' }}>{a.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: got ? '#FFC76B' : '#3A4759' }}>+{a.xp} xp</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- field manual ----------
const MANUAL = [
  ['Module template', "module name(\n  input        a,\n  input  [3:0] bus_in,\n  output       y,\n  output reg [3:0] q   // reg if driven in always\n);\n  wire [3:0] t;        // internal wiring\n  // logic here\nendmodule"],
  ['Literals', "4'b1010   // 4-bit binary = 10\n8'hD6     // 8-bit hex   = 214\n8'd214    // 8-bit decimal\n4'b10_10  // underscores ok\n7         // bare = 32-bit (be deliberate)"],
  ['Operators (high → low)', "~  !  -        // not, logical-not, negate\n&  |  ^  ~&    // reductions (unary, on a bus)\n*  /  %\n+  -\n<<  >>\n<  <=  >  >=\n==  !=\n&              // bitwise and\n^  ~^          // xor, xnor\n|              // bitwise or\n&&  ||         // logical\ncond ? a : b   // mux"],
  ['Wiring tricks', "{a, b}            // concatenate (a on top)\n{cout, sum} = a+b // split a wide result\n{4{bit}}          // replicate\nbus[7:4]          // part-select\nbus[i]            // bit-select\n|bus  &bus  ^bus  // any-set, all-set, parity"],
  ['The two always blocks', "// combinational: blocking =, cover every path\nalways @(*) begin\n  case (sel)\n    2'd0: y = a;\n    default: y = 1'b0;  // no latches\n  endcase\nend\n\n// clocked: non-blocking <=, reset first\nalways @(posedge clk) begin\n  if (rst)     q <= 4'd0;\n  else if (en) q <= q + 1;\n  // no else: register holds\nend"],
  ['Iron laws', "wire  <- driven by assign (one driver each)\nreg   <- driven inside always\nclocked  -> <=     combinational -> =\ncomb if needs else; comb case needs default\nclocked if without else just HOLDS (that's fine)\nN-bit + N-bit needs N+1 bits"],
  ['Dojo subset', "Supported: assign, always @(*) / @(posedge clk),\nif/else, case, parameter/localparam, all the\noperators above, up to 32-bit signals.\n\nNot here (yet, in your career): instantiation,\ninitial blocks, signed, x/z, generate, functions.\nThe bench drives clk and rst for you — sequential\ntests always start with a reset cycle."],
];
function ManualScreen({ go }) {
  return (
    <div style={{ marginTop: 22, maxWidth: 680 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <BookOpen size={18} color="#A3E635" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>FIELD MANUAL</h2>
      </div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
        {MANUAL.map(([title, body]) => (
          <div key={title} className="card" style={{ padding: '13px 15px' }}>
            <div className="eyebrow" style={{ marginBottom: 8, color: '#A3E635' }}>{title}</div>
            <pre className="code-common" style={{ fontSize: 12, overflowX: 'auto', color: '#B9C6D6' }}
              dangerouslySetInnerHTML={{ __html: highlightVerilog(body).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Stats panel (lives in Service Record) ----------
function fmtPlay(ms) {
  const m = Math.floor((ms || 0) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function StatsPanel({ save }) {
  const stats = save.stats || { topics: {}, playMs: 0, runs: 0 };
  const cleared = Object.keys(save.done).length;
  const clearedNg = Object.keys(save.doneNg || {}).length;
  const threeStar = Object.values(save.done).filter(d => d.stars === 3).length;
  const nums = [
    ['xp', save.xp], ['cleared', `${cleared}/${ALL_CHALLENGES.length}` + (save.ngplus || clearedNg ? ` · NG+ ${clearedNg}` : '')],
    ['3★', threeStar], ['time', fmtPlay(stats.playMs)],
    ['blitz', save.blitzHigh], ['combo', '×' + (save.comboBest || 0)],
    ['bugs', `${save.bugsSolved.length}/12`], ['dailies', save.dailyCount || 0], ['reps', save.trainTotal || 0],
  ];
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>engineering stats</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginBottom: 14 }}>
        {nums.map(([k, v]) => (
          <span key={k} style={{ fontSize: 12.5 }}><span style={{ color: '#5A6A80' }}>{k} </span><span style={{ color: '#D7E0EA' }}>{v}</span></span>
        ))}
      </div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>accuracy by topic · first-try precision across {stats.runs || 0} graded attempts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TOPIC_LIST.map(t => {
          const d = stats.topics[t.id];
          const acc = d && d.a > 0 ? d.p / d.a : null;
          const col = acc === null ? '#1D2632' : acc >= 0.8 ? '#2EA56A' : acc >= 0.55 ? '#FFC76B' : '#B14A52';
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: '#76849A', width: 130, flexShrink: 0 }}>{t.label}</span>
              <div className="hbar" style={{ flex: 1 }}>
                <div style={{ width: (acc === null ? 0 : Math.max(4, acc * 100)) + '%', background: col }} />
              </div>
              <span style={{ fontSize: 11, color: acc === null ? '#3A4759' : '#A9B7C9', width: 70, textAlign: 'right' }}>
                {acc === null ? '—' : `${Math.round(acc * 100)}% · ${d.p}/${d.a}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>concept recall · spaced review{(() => { const due = dueTopics(save.skill, todayNum()).length; return due ? ` · ${due} due` : ''; })()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TOPIC_LIST.map(t => {
          const rec = (save.skill || {})[t.id];
          const lvl = masteryLevel(rec);
          const due = rec && rec.seen && (rec.dueDay || 0) <= todayNum();
          const names = ['—', 'learning', 'practiced', 'mastered'];
          const cols = ['#1D2632', '#FFC76B', '#7FB2E8', '#2EA56A'];
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: '#76849A', width: 130, flexShrink: 0 }}>{t.label}</span>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 22, height: 6, borderRadius: 3, background: i < lvl ? cols[lvl] : '#161E28' }} />)}
              </div>
              <span style={{ fontSize: 11, color: lvl ? '#A9B7C9' : '#3A4759', width: 70, textAlign: 'right' }}>{names[lvl]}{due ? ' ·due' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export {
  WorldScreen,
  GauntletScreen,
  TruthScreen,
  draftStore,
  SchematicView,
  CodeScreen,
  BlitzScreen,
  BugScreen,
  AchScreen,
  ManualScreen,
};

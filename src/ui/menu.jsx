import { useEffect, useMemo, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Cpu, Medal, Star, Terminal,
} from "lucide-react";
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import {
  CODE_CHALLENGES, hashStr, RANKS, TOPIC_LIST, TOPIC_OF, WORLDS,
} from '../game/content.js';
import {
  conceptMastery, dueTopics, masteryLevel, todayNum,
} from '../game/recall.js';
import { exportRTL } from '../engine/debug/rtl-export.js';
import { levelFromXp } from '../game/rpg.js';
import { rankIndex } from './foundations.jsx';
import { ALL_CHALLENGES } from '../world/challenges.js';
import { TOKEN_CSS } from './tokens.js';
import { Panel } from './components/Panel.jsx';
import { MenuRow } from './components/MenuRow.jsx';
import {
  ArcadeMark, BookMark, ChipMark, CoinMark, GearMark, PlayMark,
  ReplayMark, SparkMark, SwordMark,
} from './components/icons.jsx';

// ============================================================
// MAIN MENU + TAPEOUT BAY + SPACED REVIEW
// ============================================================

function MainMenu({ save, go, onSettings, onNewGame, onReplayTutorial }) {
  useEffect(() => { try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { } }, []);
  const [stage, setStage] = useState('boot');
  const [confirmNew, setConfirmNew] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);
  const mapNodes = useMemo(() => {
    const P = [[180, 820], [430, 720], [250, 540], [560, 470], [360, 300], [680, 250], [520, 110]];
    return WORLDS.map((w, i) => ({ id: w.id, color: w.color, name: w.name, x: P[i][0], y: P[i][1] }));
  }, []);
  const tracePath = useMemo(
    () => mapNodes.map((n, i) => (i ? 'L' : 'M') + n.x + ',' + n.y).join(' '),
    [mapNodes],
  );
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53 + 7) % 100,
    delay: ((i * 0.37) % 4).toFixed(2),
    dur: (3.4 + (i % 5) * 0.6).toFixed(2),
    ch: (i * 7) % 3 === 0 ? '1' : '0',
    size: 11 + (i % 3) * 3,
  })), []);
  const ri = rankIndex(save.xp);
  const dueCount = dueTopics(save.skill, todayNum()).length;
  const signedOff = CODE_CHALLENGES.filter(c => save.done[c.id]).length;
  const lvl = levelFromXp(save.xp || 0);

  return (
    <div className="sg-ui mm-root" data-menu-status={stage}>
      <style>{TOKEN_CSS}</style>
      <style>{`
        .mm-root{
          position:fixed;inset:0;z-index:30;overflow:auto;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:clamp(20px,3.5vh,40px) clamp(16px,4vw,48px) 28px;
        }
        .mm-grid{
          position:absolute;left:-30%;right:-30%;bottom:-12%;height:62%;
          background-image:
            linear-gradient(color-mix(in srgb, var(--sg-brass) 12%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-cyan) 10%, transparent) 1px, transparent 1px);
          background-size:46px 46px;
          transform:perspective(420px) rotateX(62deg);
          transform-origin:50% 100%;
          animation:mm-pan 7s linear infinite;
          -webkit-mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          pointer-events:none;z-index:0;
        }
        @keyframes mm-pan{from{background-position:0 0}to{background-position:0 46px}}
        .mm-bit{
          position:absolute;top:-8%;
          color:color-mix(in srgb, var(--sg-brass) 28%, transparent);
          font-family:var(--sg-font-mono);
          animation:mm-fall linear infinite;
          pointer-events:none;z-index:1;
        }
        @keyframes mm-fall{to{transform:translateY(116vh)}}
        .mm-map{position:absolute;inset:0;width:100%;height:100%;z-index:1;opacity:.42;pointer-events:none}
        .mm-trace{stroke-dasharray:9 13;animation:mm-flow 4s linear infinite;stroke:color-mix(in srgb, var(--sg-cyan) 32%, transparent)}
        @keyframes mm-flow{to{stroke-dashoffset:-44}}
        .mm-node{animation:mm-pulse 3.2s ease-in-out infinite}
        @keyframes mm-pulse{0%,100%{stroke-opacity:.22}50%{stroke-opacity:.6}}
        .mm-brand{
          text-shadow:
            0 0 24px color-mix(in srgb, var(--sg-brass) 35%, transparent),
            0 0 60px color-mix(in srgb, var(--sg-cyan-deep) 16%, transparent);
        }
        .mm-shell{
          position:relative;z-index:2;width:min(420px,94vw);
          min-height:min(100%, calc(100vh - 56px));
          display:grid;
          grid-template-rows:auto 1fr auto;
          gap:clamp(14px,2.2vh,22px);
          align-content:center;
        }
        .mm-shell .sg-panel{width:100%}
        .mm-actions{display:flex;flex-direction:column;gap:8px;align-items:stretch;width:100%}
        .mm-actions .sg-menu-row{width:100%;max-width:none}
        .mm-stats{
          display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;
          font-size:11.5px;color:var(--sg-ink-dim);
        }
        .mm-stats .mm-rank{color:var(--sg-cyan);letter-spacing:.12em}
        .mm-stats .mm-scrap{color:var(--sg-brass)}
        .mm-stats .mm-ng{color:var(--sg-brass);letter-spacing:.1em}
        .mm-frame{
          fill:none;stroke:color-mix(in srgb, var(--sg-cyan-deep) 18%, transparent);stroke-width:2;
        }
        .mm-frame-soft{
          fill:none;stroke:color-mix(in srgb, var(--sg-cyan-deep) 8%, transparent);stroke-width:1.5;
        }
        .mm-pin{fill:none;stroke:color-mix(in srgb, var(--sg-cyan-deep) 14%, transparent);stroke-width:2}
        .mm-label{fill:color-mix(in srgb, var(--sg-ink-muted) 55%, transparent);font-size:13px;font-family:var(--sg-font-mono)}
        .mm-veil{
          position:absolute;inset:8% 28%;z-index:1;pointer-events:none;
          background:radial-gradient(ellipse at 50% 45%,
            color-mix(in srgb, var(--sg-bg) 72%, transparent) 0%,
            transparent 72%);
        }
        @media (max-width:720px){
          .mm-veil{inset:6% 4%}
        }
        @media (prefers-reduced-motion:reduce){
          .mm-grid{animation:none;transform:none;opacity:.35}
          .mm-bit,.mm-trace,.mm-node{animation:none !important}
        }
      `}</style>

      <div className="mm-grid" aria-hidden="true" />
      <svg className="mm-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect className="mm-frame" x="78" y="64" width="844" height="872" rx="28" />
        <rect className="mm-frame-soft" x="120" y="106" width="760" height="788" rx="18" />
        <line className="mm-pin" x1="78" y1="500" x2="48" y2="500" />
        <line className="mm-pin" x1="922" y1="500" x2="952" y2="500" />
        <path d={tracePath} fill="none" strokeWidth="3" className="mm-trace" />
        {mapNodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="17" fill={n.color} fillOpacity=".10" />
            <circle cx={n.x} cy={n.y} r="23" fill="none" stroke={n.color} strokeOpacity=".5" strokeWidth="2" className="mm-node" />
            <circle cx={n.x} cy={n.y} r="6" fill={n.color} fillOpacity=".85" />
            <text x={n.x} y={n.y - 32} fill={n.color} fillOpacity=".62" fontSize="19" fontFamily="var(--sg-font-mono)" textAnchor="middle">{n.id < 10 ? '0' + n.id : '' + n.id}</text>
            <text className="mm-label" x={n.x} y={n.y + 40} textAnchor="middle">{n.name}</text>
          </g>
        ))}
      </svg>
      {bits.map((b, i) => (
        <span
          key={i}
          className="mm-bit"
          style={{ left: b.left + '%', fontSize: b.size, animationDelay: b.delay + 's', animationDuration: b.dur + 's' }}
        >
          {b.ch}
        </span>
      ))}
      <div className="mm-veil" aria-hidden="true" />

      <div className="mm-shell">
        <header style={{ textAlign: 'center' }}>
          <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)', marginBottom: 10 }}>
            fab dojo-n4 · rev a
          </div>
          <h1
            className="sg-display mm-brand"
            style={{
              margin: 0,
              fontSize: 'clamp(48px, 10vw, 88px)',
              fontWeight: 700,
              letterSpacing: '.12em',
              color: 'var(--sg-ink)',
              lineHeight: 1,
            }}
          >
            TAPEOUT<span style={{ color: 'var(--sg-cyan)' }}>_</span>
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              letterSpacing: '.34em',
              textTransform: 'uppercase',
              color: 'var(--sg-ink-muted)',
            }}
          >
            the verilog dojo
          </p>
        </header>

        <Panel title="Bay control" tight>
          <nav className="mm-actions" aria-label="main menu">
            <MenuRow
              variant="primary"
              icon={<PlayMark size={17} />}
              title="CONTINUE"
              hint={`resume · walk the fab · Lv ${lvl} · ⛁ ${save.scrap || 0}`}
              onClick={() => { AudioFX.click(); go({ name: 'campus' }); }}
            />
            <MenuRow
              variant={confirmNew ? 'danger' : 'default'}
              icon={<SparkMark size={16} />}
              title={confirmNew ? 'TAP AGAIN — ERASE SAVE' : 'NEW GAME'}
              hint={confirmNew ? 'this wipes all progress on this slot' : 'wipe the wafer & start from the Bit Mines'}
              onClick={() => {
                if (confirmNew) { AudioFX.click(); onNewGame(); }
                else { AudioFX.bad(); setConfirmNew(true); setTimeout(() => setConfirmNew(false), 3200); }
              }}
            />
            <MenuRow
              icon={<ReplayMark size={16} />}
              title="REPLAY PROLOGUE"
              hint="controls, first compile & Debug Bay"
              onClick={() => { AudioFX.click(); onReplayTutorial(); }}
            />
            <MenuRow
              icon={<BookMark size={16} />}
              title="CODEX & MASTERY DIE"
              hint="search recovered notes · inspect weak topics"
              onClick={() => { AudioFX.click(); go({ name: 'codex' }); }}
            />
            {save.tapeoutDone && (
              <MenuRow
                icon={<SwordMark size={16} />}
                title="BOSS RUSH"
                hint="seven remembrances · no runback"
                onClick={() => { AudioFX.bad(); go({ name: 'bossrush' }); }}
              />
            )}
            <MenuRow
              icon={<ArcadeMark size={17} />}
              title="ARCADE"
              hint="training, blitz, bug bounty & the kit"
              onClick={() => { AudioFX.click(); go({ name: 'arcade' }); }}
            />
            <MenuRow
              icon={<ReplayMark size={16} />}
              title="SPACED REVIEW"
              hint={dueCount ? `${dueCount} concept${dueCount > 1 ? 's' : ''} due for recall` : 'keep cleared concepts sharp'}
              onClick={() => { AudioFX.click(); go({ name: 'drill' }); }}
            />
            <MenuRow
              icon={<ChipMark size={16} />}
              title="TAPEOUT BAY"
              hint={signedOff ? `export ${signedOff} signed-off module${signedOff > 1 ? 's' : ''} as RTL` : 'export your modules to real Verilog'}
              onClick={() => { AudioFX.click(); go({ name: 'tapeout' }); }}
            />
            <MenuRow
              icon={<CoinMark size={16} />}
              title="SCRAP EXCHANGE"
              hint="trade scrap for gear & boosts"
              onClick={() => { AudioFX.click(); go({ name: 'shop' }); }}
            />
            <MenuRow
              icon={<GearMark size={15} />}
              title="SETTINGS"
              hint="audio · graphics · accessibility"
              onClick={() => { AudioFX.click(); onSettings(); }}
            />
          </nav>
        </Panel>

        <footer className="mm-stats">
          <span className="mm-rank">{RANKS[ri][0].toUpperCase()}</span>
          <span>Lv {lvl}</span>
          <span className="mm-scrap">⛁ {save.scrap || 0}</span>
          <span>{save.xp} XP</span>
          {save.ngplus && <span className="mm-ng">NG+</span>}
        </footer>
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

export { MainMenu, TapeoutBay, DrillScreen };

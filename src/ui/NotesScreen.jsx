import { useEffect, useMemo, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { conceptMastery, masteryLevel } from '../game/recall.js';
import { LESSON_DEPTH, LESSONS, TOPIC_LIST, WORLDS } from '../game/content.js';
import { noteMeta } from '../game/codex.js';
import { NoteTerminal } from './codex/NoteTerminal.jsx';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { BookMark, ChipMark, LockMark } from './components/icons.jsx';

/** Demo wafer for `?screen=notes` stills — a few recovered terminals + live mastery. */
const NOTES_DEMO_SAVE = {
  lessons: { L1a: true, L1b: true, L2a: true, L3a: true, L5a: true },
  noteRecall: {
    L1a: { attempts: 2, correct: 1, streak: 1 },
    L1b: { attempts: 3, correct: 3, streak: 3 },
    L2a: { attempts: 1, correct: 1, streak: 1 },
    L3a: { attempts: 4, correct: 2, streak: 0 },
    L5a: { attempts: 2, correct: 2, streak: 2 },
  },
  skill: {
    numbers: { seen: 4, streak: 3, interval: 6, ease: 2.4, dueDay: 0, lastDay: 0, lastQ: 1, lapses: 0 },
    gates: { seen: 2, streak: 2, interval: 3, ease: 2.2, dueDay: 0, lastDay: 0, lastQ: 1, lapses: 0 },
    wiring: { seen: 3, streak: 1, interval: 1, ease: 2.0, dueDay: 0, lastDay: 0, lastQ: 0.5, lapses: 1 },
    seq: { seen: 2, streak: 2, interval: 3, ease: 2.3, dueDay: 0, lastDay: 0, lastQ: 1, lapses: 0 },
  },
};

function flattenNotes() {
  return Object.entries(LESSONS).flatMap(([worldId, lessons]) => {
    const world = WORLDS.find(item => item.id === Number(worldId));
    return lessons.map(lesson => ({ ...lesson, world }));
  });
}

function MasteryDie({ save }) {
  const notes = Object.values(LESSONS).flat();
  return (
    <div className="ns-die" aria-label="mastery die">
      <div className="ns-die__label">mastery die · live proficiency</div>
      <div className="ns-die__faces">
        {TOPIC_LIST.map((topic) => {
          const record = save.skill?.[topic.id];
          const level = masteryLevel(record);
          const score = conceptMastery(record);
          const recallNotes = notes.filter((lesson) => noteMeta(lesson.id).topic === topic.id);
          const attempts = recallNotes.reduce((sum, lesson) =>
            sum + (save.noteRecall?.[lesson.id]?.attempts || 0), 0);
          return (
            <div
              key={topic.id}
              className="ns-face"
              data-level={level}
              style={{ '--ns-fill': `${Math.round(score * 100)}%` }}
            >
              <div className="ns-face__name">{topic.label}</div>
              <div className="ns-face__bar" aria-hidden="true">
                <div className="ns-face__fill" />
              </div>
              <div className="ns-face__meta">
                {Math.round(score * 100)}% · {attempts} recall attempts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotesScreen({ save, go, onRecall = () => {} }) {
  const [stage, setStage] = useState('boot');
  const notes = useMemo(() => flattenNotes(), []);
  const collected = notes.filter(note => save.lessons?.[note.id]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(() => collected[0]?.id || null);

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { /* optional */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  // Prefer a recovered cartridge when the save gains new lessons.
  useEffect(() => {
    if (!selectedId || !save.lessons?.[selectedId]) {
      const first = notes.find(n => save.lessons?.[n.id]);
      if (first) setSelectedId(first.id);
    }
  }, [save.lessons, notes, selectedId]);

  const filtered = notes.filter(note =>
    `${note.title} ${note.world.name} ${note.world.tag}`.toLowerCase().includes(query.toLowerCase()));
  const selected = notes.find(note => note.id === selectedId);

  return (
    <div className="sg-ui ns-root" data-notes-status={stage}>
      <style>{TOKEN_CSS}</style>
      <style>{`
        .ns-root{
          position:fixed;inset:0;z-index:40;overflow:auto;
          padding:clamp(16px,2.4vh,32px) clamp(16px,3vw,48px) 28px;
        }
        .ns-shell{
          position:relative;z-index:1;
          max-width:min(1480px,100%);margin:0 auto;
          min-height:calc(100vh - 48px);
          display:grid;
          grid-template-rows:auto auto 1fr auto;
          gap:clamp(10px,1.4vh,16px);
        }
        .ns-grid{
          display:grid;
          grid-template-columns:minmax(260px,0.72fr) minmax(0,1.7fr);
          gap:var(--sg-space-4);
          align-items:stretch;
          min-height:0;
        }
        .ns-die-panel .sg-panel__body{ padding-top:4px; }
        .ns-rack-panel,
        .ns-reader-panel{ display:flex;flex-direction:column;min-height:0; }
        .ns-rack-panel .sg-panel__body,
        .ns-reader-panel .sg-panel__body{
          flex:1;display:flex;flex-direction:column;min-height:0;gap:12px;
        }
        .ns-kicker{
          font-family:var(--sg-font-mono);font-size:11px;letter-spacing:.18em;
          color:var(--sg-cyan);text-transform:uppercase;
        }
        .ns-count{
          font-family:var(--sg-font-mono);font-size:12px;color:var(--sg-ink-dim);
        }
        .ns-count strong{ color:var(--sg-brass);font-weight:600; }
        .ns-search{
          display:flex;align-items:center;gap:8px;
          padding:9px 11px;
          border:1px solid color-mix(in srgb, var(--sg-brass) 28%, var(--sg-line));
          background:color-mix(in srgb, var(--sg-bg-elevated) 90%, transparent);
        }
        .ns-search input{
          flex:1;border:0;outline:0;background:transparent;
          color:var(--sg-ink);font:inherit;font-size:12.5px;
        }
        .ns-search input::placeholder{ color:var(--sg-ink-dim); }
        .ns-carts{
          display:flex;flex-direction:column;gap:6px;
          overflow:auto;min-height:0;flex:1;
          padding-right:2px;
        }
        .ns-cart{
          --ns-accent: var(--sg-cyan);
          width:100%;padding:10px 11px;text-align:left;font:inherit;cursor:pointer;
          border:1px solid color-mix(in srgb, var(--ns-accent) 28%, var(--sg-line));
          background:
            linear-gradient(120deg,
              color-mix(in srgb, var(--ns-accent) 12%, var(--sg-bg-elevated)) 0%,
              var(--sg-bg-elevated) 55%);
          color:var(--sg-ink);
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--ns-accent) 14%, transparent);
          transition:
            border-color var(--sg-motion-fast) var(--sg-ease),
            box-shadow var(--sg-motion-med) var(--sg-ease);
        }
        .ns-cart:hover:not(:disabled){
          border-color:color-mix(in srgb, var(--ns-accent) 70%, var(--sg-brass));
          box-shadow:0 0 22px color-mix(in srgb, var(--ns-accent) 16%, transparent);
        }
        .ns-cart:focus-visible{ outline:2px solid var(--sg-focus); outline-offset:2px; }
        .ns-cart[data-sel="1"]{
          border-color:color-mix(in srgb, var(--ns-accent) 85%, var(--sg-brass));
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--ns-accent) 30%, transparent),
            0 0 28px color-mix(in srgb, var(--ns-accent) 18%, transparent);
        }
        .ns-cart:disabled{
          cursor:not-allowed;opacity:.7;
          filter:saturate(.4) brightness(.9);
          color:var(--sg-ink-dim);
        }
        .ns-cart__row{
          display:flex;align-items:center;justify-content:space-between;gap:8px;
        }
        .ns-cart__title{
          font-family:var(--sg-font-display);font-weight:600;font-size:14px;
          letter-spacing:.04em;line-height:1.2;
        }
        .ns-cart__meta{
          margin-top:3px;font-size:10.5px;color:var(--sg-ink-dim);letter-spacing:.03em;
        }
        .ns-holo{
          position:relative;flex:1;min-height:min(64vh,760px);
          border:1px solid color-mix(in srgb, var(--sg-cyan) 36%, var(--sg-line-strong));
          background:
            radial-gradient(120% 80% at 50% 0%,
              color-mix(in srgb, var(--sg-cyan-deep) 16%, transparent) 0%,
              transparent 55%),
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-bg-elevated) 92%, var(--sg-cyan-deep)) 0%,
              var(--sg-bg-deep) 100%);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--sg-cyan) 14%, transparent),
            inset 0 0 70px color-mix(in srgb, var(--sg-bg) 50%, transparent);
          padding:14px;
          overflow:auto;
        }
        .ns-holo::before{
          content:"";position:absolute;inset:8px;pointer-events:none;z-index:0;
          border:1px solid color-mix(in srgb, var(--sg-brass) 32%, transparent);
        }
        .ns-holo::after{
          content:"HOLO · ARCHIVE";position:absolute;top:14px;right:18px;z-index:2;
          font-family:var(--sg-font-mono);font-size:10px;letter-spacing:.18em;
          color:color-mix(in srgb, var(--sg-brass) 72%, transparent);pointer-events:none;
        }
        .ns-holo__body{ position:relative;z-index:1; }
        .ns-idle{
          min-height:280px;display:grid;place-items:center;text-align:center;
          color:var(--sg-ink-dim);font-size:13.5px;padding:32px 20px;gap:10px;
        }
        .ns-idle strong{ color:var(--sg-brass);font-weight:600; }
        /* Restyle legacy NoteTerminal chrome to match the archive bay. */
        .ns-holo .card{
          background:transparent !important;
          border:1px solid color-mix(in srgb, var(--sg-cyan) 22%, var(--sg-line)) !important;
          border-radius:var(--sg-radius-md) !important;
          box-shadow:none !important;
        }
        .ns-holo .eyebrow{
          font-family:var(--sg-font-mono);letter-spacing:.14em;text-transform:uppercase;
          font-size:10.5px;color:var(--sg-cyan) !important;
        }
        .ns-holo h2{
          font-family:var(--sg-font-display) !important;
          color:var(--sg-ink) !important;letter-spacing:.03em;
        }
        .ns-holo .btn{
          font-family:var(--sg-font-mono);
          border-radius:var(--sg-radius-sm);
          border:1px solid color-mix(in srgb, var(--sg-brass) 40%, var(--sg-line));
          background:linear-gradient(180deg, var(--sg-brass-top), var(--sg-brass-bottom));
          color:var(--sg-brass);
        }
        .ns-holo .btn.primary{
          background:linear-gradient(180deg,
            color-mix(in srgb, var(--sg-cyan) 28%, var(--sg-bg-panel)),
            var(--sg-cyan-bottom));
          border-color:var(--sg-cyan-line);
          color:var(--sg-cyan);
        }
        .ns-holo .lnk{ color:var(--sg-cyan); }
        .ns-holo .codeblock,
        .ns-holo pre.codeblock{
          background:var(--sg-bg-deep) !important;
          border:1px solid var(--sg-line) !important;
          border-radius:var(--sg-radius-sm) !important;
          color:var(--sg-ink) !important;
        }
        .ns-holo .codex-choice{
          background:var(--sg-bg-elevated) !important;
          border-color:var(--sg-line) !important;
          border-radius:var(--sg-radius-sm) !important;
          color:var(--sg-ink) !important;
        }
        .ns-holo .codex-choice:hover:not(:disabled){
          border-color:var(--sg-cyan) !important;
        }
        .ns-die{
          padding:0;
        }
        .ns-die__label{
          font-family:var(--sg-font-mono);font-size:10.5px;letter-spacing:.16em;
          text-transform:uppercase;color:var(--sg-cyan);margin-bottom:8px;
        }
        .ns-die__faces{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(118px,1fr));
          gap:6px;
        }
        .ns-face{
          min-height:58px;padding:7px 8px;
          border:1px solid color-mix(in srgb, var(--sg-line) 90%, var(--sg-cyan));
          background:
            linear-gradient(0deg,
              color-mix(in srgb, var(--sg-cyan-deep) 10%, transparent),
              var(--sg-bg-elevated));
        }
        .ns-face[data-level="1"]{
          border-color:color-mix(in srgb, var(--sg-brass) 45%, var(--sg-line));
        }
        .ns-face[data-level="2"]{
          border-color:color-mix(in srgb, var(--sg-cyan) 55%, var(--sg-line));
          box-shadow:0 0 16px color-mix(in srgb, var(--sg-cyan) 12%, transparent);
        }
        .ns-face[data-level="3"]{
          border-color:color-mix(in srgb, var(--sg-ok) 55%, var(--sg-line));
          box-shadow:0 0 18px color-mix(in srgb, var(--sg-ok) 16%, transparent);
        }
        .ns-face__name{ font-size:11px;color:var(--sg-ink); line-height:1.2; }
        .ns-face__bar{
          height:3px;margin:6px 0 4px;
          background:color-mix(in srgb, var(--sg-line) 85%, transparent);
        }
        .ns-face__fill{
          height:100%;width:var(--ns-fill,0%);
          background:linear-gradient(90deg, var(--sg-cyan-deep), var(--sg-brass));
        }
        .ns-face[data-level="3"] .ns-face__fill{
          background:linear-gradient(90deg, var(--sg-ok), var(--sg-cyan));
        }
        .ns-face__meta{ font-size:10.5px;color:var(--sg-ink-dim); }
        .ns-floor{
          position:fixed;left:-18%;right:-18%;bottom:-10%;height:40%;
          background-image:
            linear-gradient(color-mix(in srgb, var(--sg-cyan) 10%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-brass) 9%, transparent) 1px, transparent 1px);
          background-size:40px 40px;
          transform:perspective(480px) rotateX(58deg);
          transform-origin:50% 100%;
          -webkit-mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          pointer-events:none;z-index:0;
          animation:ns-sweep 9s linear infinite;
        }
        @keyframes ns-sweep{from{background-position:0 0}to{background-position:40px 0}}
        @media (max-width:960px){
          .ns-grid{ grid-template-columns:1fr; }
          .ns-holo{ min-height:420px; }
          .ns-carts{ max-height:280px; }
        }
        @media (prefers-reduced-motion:reduce){
          .ns-floor{ animation:none; transform:none; opacity:.35; }
          .ns-cart{ transition:none; }
        }
      `}</style>

      <div className="ns-floor" aria-hidden="true" />

      <div className="ns-shell">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              fab dojo-n4 · field notes archive
            </div>
            <h1
              className="sg-display"
              style={{
                margin: '8px 0 6px',
                fontSize: 'clamp(38px, 6vw, 64px)',
                color: 'var(--sg-ink)',
                lineHeight: 1,
                textShadow: '0 0 28px color-mix(in srgb, var(--sg-cyan) 24%, transparent)',
              }}
            >
              CODEX<span style={{ color: 'var(--sg-cyan)' }}>_</span>
            </h1>
            <p style={{ margin: 0, maxWidth: 600, color: 'var(--sg-ink-muted)', fontSize: 13.5 }}>
              Recovered holographic terminals and the mastery die — recall feeds spaced review.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'debugbay' }); }}>
              debug bay
            </Button>
          </div>
        </header>

        <Panel title="Mastery die" wide className="ns-die-panel" tight>
          <MasteryDie save={save} />
        </Panel>

        <div className="ns-grid">
          <Panel title="Terminal rack" className="ns-rack-panel" tight>
            <div className="ns-kicker">cartridges</div>
            <div className="ns-count">
              <strong>{collected.length}</strong>/{notes.length} terminals recovered
            </div>
            <label className="ns-search">
              <BookMark size={14} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="search topics, worlds…"
                aria-label="search recovered notes"
              />
            </label>
            <div className="ns-carts" role="list" aria-label="field note cartridges">
              {filtered.map(note => {
                const isCollected = !!save.lessons?.[note.id];
                const record = save.noteRecall?.[note.id];
                const recallLabel = record
                  ? `${record.correct}/${record.attempts} recall`
                  : isCollected ? 'collected' : 'locked';
                return (
                  <button
                    key={note.id}
                    type="button"
                    role="listitem"
                    className="ns-cart"
                    disabled={!isCollected}
                    data-sel={selectedId === note.id ? '1' : '0'}
                    data-collected={isCollected ? '1' : '0'}
                    style={{ '--ns-accent': note.world.color }}
                    aria-pressed={selectedId === note.id}
                    onClick={() => { setSelectedId(note.id); AudioFX.click(); }}
                  >
                    <div className="ns-cart__row">
                      <span className="ns-cart__title">
                        {isCollected ? note.title : 'UNRECOVERED NOTE'}
                      </span>
                      {isCollected ? <ChipMark size={13} /> : <LockMark size={13} />}
                    </div>
                    <div className="ns-cart__meta">
                      {note.world.name} · {recallLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Holo reader" wide className="ns-reader-panel">
            <div className="ns-holo" aria-label="holographic note reader">
              <div className="ns-holo__body">
                {selected && save.lessons?.[selected.id] ? (
                  <NoteTerminal
                    lesson={selected}
                    depth={LESSON_DEPTH[selected.id]}
                    worldLabel={selected.world.name}
                    accent={selected.world.color}
                    collected
                    recallRecord={save.noteRecall?.[selected.id]}
                    onRecall={correct => onRecall(selected.id, correct)}
                  />
                ) : (
                  <div className="ns-idle">
                    <BookMark size={28} />
                    <div>
                      Recover a field-note terminal in the world to archive it here.
                    </div>
                    <div>
                      Walk a district · decrypt the holo · pass <strong>recall</strong> for XP.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <footer
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--sg-ink-dim)',
            fontSize: 11.5,
            fontFamily: 'var(--sg-font-mono)',
          }}
        >
          <span>ARCHIVE · HOLO · MASTERY DIE · RECALL</span>
          <span style={{ color: 'var(--sg-brass)' }}>
            {selected && save.lessons?.[selected.id] ? `READING · ${selected.id}` : 'STANDBY'}
          </span>
        </footer>
      </div>
    </div>
  );
}

export {
  NotesScreen,
  MasteryDie,
  MasteryDie as MasteryMap,
  NOTES_DEMO_SAVE,
  flattenNotes,
};

import { useEffect, useMemo, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { WORLDS } from '../game/content.js';
import { DUNGEON_CFG } from '../world/dungeon-config.js';
import {
  activeDone, challengesOf, worldDone, worldUnlockedEx,
} from '../world/challenges.js';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { ChipMark, LockMark, PlayMark } from './components/icons.jsx';

/** Die-block geometry: irregular floorplan pads, not a uniform card grid. */
const DIE_PADS = [
  { id: 1, area: 'mines', short: 'MINES' },
  { id: 2, area: 'valley', short: 'VALLEY' },
  { id: 3, area: 'foundry', short: 'FOUNDRY' },
  { id: 4, area: 'canyon', short: 'CANYON' },
  { id: 5, area: 'clock', short: 'CLOCK' },
  { id: 6, area: 'fortress', short: 'KEEP' },
  { id: 7, area: 'tapeout', short: 'TAPEOUT' },
];

function enterTarget(w) {
  if (w === 1) return { name: 'mine' };
  return { name: 'dungeon', w };
}

function descendCopy(w) {
  if (w === 1) {
    return {
      label: 'DESCEND INTO THE MINES',
      sub: 'Walk the shaft. Fight the galleries. The wyrm sleeps at the bottom.',
    };
  }
  return DUNGEON_CFG[w]?.descend || { label: 'ENTER DISTRICT', sub: '' };
}

function WorldSelectScreen({ save, go }) {
  const [stage, setStage] = useState('boot');
  const [focusId, setFocusId] = useState(1);

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { /* audio optional */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  const pads = useMemo(() => {
    const doneMap = activeDone(save);
    return DIE_PADS.map(pad => {
      const world = WORLDS.find(w => w.id === pad.id);
      const chs = challengesOf(pad.id);
      const cleared = chs.filter(c => doneMap[c.id]).length;
      const unlocked = worldUnlockedEx(pad.id, save);
      const complete = worldDone(pad.id, save);
      return {
        ...pad,
        world,
        cleared,
        total: chs.length,
        unlocked,
        complete,
      };
    });
  }, [save]);

  const focus = pads.find(p => p.id === focusId) || pads[0];
  const descend = descendCopy(focus.id);

  const enter = () => {
    if (!focus.unlocked) return;
    AudioFX.click();
    go(enterTarget(focus.id));
  };

  return (
    <div className="sg-ui ws-root" data-worldselect-status={stage}>
      <style>{TOKEN_CSS}</style>
      <style>{`
        .ws-root{
          position:fixed;inset:0;z-index:40;overflow:auto;
          padding:clamp(16px,2.4vh,32px) clamp(16px,3vw,48px) 28px;
        }
        .ws-shell{
          position:relative;z-index:1;
          max-width:1280px;margin:0 auto;
          min-height:calc(100vh - 48px);
          display:grid;
          grid-template-rows:auto 1fr auto;
          gap:clamp(12px,1.8vh,20px);
        }
        .ws-grid{
          display:grid;
          grid-template-columns:minmax(0,1.55fr) minmax(280px,0.85fr);
          gap:var(--sg-space-4);
          align-items:stretch;
          min-height:0;
        }
        .ws-die-panel{
          display:flex;flex-direction:column;min-height:0;
        }
        .ws-die-panel .sg-panel__body{
          flex:1;display:flex;flex-direction:column;min-height:0;gap:12px;
        }
        .ws-scribe{
          position:relative;flex:1;min-height:min(64vh,720px);
          border:1px solid color-mix(in srgb, var(--sg-brass) 28%, var(--sg-line-strong));
          background:
            repeating-linear-gradient(90deg,
              color-mix(in srgb, var(--sg-cyan-deep) 7%, transparent) 0 1px,
              transparent 1px 18px),
            repeating-linear-gradient(0deg,
              color-mix(in srgb, var(--sg-brass) 6%, transparent) 0 1px,
              transparent 1px 18px),
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-bg-deep) 88%, var(--sg-cyan-deep)) 0%,
              var(--sg-bg-deep) 48%,
              color-mix(in srgb, var(--sg-bg-deep) 86%, var(--sg-brass-deep)) 100%);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--sg-brass) 16%, transparent),
            inset 0 0 90px color-mix(in srgb, var(--sg-bg) 50%, transparent);
          padding:18px;
          overflow:hidden;
        }
        .ws-scribe::before{
          content:"";position:absolute;inset:10px;pointer-events:none;
          border:1px dashed color-mix(in srgb, var(--sg-cyan) 28%, transparent);
        }
        .ws-scribe::after{
          content:"WAFER · N4";position:absolute;top:14px;right:18px;z-index:2;
          font-family:var(--sg-font-mono);font-size:10px;letter-spacing:.18em;
          color:color-mix(in srgb, var(--sg-brass) 70%, transparent);pointer-events:none;
        }
        .ws-bond{
          position:absolute;pointer-events:none;z-index:2;
          background:linear-gradient(90deg,
            color-mix(in srgb, var(--sg-brass) 25%, transparent),
            color-mix(in srgb, var(--sg-brass) 78%, transparent),
            color-mix(in srgb, var(--sg-brass) 25%, transparent));
          box-shadow:0 0 10px color-mix(in srgb, var(--sg-brass) 22%, transparent);
        }
        .ws-bond--n{top:0;left:14%;right:14%;height:5px}
        .ws-bond--s{bottom:0;left:14%;right:14%;height:5px}
        .ws-bond--w{
          left:0;top:18%;bottom:18%;width:5px;
          background:linear-gradient(180deg,
            color-mix(in srgb, var(--sg-brass) 25%, transparent),
            color-mix(in srgb, var(--sg-brass) 78%, transparent),
            color-mix(in srgb, var(--sg-brass) 25%, transparent));
        }
        .ws-bond--e{
          right:0;top:18%;bottom:18%;width:5px;
          background:linear-gradient(180deg,
            color-mix(in srgb, var(--sg-brass) 25%, transparent),
            color-mix(in srgb, var(--sg-brass) 78%, transparent),
            color-mix(in srgb, var(--sg-brass) 25%, transparent));
        }
        .ws-die{
          position:relative;z-index:1;height:100%;min-height:360px;
          display:grid;
          grid-template-columns:1.05fr 1.1fr 0.95fr;
          grid-template-rows:1.05fr 1fr 0.92fr;
          grid-template-areas:
            "mines valley foundry"
            "canyon clock foundry"
            "canyon tapeout fortress";
          gap:9px;
        }
        .ws-pad{
          --ws-accent: var(--sg-cyan);
          position:relative;
          display:flex;flex-direction:column;justify-content:space-between;
          align-items:flex-start;
          padding:12px 13px;
          border:1px solid color-mix(in srgb, var(--ws-accent) 34%, var(--sg-line));
          background:
            linear-gradient(165deg,
              color-mix(in srgb, var(--ws-accent) 16%, var(--sg-bg-elevated)) 0%,
              color-mix(in srgb, var(--sg-bg-panel) 92%, transparent) 55%,
              var(--sg-bg-elevated) 100%);
          color:var(--sg-ink);
          font:inherit;text-align:left;cursor:pointer;
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--ws-accent) 18%, transparent);
          transition:
            border-color var(--sg-motion-fast) var(--sg-ease),
            box-shadow var(--sg-motion-med) var(--sg-ease),
            transform 70ms linear;
          min-height:0;
        }
        .ws-pad:hover:not(:disabled){
          border-color:color-mix(in srgb, var(--ws-accent) 70%, var(--sg-brass));
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--ws-accent) 28%, transparent),
            0 0 28px color-mix(in srgb, var(--ws-accent) 18%, transparent);
        }
        .ws-pad:focus-visible{
          outline:2px solid var(--sg-focus);
          outline-offset:2px;
        }
        .ws-pad:active:not(:disabled){ transform:translateY(1px); }
        .ws-pad[data-focus="1"]{
          border-color:color-mix(in srgb, var(--ws-accent) 85%, var(--sg-brass));
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--ws-accent) 35%, transparent),
            0 0 34px color-mix(in srgb, var(--ws-accent) 22%, transparent);
        }
        .ws-pad:disabled{
          cursor:not-allowed;opacity:.72;
          filter:saturate(.45) brightness(.88);
        }
        .ws-pad:disabled .ws-pad__short{ color:var(--sg-ink-muted); }
        .ws-pad:disabled .ws-pad__tag{ color:var(--sg-ink-dim); }
        .ws-pad[data-area="mines"]{ grid-area:mines; }
        .ws-pad[data-area="valley"]{ grid-area:valley; }
        .ws-pad[data-area="foundry"]{ grid-area:foundry; }
        .ws-pad[data-area="canyon"]{ grid-area:canyon; }
        .ws-pad[data-area="clock"]{ grid-area:clock; }
        .ws-pad[data-area="fortress"]{ grid-area:fortress; }
        .ws-pad[data-area="tapeout"]{ grid-area:tapeout; }
        .ws-pad__meta{
          display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;
        }
        .ws-pad__id{
          font-family:var(--sg-font-mono);font-size:11px;letter-spacing:.16em;
          color:color-mix(in srgb, var(--ws-accent) 80%, var(--sg-ink));
        }
        .ws-pad__short{
          font-family:var(--sg-font-display);font-weight:700;font-size:clamp(16px,1.85vw,22px);
          letter-spacing:.07em;color:var(--sg-ink);line-height:1.1;
          text-shadow:0 0 18px color-mix(in srgb, var(--ws-accent) 22%, transparent);
        }
        .ws-pad__tag{
          font-size:10.5px;color:var(--sg-ink-dim);letter-spacing:.04em;
          max-width:100%;
        }
        .ws-pad__bar{
          margin-top:10px;width:100%;height:3px;
          background:color-mix(in srgb, var(--sg-line) 80%, transparent);
        }
        .ws-pad__fill{
          height:100%;width:var(--ws-progress,0%);
          background:linear-gradient(90deg, var(--ws-accent), color-mix(in srgb, var(--ws-accent) 40%, var(--sg-brass)));
        }
        .ws-inspect .sg-panel__body{ display:flex;flex-direction:column;gap:14px; }
        .ws-kicker{
          font-family:var(--sg-font-mono);font-size:11px;letter-spacing:.18em;
          color:var(--sg-cyan);text-transform:uppercase;
        }
        .ws-title{
          margin:0;font-family:var(--sg-font-display);font-size:clamp(26px,3.2vw,36px);
          font-weight:700;letter-spacing:.04em;color:var(--sg-ink);line-height:1.05;
        }
        .ws-desc{ margin:0;color:var(--sg-ink-muted);font-size:13.5px;line-height:1.55; }
        .ws-stat{
          display:flex;flex-wrap:wrap;gap:10px 16px;
          font-family:var(--sg-font-mono);font-size:11.5px;color:var(--sg-ink-dim);
        }
        .ws-stat strong{ color:var(--sg-brass);font-weight:600; }
        .ws-actions{ display:flex;flex-direction:column;gap:8px;margin-top:auto; }
        .ws-floor{
          position:fixed;left:-18%;right:-18%;bottom:-10%;height:44%;
          background-image:
            linear-gradient(color-mix(in srgb, var(--sg-brass) 11%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-cyan) 9%, transparent) 1px, transparent 1px);
          background-size:44px 44px;
          transform:perspective(480px) rotateX(60deg);
          transform-origin:50% 100%;
          -webkit-mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          mask-image:linear-gradient(to top,#000 8%,transparent 78%);
          pointer-events:none;z-index:0;
          animation:ws-pan 8s linear infinite;
        }
        @keyframes ws-pan{from{background-position:0 0}to{background-position:0 44px}}
        @media (max-width:900px){
          .ws-grid{ grid-template-columns:1fr; }
          .ws-scribe{ min-height:420px; }
        }
        @media (max-width:560px){
          .ws-die{
            grid-template-columns:1fr 1fr;
            grid-template-rows:repeat(4,minmax(88px,1fr));
            grid-template-areas:
              "mines valley"
              "foundry canyon"
              "clock fortress"
              "tapeout tapeout";
          }
        }
        @media (prefers-reduced-motion:reduce){
          .ws-floor{ animation:none; transform:none; opacity:.35; }
          .ws-pad{ transition:none; }
        }
      `}</style>

      <div className="ws-floor" aria-hidden="true" />

      <div className="ws-shell">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              fab dojo-n4 · die floorplan
            </div>
            <h1
              className="sg-display"
              style={{
                margin: '8px 0 6px',
                fontSize: 'clamp(38px, 6vw, 64px)',
                color: 'var(--sg-ink)',
                lineHeight: 1,
                textShadow: '0 0 28px color-mix(in srgb, var(--sg-brass) 28%, transparent)',
              }}
            >
              WORLD SELECT<span style={{ color: 'var(--sg-cyan)' }}>_</span>
            </h1>
            <p style={{ margin: 0, maxWidth: 560, color: 'var(--sg-ink-muted)', fontSize: 13.5 }}>
              Seven districts on one wafer. Pick a pad, read the netlist, walk the trail.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'campus' }); }}>
              fab campus
            </Button>
          </div>
        </header>

        <div className="ws-grid">
          <Panel title="Die floorplan" wide className="ws-die-panel">
            <div className="ws-scribe" aria-label="world die floorplan">
              <span className="ws-bond ws-bond--n" />
              <span className="ws-bond ws-bond--s" />
              <span className="ws-bond ws-bond--w" />
              <span className="ws-bond ws-bond--e" />
              <div className="ws-die" role="list">
                {pads.map(pad => {
                  const progress = pad.total ? Math.round((pad.cleared / pad.total) * 100) : 0;
                  return (
                    <button
                      key={pad.id}
                      type="button"
                      role="listitem"
                      className="ws-pad"
                      data-area={pad.area}
                      data-focus={pad.id === focusId ? '1' : '0'}
                      data-unlocked={pad.unlocked ? '1' : '0'}
                      disabled={!pad.unlocked}
                      style={{
                        '--ws-accent': pad.world.color,
                        '--ws-progress': `${progress}%`,
                      }}
                      aria-pressed={pad.id === focusId}
                      aria-label={`${pad.world.name}${pad.unlocked ? '' : ' sealed'}`}
                      onClick={() => {
                        AudioFX.click();
                        setFocusId(pad.id);
                      }}
                    >
                      <div className="ws-pad__meta">
                        <span className="ws-pad__id">W{String(pad.id).padStart(2, '0')}</span>
                        {!pad.unlocked ? <LockMark size={14} /> : pad.complete ? <ChipMark size={14} /> : null}
                      </div>
                      <div>
                        <div className="ws-pad__short">{pad.short}</div>
                        <div className="ws-pad__tag">{pad.world.tag}</div>
                        <div className="ws-pad__bar" aria-hidden="true">
                          <div className="ws-pad__fill" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel title="Pad inspector" className="ws-inspect" tight>
            <div className="ws-kicker">
              {focus.unlocked ? (focus.complete ? 'district clear' : 'district live') : 'sealed'}
            </div>
            <h2 className="ws-title" style={{ color: 'var(--sg-ink)' }}>
              <span style={{ color: focus.world.color }}>{focus.world.name}</span>
            </h2>
            <p className="ws-desc">{focus.world.desc}</p>
            <div className="ws-stat">
              <span>tag · <strong style={{ color: focus.world.color }}>{focus.world.tag}</strong></span>
              <span>stations · <strong>{focus.cleared}/{focus.total}</strong></span>
              <span>{focus.unlocked ? 'uplink ready' : 'clear prior district'}</span>
            </div>
            <p className="ws-desc" style={{ color: 'var(--sg-ink-dim)', fontSize: 12.5 }}>
              {focus.unlocked ? descend.sub : 'SEALED — clear the previous district before this pad opens.'}
            </p>
            <div className="ws-actions">
              <Button
                variant="brass"
                disabled={!focus.unlocked}
                icon={<PlayMark size={15} />}
                onClick={enter}
              >
                {focus.unlocked ? descend.label : 'PAD SEALED'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!focus.unlocked}
                onClick={() => {
                  if (!focus.unlocked) return;
                  AudioFX.click();
                  go({ name: 'world', w: focus.id });
                }}
              >
                open console index
              </Button>
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
          <span>SCRIBE · SEVEN PADS · ONE WAFER</span>
          <span style={{ color: 'var(--sg-brass)' }}>
            {pads.filter(p => p.complete).length}/7 districts clear
          </span>
        </footer>
      </div>
    </div>
  );
}

export { WorldSelectScreen, DIE_PADS, enterTarget };

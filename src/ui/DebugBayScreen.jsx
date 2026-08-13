import { useEffect, useMemo, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { firstDivergence } from '../engine/debug/diagnostics.js';
import { runChallengeTest, vCompile } from '../engine/verilog.js';
import {
  DEBUG_IFACE, DEBUG_SOURCE, DEBUG_TEST,
} from './PrologueScreen.jsx';
import { SchematicView } from './challenges.jsx';
import { Waveform } from './foundations.jsx';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { PlayMark, ScopeMark } from './components/icons.jsx';

/** Channel legend for the deliberate prologue DFF fault. */
const CHANNELS = [
  { id: 'clk', label: 'CLK', role: 'timebase', hint: 'posedge drive' },
  { id: 'rst', label: 'RST', role: 'probe', hint: 'async clear' },
  { id: 'd', label: 'D', role: 'probe', hint: 'data in' },
  { id: 'q', label: 'Q', role: 'dut', hint: 'you vs ref' },
];

const WIDTHS = { rst: 1, d: 1, q: 1 };
const INPUT_NAMES = ['rst', 'd'];

function runDiagnostic() {
  const compiled = vCompile(DEBUG_SOURCE, DEBUG_IFACE);
  if (!compiled.ok) {
    return {
      ok: false,
      errors: compiled.errors,
      diagnosis: 'compile failed — bay cannot arm',
      result: null,
      mod: null,
    };
  }
  const result = runChallengeTest(compiled.mod, DEBUG_TEST);
  const diagnosis = firstDivergence(result, WIDTHS)
    || (result.pass ? 'trace clean — no divergence' : 'mismatch without a named cycle');
  return {
    ok: true,
    errors: null,
    diagnosis,
    result,
    mod: compiled.mod,
    pass: !!result.pass,
  };
}

function DebugBayScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [view, setView] = useState('scope'); // scope | netlist
  const [armed, setArmed] = useState(false);
  const [diag, setDiag] = useState(null);

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { /* optional */ }
  }, []);

  useEffect(() => {
    // Auto-arm so stills and smoke see a live CRT without a click.
    const next = runDiagnostic();
    setDiag(next);
    setArmed(true);
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  const channels = useMemo(() => CHANNELS, []);

  const arm = () => {
    AudioFX.click();
    const next = runDiagnostic();
    setDiag(next);
    setArmed(true);
    if (next.pass) AudioFX.win();
    else AudioFX.bad();
  };

  return (
    <div className="sg-ui db-root" data-debugbay-status={stage}>
      <style>{TOKEN_CSS}</style>
      <style>{`
        .db-root{
          position:fixed;inset:0;z-index:40;overflow:auto;
          padding:clamp(16px,2.4vh,32px) clamp(16px,3vw,48px) 28px;
        }
        .db-shell{
          position:relative;z-index:1;
          max-width:min(1480px,100%);margin:0 auto;
          min-height:calc(100vh - 48px);
          display:grid;
          grid-template-rows:auto 1fr auto;
          gap:clamp(12px,1.8vh,20px);
        }
        .db-grid{
          display:grid;
          grid-template-columns:minmax(0,1.7fr) minmax(300px,0.78fr);
          gap:var(--sg-space-4);
          align-items:stretch;
          min-height:0;
        }
        .db-scope-panel{ display:flex;flex-direction:column;min-height:0; }
        .db-scope-panel .sg-panel__body{
          flex:1;display:flex;flex-direction:column;min-height:0;gap:12px;
        }
        .db-chassis{
          position:relative;flex:1;min-height:min(64vh,720px);
          border:1px solid color-mix(in srgb, var(--sg-brass) 38%, var(--sg-line-strong));
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-bg-elevated) 92%, var(--sg-brass-deep)) 0%,
              var(--sg-bg-deep) 42%,
              color-mix(in srgb, var(--sg-bg-deep) 88%, var(--sg-cyan-deep)) 100%);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--sg-brass) 18%, transparent),
            inset 0 0 80px color-mix(in srgb, var(--sg-bg) 55%, transparent);
          padding:12px;
          overflow:hidden;
        }
        .db-bezel{
          position:absolute;inset:10px;pointer-events:none;z-index:2;
          border:1px solid color-mix(in srgb, var(--sg-brass) 40%, transparent);
          box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--sg-cyan) 10%, transparent);
        }
        .db-bezel::before,
        .db-bezel::after{
          content:"";position:absolute;width:22px;height:22px;
          border:1px solid color-mix(in srgb, var(--sg-brass) 70%, transparent);
        }
        .db-bezel::before{ top:-1px;left:-1px;border-right:none;border-bottom:none; }
        .db-bezel::after{ top:-1px;right:-1px;border-left:none;border-bottom:none; }
        .db-crt{
          position:relative;z-index:1;height:100%;min-height:420px;
          border:1px solid color-mix(in srgb, var(--sg-cyan) 34%, var(--sg-line));
          background:
            radial-gradient(120% 90% at 50% 40%,
              color-mix(in srgb, var(--sg-cyan-deep) 22%, transparent) 0%,
              transparent 62%),
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-bg-deep) 70%, #020406) 0%,
              var(--sg-bg-deep) 100%);
          box-shadow:inset 0 0 70px color-mix(in srgb, var(--sg-cyan-deep) 16%, transparent);
          overflow:hidden;
          padding:14px 12px 12px;
          display:flex;flex-direction:column;
        }
        .db-crt::before{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:3;opacity:.18;
          background:repeating-linear-gradient(
            180deg,
            transparent 0 2px,
            color-mix(in srgb, var(--sg-bg-deep) 55%, transparent) 2px 3px
          );
        }
        .db-crt::after{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:3;
          background:
            linear-gradient(color-mix(in srgb, var(--sg-cyan) 12%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-cyan) 12%, transparent) 1px, transparent 1px);
          background-size:32px 32px;
          -webkit-mask-image:radial-gradient(ellipse at 50% 45%, #000 40%, transparent 82%);
          mask-image:radial-gradient(ellipse at 50% 45%, #000 40%, transparent 82%);
          opacity:.42;
        }
        .db-crt__tag{
          position:absolute;top:10px;right:14px;z-index:4;
          font-family:var(--sg-font-mono);font-size:10px;letter-spacing:.18em;
          color:color-mix(in srgb, var(--sg-brass) 78%, transparent);
          pointer-events:none;
        }
        .db-crt__body{
          position:relative;z-index:2;flex:1;min-height:0;
          display:flex;align-items:center;justify-content:center;
          overflow:auto;
        }
        .db-crt[data-view="scope"] .db-crt__body .wavescroll{
          border:none;background:transparent;padding:6px 4px;border-radius:0;
          transform:scale(1.72);transform-origin:center center;
          filter:drop-shadow(0 0 10px color-mix(in srgb, var(--sg-cyan) 22%, transparent));
        }
        .db-crt[data-view="netlist"] .db-crt__body > div{
          transform:scale(1.38);transform-origin:center center;
          filter:drop-shadow(0 0 8px color-mix(in srgb, var(--sg-cyan) 16%, transparent));
        }
        .db-crt .wavescroll{
          border:none;background:transparent;padding:4px 2px;border-radius:0;
        }
        .db-idle{
          min-height:320px;display:grid;place-items:center;text-align:center;
          color:var(--sg-ink-dim);font-size:13px;padding:24px;
        }
        .db-idle strong{ color:var(--sg-brass);font-weight:600; }
        .db-rack .sg-panel__body{ display:flex;flex-direction:column;gap:12px; }
        .db-kicker{
          font-family:var(--sg-font-mono);font-size:11px;letter-spacing:.18em;
          color:var(--sg-cyan);text-transform:uppercase;
        }
        .db-title{
          margin:0;font-family:var(--sg-font-display);font-size:clamp(24px,3vw,34px);
          font-weight:700;letter-spacing:.04em;color:var(--sg-ink);line-height:1.05;
        }
        .db-desc{ margin:0;color:var(--sg-ink-muted);font-size:13.5px;line-height:1.55; }
        .db-channels{ display:grid;gap:6px; }
        .db-ch{
          display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;
          padding:8px 10px;
          border:1px solid color-mix(in srgb, var(--sg-line) 90%, var(--sg-cyan));
          background:color-mix(in srgb, var(--sg-bg-elevated) 88%, transparent);
          font-family:var(--sg-font-mono);font-size:11.5px;
        }
        .db-ch__id{
          letter-spacing:.14em;color:var(--sg-cyan);min-width:2.6em;
        }
        .db-ch__hint{ color:var(--sg-ink-dim); }
        .db-ch__role{ color:var(--sg-brass);letter-spacing:.08em;text-transform:uppercase;font-size:10px; }
        .db-readout{
          padding:12px 13px;
          border:1px solid color-mix(in srgb, var(--sg-danger) 58%, var(--sg-line));
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-danger-top) 88%, transparent),
              color-mix(in srgb, var(--sg-bg-panel) 92%, transparent));
          color:var(--sg-danger);
          font-family:var(--sg-font-mono);font-size:13px;line-height:1.45;
          box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--sg-danger) 18%, transparent);
        }
        .db-readout[data-ok="1"]{
          border-color:color-mix(in srgb, var(--sg-ok) 45%, var(--sg-line));
          color:var(--sg-ok);
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-cyan-top) 55%, transparent),
              color-mix(in srgb, var(--sg-bg-panel) 92%, transparent));
        }
        .db-readout__label{
          display:block;margin-bottom:4px;
          letter-spacing:.16em;font-size:10px;text-transform:uppercase;
          color:var(--sg-ink-dim);
        }
        .db-modes{ display:flex;flex-wrap:wrap;gap:8px; }
        .db-actions{ display:flex;flex-direction:column;gap:8px;margin-top:auto; }
        .db-floor{
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
          animation:db-sweep 9s linear infinite;
        }
        @keyframes db-sweep{from{background-position:0 0}to{background-position:40px 0}}
        .db-sweep-line{
          position:absolute;left:0;right:0;height:2px;top:18%;z-index:4;pointer-events:none;
          background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--sg-cyan) 55%, transparent), transparent);
          opacity:.55;
          animation:db-beam 2.8s var(--sg-ease) infinite;
        }
        @keyframes db-beam{
          0%{ top:12%; opacity:0 }
          15%{ opacity:.6 }
          85%{ opacity:.35 }
          100%{ top:78%; opacity:0 }
        }
        @media (max-width:900px){
          .db-grid{ grid-template-columns:1fr; }
          .db-chassis{ min-height:420px; }
        }
        @media (prefers-reduced-motion:reduce){
          .db-floor{ animation:none; transform:none; opacity:.35; }
          .db-sweep-line{ animation:none; opacity:.25; top:40%; }
        }
      `}</style>

      <div className="db-floor" aria-hidden="true" />

      <div className="db-shell">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              fab dojo-n4 · oscilloscope rack
            </div>
            <h1
              className="sg-display"
              style={{
                margin: '8px 0 6px',
                fontSize: 'clamp(38px, 6vw, 64px)',
                color: 'var(--sg-ink)',
                lineHeight: 1,
                textShadow: '0 0 28px color-mix(in srgb, var(--sg-cyan) 26%, transparent)',
              }}
            >
              DEBUG BAY<span style={{ color: 'var(--sg-cyan)' }}>_</span>
            </h1>
            <p style={{ margin: 0, maxWidth: 580, color: 'var(--sg-ink-muted)', fontSize: 13.5 }}>
              Waveforms, first divergence, and the gate netlist you actually described — as bench gear.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { AudioFX.click(); go({ name: 'workbench' }); }}>
              workbench
            </Button>
          </div>
        </header>

        <div className="db-grid">
          <Panel title="Scope face" wide className="db-scope-panel">
            <div className="db-chassis" aria-label="debug bay oscilloscope">
              <span className="db-bezel" aria-hidden="true" />
              <div className="db-crt" data-view={view}>
                <span className="db-crt__tag">
                  {view === 'scope' ? 'CRT · TIME / DIV' : 'NETLIST · GATES'}
                </span>
                {view === 'scope' && armed ? <span className="db-sweep-line" aria-hidden="true" /> : null}
                <div className="db-crt__body">
                  {!armed || !diag ? (
                    <div className="db-idle">
                      Arm the bay to capture <strong>tutorial_dff</strong> — injected fault on Q.
                    </div>
                  ) : view === 'scope' && diag.result ? (
                    <Waveform
                      trace={diag.result.trace}
                      watch={DEBUG_TEST.watch}
                      inputNames={INPUT_NAMES}
                      widths={WIDTHS}
                      accent="#7defff"
                    />
                  ) : view === 'netlist' && diag.mod ? (
                    <SchematicView mod={diag.mod} iface={DEBUG_IFACE} accent="#7defff" />
                  ) : (
                    <div className="db-idle">No capture — run diagnostic.</div>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Probe rack" className="db-rack" tight>
            <div className="db-kicker">
              {armed ? (diag?.pass ? 'trace clean' : 'divergence latched') : 'standby'}
            </div>
            <h2 className="db-title">
              <span style={{ color: 'var(--sg-cyan)' }}>tutorial_dff</span>
            </h2>
            <p className="db-desc">
              Deliberate sequential fault from the prologue — same vectors, same diagnosis path CodeScreen uses.
            </p>

            <div className="db-channels" role="list" aria-label="scope channels">
              {channels.map(ch => (
                <div key={ch.id} className="db-ch" role="listitem" data-ch={ch.id}>
                  <span className="db-ch__id">{ch.label}</span>
                  <span className="db-ch__hint">{ch.hint}</span>
                  <span className="db-ch__role">{ch.role}</span>
                </div>
              ))}
            </div>

            {diag?.diagnosis ? (
              <div className="db-readout" data-ok={diag.pass ? '1' : '0'} data-diagnosis="1">
                <span className="db-readout__label">first divergence</span>
                ◈ {diag.diagnosis}
              </div>
            ) : null}

            <div className="db-modes" role="group" aria-label="bay view">
              <Button
                variant={view === 'scope' ? 'primary' : 'default'}
                size="sm"
                aria-pressed={view === 'scope'}
                onClick={() => { AudioFX.click(); setView('scope'); }}
              >
                SCOPE
              </Button>
              <Button
                variant={view === 'netlist' ? 'primary' : 'default'}
                size="sm"
                aria-pressed={view === 'netlist'}
                disabled={!diag?.mod}
                onClick={() => { AudioFX.click(); setView('netlist'); }}
              >
                NETLIST
              </Button>
            </div>

            <div className="db-actions">
              <Button
                variant="brass"
                icon={<PlayMark size={15} />}
                onClick={arm}
              >
                RUN DIAGNOSTIC
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<ScopeMark size={14} />}
                onClick={() => {
                  AudioFX.click();
                  setView('scope');
                  arm();
                }}
              >
                re-arm CRT
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
          <span>BAY · WAVEFORM · SCHEMATIC · DIVERGENCE</span>
          <span style={{ color: 'var(--sg-brass)' }}>
            {armed ? (view === 'scope' ? 'CRT LIVE' : 'GATES LIVE') : 'STANDBY'}
          </span>
        </footer>
      </div>
    </div>
  );
}

export { DebugBayScreen, CHANNELS, runDiagnostic };

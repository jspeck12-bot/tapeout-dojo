import { useCallback, useEffect, useState } from 'react';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { PlayMark } from './components/icons.jsx';
import { DiffPane } from './workbench/DiffPane.jsx';
import { VerilogEditor } from './workbench/VerilogEditor.jsx';

const STARTER = `module and_gate (
  input  wire a,
  input  wire b,
  output wire y
);
  // TODO: drive y from a & b
  assign y = 1'b0;
endmodule
`;

const SOLUTION = `module and_gate (
  input  wire a,
  input  wire b,
  output wire y
);
  assign y = a & b;
endmodule
`;

function WorkbenchScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [code, setCode] = useState(STARTER);
  const [editorReady, setEditorReady] = useState(false);
  const [diffReady, setDiffReady] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [note, setNote] = useState('Ctrl/Cmd + Enter runs · Tab indents · start typing for Verilog completions');

  useEffect(() => {
    // Ready once both panes report (or timeout for headless fallback).
    if (editorReady && (!showDiff || diffReady)) {
      setStage('ready');
      return undefined;
    }
    const id = setTimeout(() => setStage('ready'), 80);
    return () => clearTimeout(id);
  }, [editorReady, diffReady, showDiff]);

  const onRun = useCallback(() => {
    const trimmed = code.trim();
    if (trimmed.includes('a & b') || trimmed.includes('a&&b')) {
      setNote('compile ok — assign y = a & b matches the reference');
    } else {
      setNote('stub still drives y = 1\'b0 — try assign y = a & b; (autocomplete helps)');
    }
  }, [code]);

  const reset = () => {
    setCode(STARTER);
    setNote('reset to starter — open completions with Ctrl+Space');
  };

  return (
    <div
      className="sg-ui"
      data-workbench-status={stage}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        overflow: 'auto',
        padding: 'clamp(16px, 2.4vh, 32px) clamp(16px, 3vw, 48px) 32px',
      }}
    >
      <style>{TOKEN_CSS}</style>
      <style>{`
        .sg-wb-shell{
          min-height:calc(100vh - 48px);
          display:grid;
          grid-template-rows:auto 1fr auto;
          gap:clamp(12px, 1.8vh, 20px);
        }
        .sg-wb-grid{
          display:grid;
          grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);
          gap:var(--sg-space-4);
          align-items:stretch;
          min-height:0;
        }
        .sg-wb-grid .sg-panel{
          display:flex;
          flex-direction:column;
          min-height:0;
        }
        .sg-wb-grid .sg-panel__body{
          flex:1;
          display:flex;
          flex-direction:column;
          min-height:0;
        }
        .sg-cm-host, .sg-cm-diff{
          flex:1;
          min-height:min(52vh, 560px);
        }
        .sg-wb-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:var(--sg-space-3)}
        .sg-wb-note{
          margin:0;
          font-size:12.5px;
          color:var(--sg-ink-dim);
          min-height:1.4em;
        }
        .sg-wb-kpis{
          display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;
        }
        .sg-wb-kpi{
          font-size:10px;letter-spacing:.14em;text-transform:uppercase;
          color:var(--sg-ink-muted);
          border:1px solid var(--sg-line);
          padding:4px 8px;border-radius:var(--sg-radius-sm);
        }
        .sg-wb-kpi strong{color:var(--sg-cyan);font-weight:600;margin-left:6px}
        @media (max-width:960px){
          .sg-wb-grid{grid-template-columns:1fr}
        }
        @media (prefers-reduced-motion:reduce){
          .sg-cm-host, .sg-cm-diff{scroll-behavior:auto}
        }
      `}</style>

      <div className="sg-wb-shell" style={{ position: 'relative', zIndex: 1, maxWidth: 1320, margin: '0 auto' }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              silicon gothic · code workbench
            </div>
            <h1 className="sg-display" style={{ margin: '10px 0 8px', fontSize: 'clamp(32px, 5vw, 56px)', color: 'var(--sg-ink)', lineHeight: 1 }}>
              TAPEOUT<span style={{ color: 'var(--sg-cyan)' }}>_</span>
            </h1>
            <p style={{ margin: 0, maxWidth: 640, color: 'var(--sg-ink-muted)', fontSize: 14.5 }}>
              CodeMirror 6 · Verilog mode · gutters · autocomplete · unified diff. Challenge screens still use the legacy textarea until migrate.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'menu' })}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'uikit' })}>
              ui kit
            </Button>
          </div>
        </header>

        <div className="sg-wb-grid">
          <Panel title="RTL editor" wide>
            <VerilogEditor
              value={code}
              onChange={setCode}
              onRun={onRun}
              minHeight={360}
              onReady={setEditorReady}
            />
            <div className="sg-wb-toolbar">
              <Button variant="primary" icon={<PlayMark size={15} />} onClick={onRun}>
                compile &amp; run
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                reset
              </Button>
              <Button
                variant={showDiff ? 'brass' : 'default'}
                size="sm"
                onClick={() => setShowDiff(v => !v)}
              >
                {showDiff ? 'diff on' : 'diff off'}
              </Button>
            </div>
            <p className="sg-wb-note" style={{ marginTop: 12 }}>{note}</p>
            <div className="sg-wb-kpis" aria-label="workbench capabilities">
              <span className="sg-wb-kpi">mode<strong>verilog</strong></span>
              <span className="sg-wb-kpi">gutters<strong>on</strong></span>
              <span className="sg-wb-kpi">complete<strong>keywords</strong></span>
              <span className="sg-wb-kpi">theme<strong>gothic</strong></span>
            </div>
          </Panel>

          {showDiff ? (
            <Panel title="Diff · draft vs solution" wide>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--sg-ink-dim)' }}>
                Unified merge — baseline is the reference solution for <code style={{ color: 'var(--sg-brass)' }}>and_gate</code>;
                highlighted chunks are where the live draft diverges.
              </p>
              <DiffPane
                value={code}
                original={SOLUTION}
                minHeight={360}
                onReady={setDiffReady}
              />
            </Panel>
          ) : (
            <Panel title="Workbench notes" wide>
              <p style={{ margin: 0 }}>
                Diff pane hidden. Re-enable to compare the live draft against the canonical solution.
                Next migrate pass swaps the challenge CodeEditor textarea for this CM6 stack.
              </p>
            </Panel>
          )}
        </div>

        <footer className="sg-eyebrow" style={{ textAlign: 'center' }}>
          WORKBENCH · data-workbench-status={stage} · codemirror 6 + @codemirror/merge
        </footer>
      </div>
    </div>
  );
}

export { WorkbenchScreen, STARTER, SOLUTION };

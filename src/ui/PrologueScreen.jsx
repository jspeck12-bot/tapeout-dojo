import { useEffect, useState } from 'react';
import {
  Binary, BookOpen, ChevronRight, Cpu, Eye, Gamepad2, SkipForward,
  Terminal, Wrench, Zap,
} from './components/fab-icons.jsx';
import { AudioFX } from '../audio/index.js';
import { firstDivergence } from '../engine/debug/diagnostics.js';
import { netlistOf } from '../engine/debug/netlist.js';
import { runChallengeTest, vCompile } from '../engine/verilog.js';
import { LESSONS } from '../game/content.js';
import { CodeEditor, CombResults, Waveform } from './foundations.jsx';
import { SchematicView } from './challenges.jsx';

const PROLOGUE_STEPS = [
  'wake', 'playstyle', 'controls', 'field-note',
  'gauntlet', 'first-rtl', 'debug-bay', 'release',
];

const AND_IFACE = {
  name: 'tutorial_and',
  ports: [
    { n: 'a', d: 'in', w: 1 },
    { n: 'b', d: 'in', w: 1 },
    { n: 'y', d: 'out', w: 1 },
  ],
};
const AND_TEST = {
  type: 'comb',
  vectors: [
    { in: { a: 0, b: 0 }, out: { y: 0 } },
    { in: { a: 0, b: 1 }, out: { y: 0 } },
    { in: { a: 1, b: 0 }, out: { y: 0 } },
    { in: { a: 1, b: 1 }, out: { y: 1 } },
  ],
};
const AND_STARTER = `module tutorial_and(
  input  a,
  input  b,
  output y
);
  // Replace 1'b0 with the AND expression.
  assign y = 1'b0;
endmodule
`;

const DEBUG_IFACE = {
  name: 'tutorial_dff',
  ports: [
    { n: 'clk', d: 'in', w: 1 },
    { n: 'rst', d: 'in', w: 1 },
    { n: 'd', d: 'in', w: 1 },
    { n: 'q', d: 'out', w: 1 },
  ],
};
const DEBUG_SOURCE = `module tutorial_dff(
  input clk,
  input rst,
  input d,
  output reg q
);
  always @(posedge clk) begin
    if (rst) q <= 1'b0;
    else     q <= ~d; // injected fault
  end
endmodule
`;
const DEBUG_TEST = {
  type: 'seq',
  frames: [
    { rst: 1, d: 0 },
    { rst: 0, d: 1 },
    { rst: 0, d: 0 },
    { rst: 0, d: 1 },
  ],
  watch: ['q'],
  makeRef: () => ({
    q: 0,
    step(frame) {
      this.q = frame.rst ? 0 : frame.d;
      return { q: this.q };
    },
  }),
};

function StepShell({ step, children, onSkip }) {
  return (
    <div className="prologue-root">
      <style>{`
        .prologue-root{position:fixed;inset:0;z-index:100;background:radial-gradient(ellipse at 50% 35%,#101b2a 0%,#070a10 58%,#030508 100%);color:#d7e0ea;overflow:auto;font-family:var(--sg-font-body),sans-serif}
        .prologue-grid{position:fixed;inset:0;pointer-events:none;opacity:.2;background-image:linear-gradient(rgba(34,211,238,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.16) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,transparent,#000 35%,#000)}
        .prologue-card{position:relative;z-index:2;width:min(760px,calc(100% - 32px));margin:7vh auto;padding:24px;border:1px solid #233247;border-radius:14px;background:rgba(8,12,18,.94);box-shadow:0 22px 90px rgba(0,0,0,.5)}
        .prologue-step{height:4px;flex:1;border-radius:9px;background:#1d2632}.prologue-step.on{background:#22d3ee;box-shadow:0 0 10px rgba(34,211,238,.5)}
        .prologue-choice{width:100%;padding:13px 15px;text-align:left;background:#0d131d;border:1px solid #273245;border-radius:9px;color:inherit;font:inherit;cursor:pointer}.prologue-choice:hover{border-color:#22d3ee}
      `}</style>
      <div className="prologue-grid" />
      <div className="prologue-card">
        <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
          {PROLOGUE_STEPS.map((name, index) =>
            <span key={name} className={'prologue-step' + (index <= step ? ' on' : '')} />)}
        </div>
        {children}
        <button className="lnk" style={{ position: 'absolute', right: 16, top: 12 }}
          onClick={onSkip}><SkipForward size={12} /> skip prologue</button>
      </div>
    </div>
  );
}

function PrologueScreen({ save, replay, onProgress, onChooseMode, onComplete }) {
  const [step, setStep] = useState(() => replay ? 0 : Math.min(7, save.tutorial?.step || 0));
  const [moved, setMoved] = useState(false);
  const [looked, setLooked] = useState(false);
  const [noteAnswer, setNoteAnswer] = useState(null);
  const [gauntletAnswer, setGauntletAnswer] = useState(null);
  const [code, setCode] = useState(AND_STARTER);
  const [codeState, setCodeState] = useState(null);
  const [debugState, setDebugState] = useState(null);
  const [hardwareOpen, setHardwareOpen] = useState(false);
  const firstNote = LESSONS[1][0];

  const advance = (next = step + 1) => {
    AudioFX.good();
    const bounded = Math.min(7, next);
    setStep(bounded);
    onProgress(bounded);
  };

  useEffect(() => {
    if (step !== 2) return undefined;
    const onKey = (event) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        setMoved(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const runCode = () => {
    const compiled = vCompile(code, AND_IFACE);
    if (!compiled.ok) {
      AudioFX.bad();
      setCodeState({ errors: compiled.errors });
      return;
    }
    const result = runChallengeTest(compiled.mod, AND_TEST);
    if (result.pass) AudioFX.win(); else AudioFX.bad();
    setCodeState({ compiled, result });
  };

  const runDebug = () => {
    const compiled = vCompile(DEBUG_SOURCE, DEBUG_IFACE);
    const result = runChallengeTest(compiled.mod, DEBUG_TEST);
    AudioFX.bad();
    setDebugState({
      compiled,
      result,
      diagnosis: firstDivergence(result, { q: 1 }),
      netlist: netlistOf(compiled.mod),
    });
  };

  const title = (eyebrow, heading, sub) => (
    <>
      <div className="eyebrow" style={{ color: '#7defff' }}>{eyebrow}</div>
      <h1 style={{ margin: '6px 0 8px', fontSize: 26, letterSpacing: '.04em' }}>{heading}</h1>
      <p style={{ margin: '0 0 20px', color: '#8fa0b5', lineHeight: 1.6 }}>{sub}</p>
    </>
  );

  return (
    <StepShell step={step} onSkip={() => onComplete({ skipped: true, replay })}>
      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '11vh 0' }}>
          <div style={{ color: '#5a6a80', letterSpacing: '.28em', fontSize: 11 }}>DIE FLOOR · WAKE SIGNAL</div>
          <div style={{ fontSize: 28, margin: '20px auto 8px', maxWidth: 560 }}>
            The wafer is dark. One diagnostic trace is still alive.
          </div>
          <div style={{ color: '#7defff', marginBottom: 28 }}>Follow it. Make the silicon answer.</div>
          <button className="btn primary" onClick={() => advance()}>
            open your eyes <Eye size={14} />
          </button>
        </div>
      )}

      {step === 1 && (
        <>
          {title('choose a playstyle', 'How do you want the fab to teach?', 'This changes guidance, not the circuits. Every valid Verilog implementation still passes the same silicon tests.')}
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="prologue-choice" onClick={() => { onChooseMode('engineer'); advance(); }}>
              <strong style={{ color: '#7defff' }}>ENGINEER · guided</strong>
              <div style={{ color: '#76849a', marginTop: 5 }}>One hint charge and extended verification benches.</div>
            </button>
            <button className="prologue-choice" onClick={() => { onChooseMode('architect'); advance(); }}>
              <strong style={{ color: '#ffe27a' }}>ARCHITECT · no hints</strong>
              <div style={{ color: '#76849a', marginTop: 5 }}>Timed bosses, no starter assistance, 2× XP.</div>
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {title('motor calibration', 'Reach the lit diagnostic', 'Move and look once. The game teaches controls only when you need them.')}
          <div onPointerMove={() => setLooked(true)}
            style={{ height: 180, border: '1px solid #233247', borderRadius: 12, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#0a1018,#142133)', marginBottom: 14 }}>
            <div style={{ position: 'absolute', left: looked ? '68%' : '48%', top: '45%', width: 18, height: 18, borderRadius: 99, background: '#7defff', boxShadow: '0 0 32px #22d3ee', transition: 'left .35s' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#5a6a80', pointerEvents: 'none' }}>
              {looked ? 'LOOK CALIBRATED' : 'move the mouse / drag here to look'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
            {['W', 'A', 'S', 'D'].map(key =>
              <button key={key} className="btn" onClick={() => setMoved(true)}>{key}</button>)}
            <button className="btn" onClick={() => setLooked(true)}>LOOK</button>
          </div>
          <div style={{ textAlign: 'center', color: moved ? '#7ce7a2' : '#76849a' }}>
            movement {moved ? '✓' : '…'} · look {looked ? '✓' : '…'}
          </div>
          <button className="btn primary" style={{ margin: '18px auto 0', display: 'flex' }}
            disabled={!moved || !looked} onClick={() => advance()}>
            reach the signal <ChevronRight size={13} />
          </button>
        </>
      )}

      {step === 3 && (
        <>
          {title('field note · recovered', firstNote.title, 'Why this matters: reliable on/off transistor states are the alphabet from which every processor is built.')}
          <div className="card" style={{ padding: 16, marginBottom: 16, color: '#b9c6d6' }}>
            Binary is place value in base 2. From right to left, each wire is worth twice the previous one: 1, 2, 4, 8…
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>recall · answer before the note awards progress</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              'A transistor stores decimal digits directly.',
              'Reliable on/off states give hardware two physical symbols: 0 and 1.',
              'Binary is used only because software prefers it.',
            ].map((answer, index) => (
              <button key={answer} className="prologue-choice"
                style={noteAnswer === index ? { borderColor: index === 1 ? '#2ea56a' : '#b14a52' } : undefined}
                onClick={() => { setNoteAnswer(index); index === 1 ? AudioFX.good() : AudioFX.bad(); }}>
                {answer}
              </button>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 16 }} disabled={noteAnswer !== 1}
            onClick={() => advance()}>log the note <BookOpen size={13} /></button>
        </>
      )}

      {step === 4 && (
        <>
          {title('first contact', 'One-round gauntlet', 'The enemy health bar is one test vector. Answering correctly removes it.')}
          <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 14 }}>
            <Binary size={26} color="#ffc76b" />
            <div style={{ fontSize: 13, color: '#76849a', marginTop: 8 }}>4-bit binary → decimal</div>
            <div style={{ fontSize: 34, letterSpacing: '.18em', margin: '8px 0' }}>1010</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[8, 10, 12, 14].map(value => (
              <button key={value} className="prologue-choice"
                style={gauntletAnswer === value ? { borderColor: value === 10 ? '#2ea56a' : '#b14a52' } : undefined}
                onClick={() => { setGauntletAnswer(value); value === 10 ? AudioFX.win() : AudioFX.bad(); }}>
                {value}
              </button>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 16 }} disabled={gauntletAnswer !== 10}
            onClick={() => advance()}>vector cleared <Zap size={13} /></button>
        </>
      )}

      {step === 5 && (
        <>
          {title('rtl workbench', 'Complete your first circuit', 'Replace one constant with the AND expression. Ctrl/Cmd + Enter also runs verification.')}
          <CodeEditor value={code} onChange={setCode} onRun={runCode}
            errLines={new Set((codeState?.errors || []).map(error => error.line))}
            ports={AND_IFACE.ports} />
          <button className="btn primary" style={{ marginTop: 12 }} onClick={runCode}>
            run 4 vectors <Terminal size={13} />
          </button>
          {codeState?.errors && (
            <div className="console c-err" style={{ marginTop: 10 }}>
              {codeState.errors.map(error => `line ${error.line}: ${error.msg}`).join('\n')}
            </div>
          )}
          {codeState?.result && <CombResults result={codeState.result} iface={AND_IFACE} />}
          <button className="btn" style={{ marginTop: 12 }} disabled={!codeState?.result?.pass}
            onClick={() => advance()}>first compile signed off <ChevronRight size={13} /></button>
        </>
      )}

      {step === 6 && (
        <>
          {title('fault injected', 'This failure is deliberate', 'A wrong result is not a dead end. Run it, find the first divergent cycle, then inspect the hardware you actually described.')}
          <pre className="codeblock" style={{ maxHeight: 230, overflow: 'auto' }}>{DEBUG_SOURCE}</pre>
          {!debugState && (
            <button className="btn primary" onClick={runDebug}>
              run diagnostic <Wrench size={13} />
            </button>
          )}
          {debugState && (
            <>
              <div className="console c-err" style={{ margin: '12px 0' }}>◈ {debugState.diagnosis}</div>
              <Waveform trace={debugState.result.trace} watch={['q']}
                inputNames={['rst', 'd']} widths={{ rst: 1, d: 1, q: 1 }} accent="#ff8b82" />
              <button className="btn" style={{ marginTop: 12 }}
                onClick={() => { setHardwareOpen(true); AudioFX.click(); }}>
                view as hardware <Cpu size={13} />
              </button>
              {hardwareOpen && (
                <div style={{ marginTop: 12 }}>
                  <SchematicView mod={debugState.compiled.mod} iface={DEBUG_IFACE} accent="#7defff" />
                </div>
              )}
              <button className="btn primary" style={{ marginTop: 12 }} disabled={!hardwareOpen}
                onClick={() => advance()}>debug bay online <ChevronRight size={13} /></button>
            </>
          )}
        </>
      )}

      {step === 7 && (
        <div style={{ textAlign: 'center', padding: '6vh 0' }}>
          <Gamepad2 size={34} color="#7defff" />
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>The trail is live.</h1>
          <p style={{ color: '#8fa0b5', maxWidth: 580, margin: '0 auto 18px' }}>
            Numbered stations are the learning order. The white NEXT beacon marks your first unfinished one—but the mine is yours to explore.
          </p>
          <div className="card" style={{ padding: 14, margin: '0 auto 20px', maxWidth: 520, color: '#b9c6d6' }}>
            WASD moves · mouse looks · Shift sprints · E interacts · ` records a flight note
          </div>
          <button className="btn primary" onClick={() => onComplete({ skipped: false, replay })}>
            descend into the Bit Mines <ChevronRight size={13} />
          </button>
        </div>
      )}
    </StepShell>
  );
}

export {
  AND_IFACE,
  AND_STARTER,
  AND_TEST,
  DEBUG_IFACE,
  DEBUG_SOURCE,
  DEBUG_TEST,
  PROLOGUE_STEPS,
  PrologueScreen,
};

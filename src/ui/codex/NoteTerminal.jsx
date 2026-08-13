import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Cpu, Play, RotateCcw, Zap } from '../components/fab-icons.jsx';
import { AudioFX } from '../../audio/index.js';
import { vCompile, VSim } from '../../engine/verilog.js';
import { noteMeta } from '../../game/codex.js';
import { Paragraphs } from '../foundations.jsx';

function NumberWidget({ lessonId }) {
  const [value, setValue] = useState(5);
  const width = lessonId === 'L1a' ? 4 : 8;
  const mask = Math.pow(2, width) - 1;
  const bits = (value & mask).toString(2).padStart(width, '0');
  const signed = value >= Math.pow(2, width - 1) ? value - Math.pow(2, width) : value;
  return (
    <div>
      <input type="range" min="0" max={mask} value={value}
        onChange={event => setValue(Number(event.target.value))}
        style={{ width: '100%', accentColor: '#22d3ee' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 10 }}>
        <div className="card" style={{ padding: 10 }}><div className="eyebrow">decimal</div>{value}</div>
        <div className="card" style={{ padding: 10 }}><div className="eyebrow">binary</div>{bits.replace(/(.{4})/g, '$1 ').trim()}</div>
        <div className="card" style={{ padding: 10 }}><div className="eyebrow">hex</div>0x{value.toString(16).toUpperCase().padStart(width / 4, '0')}</div>
        <div className="card" style={{ padding: 10 }}><div className="eyebrow">signed</div>{signed}</div>
      </div>
    </div>
  );
}

function GateWidget({ lessonId }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const operation = lessonId === 'L2b' ? 'NAND'
    : lessonId === 'L2c' ? 'De Morgan'
      : lessonId === 'L2d' ? 'ABSORB' : 'XOR';
  const output = operation === 'NAND' ? (a & b) ^ 1
    : operation === 'De Morgan' ? ((a & b) ^ 1)
      : operation === 'ABSORB' ? a | (a & b)
        : a ^ b;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
      {[['A', a, setA], ['B', b, setB]].map(([label, value, setter]) => (
        <button key={label} className="btn" onClick={() => setter(value ^ 1)}>
          {label} = <strong style={{ color: value ? '#7ce7a2' : '#ff8b82' }}>{value}</strong>
        </button>
      ))}
      <div style={{ padding: '12px 20px', border: '1px solid #7defff', borderRadius: 9, color: '#7defff' }}>
        {operation}
      </div>
      <div className="card" style={{ padding: '10px 16px' }}>Y = <strong>{output}</strong></div>
      {operation === 'De Morgan' && (
        <div style={{ width: '100%', textAlign: 'center', color: '#8fa0b5' }}>
          ~(A &amp; B) = ~A | ~B = {output}
        </div>
      )}
    </div>
  );
}

function CompilerWidget({ lessonId }) {
  const expression = lessonId === 'L3c' ? '{a, b}'
    : lessonId === 'L3d' ? "2'b10"
      : lessonId === 'L3a' ? 'a' : 'a & b';
  const width = lessonId === 'L3c' || lessonId === 'L3d' ? 2 : 1;
  const [compiled, setCompiled] = useState(null);
  const source = `module note_demo(input a, input b, output ${width > 1 ? `[${width - 1}:0] ` : ''}y);
  assign y = ${expression};
endmodule`;
  const run = () => {
    const result = vCompile(source, {
      name: 'note_demo',
      ports: [
        { n: 'a', d: 'in', w: 1 },
        { n: 'b', d: 'in', w: 1 },
        { n: 'y', d: 'out', w: width },
      ],
    });
    if (!result.ok) return setCompiled({ error: result.errors[0].msg });
    const sim = new VSim(result.mod);
    sim.setInput('a', 1); sim.setInput('b', 0); sim.settle();
    setCompiled({ value: sim.get('y') });
  };
  return (
    <div>
      <pre className="codeblock">{source}</pre>
      <button className="btn sm" onClick={run}><Play size={12} /> compile with a=1, b=0</button>
      {compiled && (
        <span style={{ marginLeft: 10, color: compiled.error ? '#ff8b82' : '#7ce7a2' }}>
          {compiled.error || `PASS · y=${compiled.value}`}
        </span>
      )}
    </div>
  );
}

function MuxWidget({ lessonId }) {
  const [a, setA] = useState(3);
  const [b, setB] = useState(5);
  const [sel, setSel] = useState(0);
  if (lessonId === 'L4b') {
    const sum = a + b;
    return (
      <div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="range" min="0" max="15" value={a} onChange={event => setA(+event.target.value)} />
          <input type="range" min="0" max="15" value={b} onChange={event => setB(+event.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>a={a} · b={b} · sum={sum & 15} · carry={(sum >> 4) & 1}</div>
      </div>
    );
  }
  if (lessonId === 'L4c') {
    return (
      <div>
        <button className="btn" onClick={() => setSel((sel + 1) % 4)}>input = {sel}</button>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[0, 1, 2, 3].map(index =>
            <span key={index} style={{ flex: 1, padding: 10, textAlign: 'center', borderRadius: 7, background: index === sel ? '#155e6b' : '#111823' }}>Y{index}</span>)}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => setA((a + 1) & 15)}>A={a}</button>
        <button className="btn" onClick={() => setB((b + 1) & 15)}>B={b}</button>
        <button className="btn" onClick={() => setSel(sel ^ 1)}>SEL={sel}</button>
      </div>
      <div style={{ height: 8, background: 'linear-gradient(90deg,#22d3ee,#7defff)', width: sel ? '100%' : '48%', transition: 'width .25s' }} />
      <div style={{ marginTop: 10 }}>active path: {sel ? 'B' : 'A'} → Y = {sel ? b : a}</div>
    </div>
  );
}

function WaveWidget({ lessonId }) {
  const [q, setQ] = useState(0);
  const [d, setD] = useState(1);
  const [cycle, setCycle] = useState(0);
  const clock = () => {
    setQ(lessonId === 'L5d' ? ((q + 1) & 15) : d);
    setCycle(cycle + 1);
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setD(d ^ 1)}>D / input = {d}</button>
        <button className="btn primary" onClick={clock}><Zap size={12} /> rising edge</button>
        <button className="btn" onClick={() => { setQ(0); setCycle(0); }}><RotateCcw size={12} /> reset</button>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 5, alignItems: 'end' }}>
        {Array.from({ length: Math.max(4, cycle + 1) }, (_, index) =>
          <span key={index} style={{ width: 32, height: index % 2 ? 26 : 12, background: index <= cycle ? '#7defff' : '#1d2632' }} />)}
      </div>
      <div style={{ marginTop: 10 }}>cycle {cycle} · stored state q = <strong>{q}</strong></div>
    </div>
  );
}

function PipelineWidget() {
  const stages = ['inputs', 'control', 'ALU', 'register', 'outputs'];
  const [active, setActive] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {stages.map((stage, index) => (
          <button key={stage} className="btn sm" onClick={() => setActive(index)}
            style={index <= active ? { borderColor: '#22d3ee', color: '#7defff' } : undefined}>
            {stage}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, color: '#8fa0b5' }}>
        A chip is a contract between all five stages; a wrong width or control bit can break the whole path.
      </div>
    </div>
  );
}

function LiveWidget({ lessonId, type }) {
  if (type === 'number') return <NumberWidget lessonId={lessonId} />;
  if (type === 'gate') return <GateWidget lessonId={lessonId} />;
  if (type === 'compiler') return <CompilerWidget lessonId={lessonId} />;
  if (type === 'mux') return <MuxWidget lessonId={lessonId} />;
  if (type === 'wave') return <WaveWidget lessonId={lessonId} />;
  return <PipelineWidget />;
}

function NoteTerminal({
  lesson,
  depth,
  worldLabel,
  accent = '#7defff',
  collected,
  recallRecord,
  onRecall,
}) {
  const meta = useMemo(() => noteMeta(lesson.id), [lesson.id]);
  const [revealed, setRevealed] = useState(!!collected);
  const [deepOpen, setDeepOpen] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [sessionPassed, setSessionPassed] = useState(false);
  const [tryOpen, setTryOpen] = useState(false);
  const passed = !!collected || sessionPassed;

  const choose = (index) => {
    const correct = index === meta.correct;
    setAnswer(index);
    onRecall(correct);
    if (correct) {
      setSessionPassed(true);
      AudioFX.good();
    } else AudioFX.bad();
  };

  return (
    <div className="card" style={{ padding: '18px 20px', borderColor: passed ? '#2e6f52' : '#233247' }}>
      <style>{`@keyframes codex-reveal{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.codex-reveal{animation:codex-reveal .32s ease both}.codex-choice{width:100%;padding:11px 13px;text-align:left;background:#0d131d;border:1px solid #273245;border-radius:8px;color:inherit;font:inherit;cursor:pointer}.codex-choice:hover:not(:disabled){border-color:#22d3ee}.codex-choice:disabled{cursor:default}`}</style>
      <div className="eyebrow" style={{ color: accent }}>holographic terminal · {worldLabel}</div>
      <h2 style={{ margin: '7px 0 6px', fontSize: 20 }}>{lesson.title}</h2>
      <div style={{ color: '#9fb0c4', marginBottom: 14 }}>{meta.hook}</div>

      {!revealed ? (
        <button className="btn primary" onClick={() => { setRevealed(true); AudioFX.click(); }}>
          decrypt note <ChevronRight size={12} />
        </button>
      ) : (
        <div className="codex-reveal">
          <div className="eyebrow" style={{ marginBottom: 7 }}>core</div>
          <div className="lessonbody" style={{ color: '#b9c6d6' }}><Paragraphs text={lesson.body} /></div>

          <div className="eyebrow" style={{ margin: '17px 0 8px', color: accent }}>live signal</div>
          <div style={{ padding: 14, border: '1px solid #1d2632', borderRadius: 9, background: '#090e15' }}>
            <LiveWidget lessonId={lesson.id} type={meta.widget} />
          </div>

          {lesson.code && (
            <>
              <div className="eyebrow" style={{ margin: '17px 0 8px' }}>worked example</div>
              <pre className="codeblock">{lesson.code}</pre>
            </>
          )}

          {depth && (
            <div style={{ marginTop: 14 }}>
              <button className="lnk" onClick={() => setDeepOpen(!deepOpen)}>
                <ChevronDown size={12} /> going deeper
              </button>
              {deepOpen && <div className="lessonbody codex-reveal" style={{ color: '#9faec1', marginTop: 8 }}><Paragraphs text={depth} /></div>}
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #1d2632' }}>
            <div className="eyebrow" style={{ color: passed ? '#7ce7a2' : '#ffc76b', marginBottom: 8 }}>
              recall {passed ? '· passed' : '· required for XP'}
            </div>
            <div style={{ marginBottom: 10 }}>{meta.prompt}</div>
            <div style={{ display: 'grid', gap: 7 }}>
              {meta.options.map((option, index) => (
                <button key={option} className="codex-choice"
                  disabled={sessionPassed}
                  style={answer === index ? { borderColor: index === meta.correct ? '#2ea56a' : '#b14a52' } : undefined}
                  onClick={() => choose(index)}>
                  {option} {passed && index === meta.correct ? <Check size={13} style={{ float: 'right' }} /> : null}
                </button>
              ))}
            </div>
            {answer !== null && answer !== meta.correct && (
              <div style={{ color: '#ff8b82', marginTop: 8 }}>Not yet. Re-derive it from the live widget and try again.</div>
            )}
            {passed && (
              <div style={{ color: '#7ce7a2', marginTop: 9 }}>
                Recall logged · {recallRecord?.correct || 1}/{recallRecord?.attempts || 1} correct
              </div>
            )}
          </div>

          <button className="lnk" style={{ marginTop: 12 }} onClick={() => setTryOpen(!tryOpen)}>
            <Play size={12} /> try it · 60-second mental bench
          </button>
          {tryOpen && (
            <div className="codex-reveal" style={{ padding: 10, color: '#9fb0c4' }}>
              Close the note and explain the answer without looking. Then change one live-widget input and predict the output before clicking it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { LiveWidget, NoteTerminal };

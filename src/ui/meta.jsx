import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Cpu, Eye, Flame, Play, RotateCcw,
  Sparkles, Terminal,
} from "./components/fab-icons.jsx";
import { vCompile, runChallengeTest } from '../engine/verilog.js';
import { AudioFX } from '../audio/index.js';
import {
  dailyFor, hardenTest, modeOf, mulberry32, RANKS, TOPIC_OF, TRAINING_GENS,
} from '../game/content.js';
import {
  CodeEditor, CombResults, ConsoleOut, highlightVerilog, Paragraphs, PortTable,
  rankIndex, Waveform,
} from './foundations.jsx';
import { todayStr } from '../app/save.js';
import { ALL_CHALLENGES } from '../world/challenges.js';

// ============================================================
// META UI — training grounds, forge, profiles, stats
// ============================================================

function starterFromIface(iface) {
  const lines = iface.ports.map((p, i) => {
    const dir = p.d === 'in' ? 'input ' : 'output';
    const rng = p.w > 1 ? ` [${p.w - 1}:0]` : '';
    return `  ${dir}${rng} ${p.n}${i < iface.ports.length - 1 ? ',' : ''}`;
  });
  return `module ${iface.name}(\n${lines.join('\n')}\n);\n  // your logic here\n\nendmodule\n`;
}

// ---------- Forge: generic runner for dynamic challenges ----------
function ForgeScreen({ ch0, daily, save, go, onTrainingClear, onStat }) {
  const effMode = save.ngplus ? 'architect' : save.mode;
  const M = modeOf(effMode);
  const [ch, setCh] = useState(ch0);
  const mkStarter = (c) => effMode === 'architect'
    ? `// ARCHITECT MODE — build module ${c.iface.name} from the interface spec\n\n`
    : starterFromIface(c.iface);
  const [code, setCode] = useState(() => mkStarter(ch0));
  const [out, setOut] = useState(null);
  const [errLines, setErrLines] = useState(new Set());
  const [solOpen, setSolOpen] = useState(false);
  const [passed, setPassed] = useState(false);
  const attemptsRef = useRef(0);
  const awardedRef = useRef(false);
  const test = useMemo(() => effMode === 'apprentice' ? ch.test : hardenTest(ch), [ch, effMode]);
  const topic = TOPIC_OF[ch.gid] || 'boolean';
  const gmeta = TRAINING_GENS.find(g => g.gid === ch.gid);

  const freshSpec = () => {
    AudioFX.click();
    const next = gmeta.gen(mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9)));
    setCh(next); setCode(mkStarter(next)); setOut(null); setErrLines(new Set());
    setSolOpen(false); setPassed(false); attemptsRef.current = 0; awardedRef.current = false;
  };

  const run = () => {
    AudioFX.click();
    const res = vCompile(code, ch.iface);
    const lines = [];
    const eset = new Set();
    if (!res.ok) {
      attemptsRef.current++;
      onStat(topic, false);
      res.errors.forEach(e => {
        lines.push({ cls: 'c-err', text: `ERROR${e.line ? ' line ' + e.line : ''}: ${e.msg}` });
        if (e.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + e.hint });
        if (e.line) eset.add(e.line);
      });
      AudioFX.bad();
      setErrLines(eset); setOut({ lines, result: null });
      return;
    }
    (res.warnings || []).forEach(w => lines.push({ cls: 'c-warn', text: `warning line ${w.line}: ${w.msg}` }));
    let result;
    try { result = runChallengeTest(res.mod, test); }
    catch (e) { lines.push({ cls: 'c-err', text: 'SIM ERROR: ' + e.message }); setOut({ lines, result: null }); AudioFX.bad(); return; }
    if (result.runtimeError) {
      attemptsRef.current++;
      onStat(topic, false);
      lines.push({ cls: 'c-err', text: `RUNTIME${result.runtimeError.line ? ' line ' + result.runtimeError.line : ''}: ${result.runtimeError.msg}` });
      if (result.runtimeError.hint) lines.push({ cls: 'c-hint', text: '  ↳ ' + result.runtimeError.hint });
      if (result.runtimeError.line) eset.add(result.runtimeError.line);
      AudioFX.bad(); setErrLines(eset); setOut({ lines, result });
      return;
    }
    if (result.pass) {
      onStat(topic, true);
      lines.push({ cls: 'c-ok', text: `BENCH PASSED — ${result.total}/${result.total} ${result.kind === 'comb' ? 'vectors' : 'cycles'} ✓` });
      if (!awardedRef.current) {
        awardedRef.current = true;
        onTrainingClear(ch, daily, solOpen);
        lines.push({ cls: 'c-dim', text: daily ? '// daily bench logged' : '// training rep logged' });
      }
      setPassed(true);
      AudioFX.win();
    } else {
      attemptsRef.current++;
      onStat(topic, false);
      lines.push({ cls: 'c-err', text: `BENCH FAILED — ${result.passCount}/${result.total} passing` });
      AudioFX.bad();
    }
    setErrLines(new Set());
    setOut({ lines, result });
  };

  const inputNames = ch.iface.ports.filter(p => p.d === 'in' && p.n !== 'clk').map(p => p.n);
  const widths = {};
  ch.iface.ports.forEach(p => widths[p.n] = p.w);
  const accent = daily ? '#FACC15' : '#7DEFFF';

  return (
    <div style={{ marginTop: 22 }}>
      <button className="lnk" onClick={() => go({ name: 'training' })}><ChevronLeft size={14} /> training grounds</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 10px', flexWrap: 'wrap' }}>
        {daily ? <Flame size={16} color="#FACC15" /> : <Sparkles size={15} color="#7DEFFF" />}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>{ch.title}</h2>
        <span style={{ fontSize: 11, color: '#5A6A80' }}>{ch.xp} xp{M.mult > 1 ? ` ×${M.mult}` : ''}{daily && save.dailyDone[ch.daily] ? ' · logged today' : ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, letterSpacing: '.14em', color: effMode === 'architect' ? '#FFC76B' : '#5A6A80' }}>{M.label.toUpperCase()}</span>
      </div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: '16px 18px', fontSize: 13.5, color: '#B9C6D6' }}>
            <div className="lessonbody"><Paragraphs text={ch.brief} /></div>
            <div className="eyebrow" style={{ margin: '14px 0 6px' }}>interface · module {ch.iface.name}</div>
            <PortTable iface={ch.iface} accent={accent} />
          </div>
          <div className="card" style={{ marginTop: 10, padding: '12px 16px', fontSize: 12.5, color: '#76849A' }}>
            {effMode === 'architect'
              ? 'ARCHITECT — no hints, no starter. The spec above is everything.'
              : 'No hints in the training yard — the brief is the spec.'}
            {attemptsRef.current >= 3 && !solOpen && (
              <div><button className="lnk" style={{ marginTop: 8, color: '#FFC76B', paddingLeft: 0 }} onClick={() => { AudioFX.click(); setSolOpen(true); }}><Eye size={13} /> show a reference solution</button></div>
            )}
            {solOpen && (
              <pre className="code-common" style={{ marginTop: 10, background: '#0A0E14', border: '1px solid #3A2E14', borderRadius: 7, padding: '10px 13px', overflowX: 'auto', fontSize: 12.5 }}
                dangerouslySetInnerHTML={{ __html: highlightVerilog(ch.solution).replace(/<span class="lngut">\d+<\/span>/g, '') }} />
            )}
          </div>
        </div>
        <div>
          <CodeEditor value={code} onChange={setCode} onRun={run} errLines={errLines} ports={ch.iface.ports} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
            <button className={'btn ' + (daily ? 'gold' : 'primary')} onClick={run}><Play size={13} /> COMPILE & RUN</button>
            <span className="eyebrow hidesm">ctrl+enter</span>
            <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => { AudioFX.click(); setCode(mkStarter(ch)); setOut(null); setErrLines(new Set()); }}><RotateCcw size={12} /> reset</button>
          </div>
          <ConsoleOut state={out} />
          {out && out.result && !out.result.runtimeError && (
            <div style={{ marginTop: 10 }}>
              {out.result.kind === 'comb'
                ? <CombResults result={out.result} iface={ch.iface} />
                : <Waveform trace={out.result.trace} watch={test.watch} inputNames={inputNames} widths={widths} accent={accent} />}
            </div>
          )}
          {passed && (
            <div className="popin" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!daily && <button className="btn primary" onClick={freshSpec}><Sparkles size={13} /> another one</button>}
              <button className="btn" onClick={() => go({ name: 'training' })}>training grounds <ChevronRight size={13} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Training Grounds ----------
function TrainingScreen({ save, go }) {
  const today = todayStr();
  const dailyCh = useMemo(() => dailyFor(today), [today]);
  const dailyDone = !!save.dailyDone[today];
  const M = modeOf(save.ngplus ? 'architect' : save.mode);
  return (
    <div style={{ marginTop: 22, maxWidth: 720 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px' }}>
        <Sparkles size={18} color="#7DEFFF" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>TRAINING GROUNDS</h2>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{save.trainTotal || 0} reps logged</span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 16 }}>
        Infinite procedurally-generated benches — fresh specs every time, graded by the same engine as the campaign. {15 * M.mult} XP per clear at {M.label} pace. This is where sight-reading turns into muscle.
      </div>

      <button className="card" onClick={() => { AudioFX.click(); go({ name: 'forge', ch: dailyCh, daily: true }); }}
        style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '14px 16px', font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: dailyDone ? '#2EA56A' : '#7A6310', marginBottom: 16 }}>
        <Flame size={17} color="#FACC15" fill={dailyDone ? '#FACC15' : 'none'} />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#FFE27A', letterSpacing: '.03em' }}>{dailyCh.title}</div>
          <div style={{ fontSize: 11.5, color: '#76849A' }}>same puzzle for everyone today · {Math.round(30 * M.mult)} XP once per day · {save.dailyCount || 0} dailies logged</div>
        </div>
        <span style={{ marginLeft: 'auto' }}>{dailyDone ? <Check size={16} color="#7CE7A2" /> : <ChevronRight size={15} color="#5A6A80" />}</span>
      </button>

      <div className="eyebrow" style={{ marginBottom: 8 }}>practice ranges</div>
      <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {TRAINING_GENS.map(g => (
          <button key={g.gid} className="card" onClick={() => {
            AudioFX.click();
            const ch = g.gen(mulberry32((Date.now() & 0xffffff) ^ (Math.random() * 1e9)));
            go({ name: 'forge', ch, daily: false });
          }}
            style={{ padding: '13px 15px', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7DEFFF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1D2632'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Terminal size={14} color="#7DEFFF" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A6A80' }}>{(save.training && save.training[g.gid]) || 0} clears</span>
            </div>
            <div style={{ fontSize: 12, color: '#76849A', marginTop: 5 }}>{g.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- save export / import ----------
function checksum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i % 31 + 1)) % 65521; return h.toString(16); }
function exportSave(save) {
  const json = JSON.stringify(save);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return 'TPO1.' + b64 + '.' + checksum(b64);
}
function importSave(str) {
  const parts = (str || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'TPO1') throw new Error('Not a TAPEOUT save code.');
  if (checksum(parts[1]) !== parts[2]) throw new Error('Checksum mismatch — the code got mangled in transit.');
  const json = decodeURIComponent(escape(atob(parts[1])));
  const s = JSON.parse(json);
  if (typeof s.xp !== 'number' || typeof s.done !== 'object') throw new Error('Save code is missing core fields.');
  return s;
}

// ---------- Profiles ----------
function ProfilesScreen({ save, activeSlot, go, onLoadSlot, onNewSlot, onDeleteSlot, onImport, readSlot }) {
  const [infos, setInfos] = useState(null);
  const [armed, setArmed] = useState(null); // {action, slot}
  const [exportStr, setExportStr] = useState(null);
  const [importStr, setImportStr] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const out = [];
    for (const n of [1, 2, 3]) out.push(await readSlot(n));
    setInfos(out);
  }, [readSlot]);
  useEffect(() => { refresh(); }, [refresh, save]);

  const arm = (action, slot, fn) => {
    if (armed && armed.action === action && armed.slot === slot) { setArmed(null); fn(); }
    else { AudioFX.click(); setArmed({ action, slot }); }
  };

  const doImport = () => {
    try {
      const s = importSave(importStr);
      onImport(s);
      setImportMsg({ ok: true, text: `Save imported into slot ${activeSlot} — rank restored.` });
      setImportStr('');
    } catch (e) {
      AudioFX.bad();
      setImportMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div style={{ marginTop: 22, maxWidth: 620 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 14px' }}>
        <Cpu size={18} color="#22D3EE" />
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.05em' }}>PROFILES</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map((n, idx) => {
          const info = infos && infos[idx];
          const active = n === activeSlot;
          return (
            <div key={n} className="card" style={{ padding: '13px 15px', borderColor: active ? '#155E6B' : '#1D2632' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="eyebrow" style={{ color: active ? '#7DEFFF' : '#5A6A80' }}>slot {n}{active ? ' · active' : ''}</span>
                {info ? (
                  <span style={{ fontSize: 12.5, color: '#B9C6D6' }}>
                    {RANKS[rankIndex(info.xp)][0]} · {info.xp} XP · {Object.keys(info.done || {}).length}/{ALL_CHALLENGES.length} cleared{info.ngplus ? ' · NG+' : ''}
                  </span>
                ) : infos ? <span style={{ fontSize: 12.5, color: '#3A4759' }}>empty wafer</span> : <span style={{ fontSize: 12.5, color: '#3A4759' }}>reading…</span>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {!active && info && <button className="btn sm" onClick={() => { AudioFX.click(); onLoadSlot(n); }}>load</button>}
                  <button className="btn sm" style={armed && armed.action === 'new' && armed.slot === n ? { borderColor: '#FFC76B', color: '#FFC76B' } : null}
                    onClick={() => arm('new', n, () => onNewSlot(n))}>
                    {armed && armed.action === 'new' && armed.slot === n ? 'confirm new' : 'new'}
                  </button>
                  {info && <button className="btn sm" style={armed && armed.action === 'del' && armed.slot === n ? { borderColor: '#FF8B82', color: '#FF8B82' } : null}
                    onClick={() => arm('del', n, () => onDeleteSlot(n))}>
                    {armed && armed.action === 'del' && armed.slot === n ? 'confirm delete' : 'delete'}
                  </button>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="eyebrow" style={{ margin: '20px 0 8px' }}>save portability · walks across devices and artifact versions</div>
      <div className="card" style={{ padding: '13px 15px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm primary" onClick={() => { AudioFX.click(); setExportStr(exportSave(save)); setCopied(false); }}>export active slot</button>
          {exportStr && (
            <button className="btn sm" onClick={async () => {
              try { await navigator.clipboard.writeText(exportStr); setCopied(true); AudioFX.good(); } catch (e) { setCopied(false); }
            }}>{copied ? 'copied ✓' : 'copy code'}</button>
          )}
        </div>
        {exportStr && (
          <textarea readOnly className="field" style={{ marginTop: 10, fontSize: 11, height: 84, resize: 'vertical' }} value={exportStr}
            onFocus={e => e.target.select()} aria-label="export code" />
        )}
        <div style={{ marginTop: 14 }}>
          <textarea className="field" style={{ fontSize: 11, height: 64, resize: 'vertical' }} placeholder="paste a TPO1 save code to import into the active slot…"
            value={importStr} onChange={e => { setImportStr(e.target.value); setImportMsg(null); }} aria-label="import code" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button className="btn sm" disabled={!importStr.trim()} onClick={doImport}>import → slot {activeSlot}</button>
            {importMsg && <span style={{ fontSize: 12, color: importMsg.ok ? '#7CE7A2' : '#FF8B82' }}>{importMsg.text}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  ForgeScreen, TrainingScreen, exportSave, importSave, ProfilesScreen,
};

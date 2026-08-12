import { useMemo, useRef } from "react";
import {
  Star, Check, X, Trophy, Zap, Flame, Volume2, VolumeX, RotateCcw,
} from "lucide-react";
import { V_KEYWORDS } from '../engine/verilog.js';
import { formatValue as fmtVal } from '../engine/format.js';
import { RANKS, modeOf } from '../game/content.js';
import { levelFromXp } from '../game/rpg.js';

// ============================================================
// UI FOUNDATIONS — styles, shared components
// ============================================================

const CSS = `
.tk-root{min-height:100vh;background:#07090D;color:#D7E0EA;font-family:ui-monospace,'Cascadia Code','JetBrains Mono',Menlo,Consolas,monospace;font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
.tk-root *{box-sizing:border-box}
.tk-root ::selection{background:rgba(34,211,238,.28)}
.scanlines{position:fixed;inset:0;pointer-events:none;z-index:70;background:repeating-linear-gradient(0deg,rgba(255,255,255,.016) 0 1px,transparent 1px 3px)}
.wrap{max-width:1060px;margin:0 auto;padding:0 16px 80px}
.eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#76849A}
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid #273245;background:#10151E;color:#D7E0EA;padding:8px 14px;border-radius:6px;font:inherit;font-size:13px;cursor:pointer;transition:border-color .15s,background .15s,transform .05s;white-space:nowrap}
.btn:hover{border-color:#3A4A63;background:#141B26}
.btn:active{transform:translateY(1px)}
.btn:focus-visible,.lnk:focus-visible,.opt:focus-visible,.ycell:focus-visible,.bugline:focus-visible{outline:2px solid #22D3EE;outline-offset:2px}
.btn.primary{background:#0C2C33;border-color:#155E6B;color:#7DEFFF}
.btn.primary:hover{border-color:#22D3EE;background:#0E343D}
.btn.gold{background:#2B2208;border-color:#7A6310;color:#FFE27A}
.btn.gold:hover{border-color:#FACC15}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.sm{padding:5px 10px;font-size:12px}
.card{background:#0D1118;border:1px solid #1D2632;border-radius:10px}
.lnk{background:none;border:none;color:#76849A;cursor:pointer;font:inherit;font-size:12px;padding:4px 6px;display:inline-flex;align-items:center;gap:5px}
.lnk:hover{color:#D7E0EA}
.codespan{background:#141B26;border:1px solid #232E40;border-radius:4px;padding:1px 5px;font-size:.92em;color:#9BE8F7;white-space:nowrap}
.hbar{height:8px;background:#11161F;border:1px solid #1D2632;border-radius:99px;overflow:hidden}
.hbar>div{height:100%;border-radius:99px;transition:width .6s cubic-bezier(.22,1,.36,1)}
@keyframes blinkc{0%,55%{opacity:1}56%,100%{opacity:0}}
.cursorblink{animation:blinkc 1.1s steps(1) infinite}
@keyframes toastin{from{transform:translateX(26px);opacity:0}to{transform:none;opacity:1}}
.toast{animation:toastin .25s cubic-bezier(.22,1,.36,1)}
@keyframes popin{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
.popin{animation:popin .3s cubic-bezier(.22,1,.36,1)}
@keyframes shakex{0%,100%{transform:none}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.shake{animation:shakex .3s}
@keyframes cfall{to{transform:translateY(108vh) rotate(720deg);opacity:.9}}
.die{position:relative;border:1px solid #273245;background:linear-gradient(160deg,#0B0F16,#0A0D13);border-radius:4px;padding:34px;margin:18px 0 10px}
.die:before,.die:after{content:'';position:absolute;left:30px;right:30px;height:8px;background-image:repeating-linear-gradient(90deg,#222C3D 0 14px,transparent 14px 26px);opacity:.85}
.die:before{top:9px}.die:after{bottom:9px}
.die .padL,.die .padR{position:absolute;top:30px;bottom:30px;width:8px;background-image:repeating-linear-gradient(180deg,#222C3D 0 14px,transparent 14px 26px);opacity:.85}
.die .padL{left:9px}.die .padR{right:9px}
.die-grid{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:96px;gap:10px}
.blk{position:relative;border:1px solid #1D2632;border-radius:6px;background:#0D1118;padding:12px 13px;cursor:pointer;text-align:left;font:inherit;color:inherit;overflow:hidden;transition:border-color .15s,transform .12s;display:flex;flex-direction:column;justify-content:space-between}
.blk:hover:not(.locked){transform:translateY(-2px)}
.blk.locked{cursor:default;background:repeating-linear-gradient(135deg,#0B0F15 0 8px,#0D1118 8px 16px)}
.blk .fill{position:absolute;left:0;bottom:0;height:3px;transition:width .7s cubic-bezier(.22,1,.36,1)}
.blk-1{grid-column:1/4;grid-row:1/3}.blk-2{grid-column:4/7;grid-row:1/3}
.blk-3{grid-column:1/3;grid-row:3/5}.blk-4{grid-column:3/5;grid-row:3/5}.blk-5{grid-column:5/7;grid-row:3/5}
.blk-6{grid-column:1/4;grid-row:5/7}.blk-7{grid-column:4/7;grid-row:5/7}
@media(max-width:680px){
  .die{padding:22px}
  .die-grid{display:flex;flex-direction:column}
  .blk{min-height:88px}
  .die:before,.die:after{left:18px;right:18px}.die .padL{left:5px}.die .padR{right:5px}
  .twocol{grid-template-columns:1fr !important}
  .hidesm{display:none !important}
}
.tbl{border-collapse:collapse;font-size:13px}
.tbl th{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#76849A;font-weight:500;padding:5px 12px;border-bottom:1px solid #1D2632;text-align:left}
.tbl td{padding:5px 12px;border-bottom:1px solid #161D29}
.editor-wrap{position:relative;border:1px solid #273245;border-radius:8px;background:#0A0E14;overflow:hidden}
.editor-wrap.errored{border-color:#5b2330}
.code-common{margin:0;font-family:inherit;font-size:13.5px;line-height:1.6;tab-size:2;white-space:pre;word-wrap:normal}
.code-hl{position:absolute;inset:0;overflow:hidden;padding:12px 14px 12px 0;pointer-events:none;color:#C9D6E4}
.code-ta{position:relative;width:100%;display:block;background:transparent;color:transparent;caret-color:#7DEFFF;border:none;resize:none;outline:none;padding:12px 14px 12px 0;overflow:auto}
.lngut{display:inline-block;width:44px;padding-right:12px;text-align:right;color:#3A4759;user-select:none}
.eline{background:rgba(248,81,73,.13)}
.tok-kw{color:#7DEFFF}.tok-num{color:#FFC76B}.tok-cm{color:#5A6A80;font-style:italic}.tok-op{color:#A7B5C8}.tok-id{color:#C9D6E4}
.console{background:#080B10;border:1px solid #1D2632;border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.7;max-height:300px;overflow:auto;white-space:pre-wrap}
.c-err{color:#FF8B82}.c-hint{color:#76849A}.c-ok{color:#7CE7A2}.c-warn{color:#FFC76B}.c-dim{color:#5A6A80}
.opt{display:block;width:100%;text-align:left;background:#10151E;border:1px solid #273245;border-radius:7px;padding:10px 13px;color:#D7E0EA;font:inherit;font-size:13.5px;cursor:pointer;transition:border-color .12s,background .12s}
.opt:hover:not(:disabled){border-color:#3A4A63}
.opt.right{border-color:#2EA56A;background:#0E2418}
.opt.wrong{border-color:#B14A52;background:#2A1216}
.opt:disabled{cursor:default}
.ycell{width:44px;height:34px;border:1px solid #273245;background:#10151E;border-radius:6px;color:#D7E0EA;font:inherit;font-size:14px;cursor:pointer}
.ycell:hover{border-color:#3A4A63}
.ycell.bad{border-color:#B14A52;color:#FF8B82}
.bugline{display:block;width:100%;text-align:left;background:none;border:none;border-left:3px solid transparent;color:#C9D6E4;font:inherit;font-size:13px;line-height:1.7;padding:1px 10px;cursor:pointer;white-space:pre}
.bugline:hover{background:#11161F}
.bugline.hit{border-left-color:#2EA56A;background:#0E2418}
.bugline.miss{border-left-color:#B14A52;background:#2A1216}
.bugline.reveal{border-left-color:#FFC76B;background:#221B0B}
.bugline:disabled{cursor:default}
.field{width:100%;background:#0A0E14;border:1px solid #273245;border-radius:7px;color:#E8F1FA;font:inherit;font-size:16px;padding:10px 13px;outline:none}
.field:focus{border-color:#22D3EE}
.modalbg{position:fixed;inset:0;background:rgba(4,6,10,.78);z-index:90;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.lessonbody p{margin:0 0 10px}
@media(prefers-reduced-motion:reduce){.cursorblink,.toast,.popin,.shake{animation:none !important}.confetti{display:none !important}}
.wavescroll{overflow-x:auto;border:1px solid #1D2632;border-radius:8px;background:#080B10;padding:10px 6px}
`;

// ---------- SFX — see ./audio/index.js ----------

// ---------- tiny renderers ----------
function Inline({ text }) {
  const parts = String(text).split('`');
  return parts.map((p, i) => i % 2 === 1
    ? <code key={i} className="codespan">{p}</code>
    : <span key={i}>{p}</span>);
}
function Paragraphs({ text }) {
  return String(text).split('\n\n').map((p, i) => <p key={i}><Inline text={p} /></p>);
}
function DataTable({ table, accent }) {
  return (
    <table className="tbl" style={{ margin: '10px 0' }}>
      <thead><tr>{table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        {table.rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { color: accent || '#7DEFFF' } : null}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
function PortTable({ iface, accent }) {
  return (
    <table className="tbl" style={{ width: '100%' }}>
      <thead><tr><th>port</th><th>dir</th><th>width</th></tr></thead>
      <tbody>
        {iface.ports.map(p => (
          <tr key={p.n}>
            <td style={{ color: accent }}>{p.n}</td>
            <td>{p.d === 'in' ? 'input' : 'output'}</td>
            <td style={{ color: '#76849A' }}>{p.w > 1 ? `[${p.w - 1}:0]` : '1 bit'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function StarRow({ n, size }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[0, 1, 2].map(i => (
        <Star key={i} size={size || 13} fill={i < n ? '#FACC15' : 'none'} color={i < n ? '#FACC15' : '#3A4759'} strokeWidth={1.6} />
      ))}
    </span>
  );
}
// ---------- syntax highlight ----------
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function highlightVerilog(src, errLines) {
  const lines = src.split('\n');
  let inBlock = false;
  const out = lines.map((line, idx) => {
    let html = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) { html += `<span class="tok-cm">${escHtml(line.slice(i))}</span>`; i = line.length; }
        else { html += `<span class="tok-cm">${escHtml(line.slice(i, end + 2))}</span>`; i = end + 2; inBlock = false; }
        continue;
      }
      const rest = line.slice(i);
      let m;
      if ((m = rest.match(/^\/\/.*/))) { html += `<span class="tok-cm">${escHtml(m[0])}</span>`; i += m[0].length; continue; }
      if (rest.startsWith('/*')) { inBlock = true; continue; }
      if ((m = rest.match(/^\d[\d_]*'s?[bdho][0-9a-fA-FxXzZ_?]*/)) || (m = rest.match(/^\d[\d_]*/))) {
        html += `<span class="tok-num">${escHtml(m[0])}</span>`; i += m[0].length; continue;
      }
      if ((m = rest.match(/^[a-zA-Z_][a-zA-Z0-9_$]*/))) {
        const cls = V_KEYWORDS.has(m[0]) ? 'tok-kw' : 'tok-id';
        html += `<span class="${cls}">${escHtml(m[0])}</span>`; i += m[0].length; continue;
      }
      if ((m = rest.match(/^\s+/))) { html += m[0]; i += m[0].length; continue; }
      html += `<span class="tok-op">${escHtml(rest[0])}</span>`; i += 1;
    }
    const ecls = errLines && errLines.has(idx + 1) ? ' eline' : '';
    return `<span class="${ecls}" style="display:block"><span class="lngut">${idx + 1}</span>${html || ' '}</span>`;
  });
  return out.join('');
}

// ---------- editor ----------
function CodeEditor({ value, onChange, onRun, errLines }) {
  const taRef = useRef(null);
  const hlRef = useRef(null);
  const sync = () => {
    if (taRef.current && hlRef.current) {
      hlRef.current.scrollTop = taRef.current.scrollTop;
      hlRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };
  const onKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const nv = value.slice(0, s) + '  ' + value.slice(en);
      onChange(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); }
  };
  const html = useMemo(() => highlightVerilog(value, errLines), [value, errLines]);
  const lineCount = value.split('\n').length;
  const h = Math.min(440, Math.max(190, lineCount * 21.6 + 28));
  return (
    <div className={'editor-wrap' + (errLines && errLines.size ? ' errored' : '')} style={{ height: h }}>
      <pre ref={hlRef} className="code-common code-hl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html + '\n' }} />
      <textarea
        ref={taRef}
        className="code-common code-ta"
        style={{ height: '100%', paddingLeft: 44 }}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        onKeyDown={onKey}
        aria-label="Verilog editor"
      />
    </div>
  );
}

// ---------- SOUNDTRACK / TRACK LIBRARY / MUSIC ENGINE — see ./audio/index.js ----------

// ---------- waveform ----------
function Waveform({ trace, watch, inputNames, widths, accent }) {
  const CW = 38, LBL = 100, RH = 26, GAP = 12, TOP = 22;
  const n = trace.length;
  const rows = [{ name: 'clk', kind: 'clk' }];
  inputNames.forEach(nm => rows.push({ name: nm, kind: 'in', get: f => f.in[nm] }));
  watch.forEach(nm => {
    rows.push({ name: nm + ' ·you', kind: 'got', sig: nm, get: f => f.got[nm] });
    rows.push({ name: nm + ' ·ref', kind: 'exp', sig: nm, get: f => f.expect[nm] });
  });
  const W = LBL + n * CW + 10;
  const H = TOP + rows.length * (RH + GAP) + 6;
  const colorOf = (r) => r.kind === 'clk' ? '#5A6A80' : r.kind === 'in' ? '#8FA3BC' : r.kind === 'exp' ? '#7CE7A2' : (accent || '#7DEFFF');

  const els = [];
  // cycle pass/fail header + mismatch shading
  trace.forEach((f, i) => {
    const x = LBL + i * CW;
    els.push(<text key={'cyc' + i} x={x + CW / 2} y={13} fontSize="10" textAnchor="middle" fill={f.ok ? '#3F8A5C' : '#FF8B82'}>{f.ok ? '✓' : '✗'}</text>);
    if (!f.ok) els.push(<rect key={'bad' + i} x={x} y={TOP - 4} width={CW} height={H - TOP} fill="rgba(248,81,73,.07)" />);
    if (i > 0) els.push(<line key={'gr' + i} x1={x} y1={TOP - 4} x2={x} y2={H - 4} stroke="#11161F" strokeWidth="1" />);
  });

  rows.forEach((row, ri) => {
    const yTop = TOP + ri * (RH + GAP);
    const yBot = yTop + RH;
    const c = colorOf(row);
    els.push(<text key={'lb' + ri} x={LBL - 10} y={yTop + RH / 2 + 4} fontSize="11" textAnchor="end" fill={row.kind === 'got' || row.kind === 'exp' ? c : '#76849A'}>{row.name}</text>);
    if (row.kind === 'clk') {
      let d = '';
      for (let i = 0; i < n; i++) {
        const x = LBL + i * CW;
        d += `M ${x} ${yBot} L ${x} ${yTop} L ${x + CW / 2} ${yTop} L ${x + CW / 2} ${yBot} L ${x + CW} ${yBot} `;
      }
      els.push(<path key={'clk'} d={d} stroke={c} strokeWidth="1.4" fill="none" />);
      return;
    }
    const w = widths[row.sig || row.name] || 1;
    if (w === 1) {
      let d = '';
      let prev = null;
      for (let i = 0; i < n; i++) {
        const v = row.get(trace[i]);
        const x = LBL + i * CW;
        const y = v ? yTop : yBot;
        if (i === 0) d += `M ${x} ${y} `;
        else if (prev !== v) d += `L ${x} ${prev ? yTop : yBot} L ${x} ${y} `;
        d += `L ${x + CW} ${y} `;
        prev = v;
      }
      const bad = row.kind === 'got';
      els.push(<path key={'w' + ri} d={d} stroke={c} strokeWidth="1.6" fill="none" />);
      if (bad) trace.forEach((f, i) => {
        if (f.got[row.sig] !== f.expect[row.sig]) {
          els.push(<circle key={'x' + ri + '-' + i} cx={LBL + i * CW + CW / 2} cy={(yTop + yBot) / 2} r="3" fill="#FF8B82" />);
        }
      });
    } else {
      // bus: boxed segments per run of equal values
      let i = 0;
      while (i < n) {
        let j = i;
        const v = row.get(trace[i]);
        while (j + 1 < n && row.get(trace[j + 1]) === v) j++;
        const x = LBL + i * CW + 1.5;
        const wd = (j - i + 1) * CW - 3;
        const mism = row.kind === 'got' && (() => { for (let k = i; k <= j; k++) if (trace[k].got[row.sig] !== trace[k].expect[row.sig]) return true; return false; })();
        els.push(<rect key={'b' + ri + '-' + i} x={x} y={yTop + 2} width={wd} height={RH - 4} rx="3" fill="none" stroke={mism ? '#FF8B82' : c} strokeWidth="1.3" />);
        els.push(<text key={'bt' + ri + '-' + i} x={x + wd / 2} y={yTop + RH / 2 + 4} fontSize="10.5" textAnchor="middle" fill={mism ? '#FF8B82' : c}>{fmtVal(v, w)}</text>);
        i = j + 1;
      }
    }
  });

  return (
    <div className="wavescroll">
      <svg width={W} height={H} style={{ display: 'block' }} role="img" aria-label="waveform">{els}</svg>
    </div>
  );
}

// ---------- comb results ----------
function CombResults({ result, iface }) {
  const inPorts = iface.ports.filter(p => p.d === 'in');
  const outPorts = iface.ports.filter(p => p.d === 'out');
  const widthOf = (nm) => (iface.ports.find(p => p.n === nm) || { w: 1 }).w;
  const fails = result.rows.filter(r => !r.ok);
  const shown = fails.length ? [...fails.slice(0, 6), ...result.rows.filter(r => r.ok).slice(0, 6)] : result.rows.slice(0, 10);
  return (
    <div>
      <table className="tbl" style={{ width: '100%' }}>
        <thead>
          <tr>
            {inPorts.map(p => <th key={p.n}>{p.n}</th>)}
            {outPorts.map(p => <th key={p.n}>{p.n} (you)</th>)}
            {outPorts.map(p => <th key={p.n + 'e'}>{p.n} (ref)</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {inPorts.map(p => <td key={p.n} style={{ color: '#8FA3BC' }}>{fmtVal(r.in[p.n], widthOf(p.n))}</td>)}
              {outPorts.map(p => <td key={p.n} style={{ color: r.got[p.n] === r.expect[p.n] ? '#D7E0EA' : '#FF8B82' }}>{fmtVal(r.got[p.n], widthOf(p.n))}</td>)}
              {outPorts.map(p => <td key={p.n + 'e'} style={{ color: '#7CE7A2' }}>{fmtVal(r.expect[p.n], widthOf(p.n))}</td>)}
              <td>{r.ok ? <Check size={14} color="#3F8A5C" /> : <X size={14} color="#FF8B82" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > shown.length && (
        <div style={{ fontSize: 11.5, color: '#5A6A80', padding: '6px 2px' }}>
          … {result.rows.length - shown.length} more vectors {fails.length ? 'omitted' : '— all passing'}
        </div>
      )}
    </div>
  );
}

// ---------- console ----------
function ConsoleOut({ state }) {
  if (!state) return (
    <div className="console"><span className="c-dim">// console — hit COMPILE & RUN (Ctrl+Enter) to test your module against the bench</span></div>
  );
  return (
    <div className="console">
      {state.lines.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
    </div>
  );
}

// ---------- toasts ----------
function Toasts({ items }) {
  return (
    <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 95, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      {items.map(t => (
        <div key={t.id} className="toast card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', borderColor: t.kind === 'ach' ? '#7A6310' : '#155E6B' }}>
          {t.kind === 'ach' ? <Trophy size={16} color="#FACC15" /> : <Zap size={16} color="#7DEFFF" />}
          <div>
            <div style={{ fontSize: 12.5, color: t.kind === 'ach' ? '#FFE27A' : '#7DEFFF' }}>{t.title}</div>
            {t.sub && <div style={{ fontSize: 11, color: '#76849A' }}>{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- confetti ----------
function Confetti({ colors }) {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 2.4 + Math.random() * 2,
    size: 5 + Math.random() * 7,
    color: colors[i % colors.length],
    rot: Math.random() * 360,
  })), [colors]);
  return (
    <div className="confetti" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 96, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -16, left: p.left + '%', width: p.size, height: p.size * 0.45,
          background: p.color, transform: `rotate(${p.rot}deg)`, opacity: 0.95,
          animation: `cfall ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.6,1) forwards`,
        }} />
      ))}
    </div>
  );
}

// ---------- modal ----------
function Modal({ children, onClose, width }) {
  return (
    <div className="modalbg" onClick={onClose}>
      <div className="card popin" style={{ width: width || 560, maxWidth: '100%', maxHeight: '88vh', overflow: 'auto', padding: 22 }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------- header ----------
function rankIndex(xp) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r[1]) idx = i; });
  return idx;
}
function Header({ save, onHome, onToggleSound, onSettings }) {
  const ri = rankIndex(save.xp);
  const cur = RANKS[ri], next = RANKS[ri + 1];
  const pct = next ? Math.min(100, Math.round(((save.xp - cur[1]) / (next[1] - cur[1])) * 100)) : 100;
  return (
    <div style={{ borderBottom: '1px solid #1D2632', background: 'rgba(7,9,13,.92)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="wrap" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="lnk" onClick={onHome} style={{ padding: 0 }} aria-label="Home">
          <span style={{ fontSize: 17, letterSpacing: '.18em', color: '#E8F1FA', fontWeight: 600 }}>
            TAPEOUT<span className="cursorblink" style={{ color: '#7DEFFF' }}>_</span>
          </span>
        </button>
        <span className="eyebrow hidesm">the verilog dojo</span>
        <div style={{ flex: 1 }} />
        <button className="lnk hidesm" onClick={onSettings} title="difficulty" style={{ fontSize: 10.5, letterSpacing: '.12em', color: save.ngplus ? '#FFE27A' : '#76849A' }}>
          {(save.ngplus ? 'NG+ · ' : '') + modeOf(save.ngplus ? 'architect' : save.mode).label.toUpperCase()}
        </button>
        <div title="daily streak" style={{ display: 'flex', alignItems: 'center', gap: 5, color: save.streak.count > 1 ? '#FFC76B' : '#5A6A80', fontSize: 13 }}>
          <Flame size={15} fill={save.streak.count > 1 ? '#FFC76B' : 'none'} /> {save.streak.count}
        </div>
        <div style={{ minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
            <span style={{ color: '#7DEFFF', letterSpacing: '.1em' }}>{cur[0].toUpperCase()}</span>
          <span className="chip" title="level">Lv {levelFromXp(save.xp || 0)}</span>
          <span className="chip" title="scrap" style={{ color: '#FFC76B' }}>⛁ {save.scrap || 0}</span>
            <span style={{ color: '#76849A' }}>{save.xp} XP{next ? ' / ' + next[1] : ''}</span>
          </div>
          <div className="hbar"><div style={{ width: pct + '%', background: 'linear-gradient(90deg,#155E6B,#22D3EE)' }} /></div>
        </div>
        <button className="lnk" onClick={onToggleSound} aria-label="toggle sound">
          {save.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button className="lnk" onClick={onSettings} aria-label="settings"><RotateCcw size={15} /></button>
      </div>
    </div>
  );
}

export {
  CSS, Inline, Paragraphs, DataTable, PortTable, StarRow,
  highlightVerilog, CodeEditor, Waveform, CombResults, ConsoleOut,
  Toasts, Confetti, Modal, rankIndex, Header,
};

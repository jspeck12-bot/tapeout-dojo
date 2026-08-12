import { useEffect, useRef, useState } from "react";

function TouchControls({ inputRef, onInteract }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const [sprinting, setSprinting] = useState(!!inputRef.current.sprint);
  const handle = (e, end) => {
    if (end) { inputRef.current.jx = 0; inputRef.current.jy = 0; setKnob({ x: 0, y: 0, on: false }); return; }
    const t = e.touches[0];
    if (!t || !baseRef.current) return;
    const r = baseRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    inputRef.current.jx = dx;
    inputRef.current.jy = dy;
    setKnob({ x: dx * 28, y: dy * 28, on: true });
  };
  return (
    <>
      <div ref={baseRef}
        onTouchStart={(e) => handle(e)} onTouchMove={(e) => handle(e)} onTouchEnd={(e) => handle(e, true)}
        style={{ position: 'absolute', bottom: 26, left: 22, width: 104, height: 104, borderRadius: 99, border: '1.5px solid #1D2632', background: 'rgba(10,14,20,0.5)', zIndex: 24, touchAction: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 42, height: 42, borderRadius: 99, background: knob.on ? '#155E6B' : '#11202b', border: '1px solid #22D3EE', transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <button onTouchStart={(e) => { e.preventDefault(); onInteract(); }}
        style={{ position: 'absolute', bottom: 44, right: 26, width: 66, height: 66, borderRadius: 99, border: '1.5px solid #155E6B', background: 'rgba(13,30,38,0.8)', color: '#7DEFFF', fontSize: 22, zIndex: 24, touchAction: 'none' }}>⏎</button>
      <button onTouchStart={() => { const next = !sprinting; inputRef.current.sprint = next; setSprinting(next); }}
        style={{ position: 'absolute', bottom: 120, right: 36, width: 46, height: 46, borderRadius: 99, border: '1px solid #1D2632', background: sprinting ? 'rgba(34,211,238,0.25)' : 'rgba(10,14,20,0.6)', color: '#A9B7C9', fontSize: 11, zIndex: 24, touchAction: 'none' }}>RUN</button>
    </>
  );
}

function CinematicFX({ accent }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 21, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(125% 105% at 50% 42%, transparent 50%, rgba(0,0,0,0.34) 82%, rgba(0,0,0,0.62) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.07, background: accent || '#7DEFFF' }} />
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'soft-light', opacity: 0.5, background: 'linear-gradient(180deg, rgba(120,150,200,0.10) 0%, transparent 30%, transparent 72%, rgba(0,0,0,0.18) 100%)' }} />
    </div>
  );
}

function GfxPanel({ gfx, setGfx, accent, embedded }) {
  const [open, setOpen] = useState(false);
  const rows = [
    ['exposure', 0.5, 2.2, 0.01], ['lights', 0.2, 3, 0.05], ['ambient', 0, 2.5, 0.05],
    ['fog', 0, 0.08, 0.002], ['normal', 0, 2.5, 0.05], ['glow', 0, 1.5, 0.05], ['bloom', 0, 2, 0.05],
  ];
  const sliders = rows.map(([k, mn, mx, st]) => (
    <div key={k} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9FB4C8', marginBottom: 2 }}><span>{k}</span><span style={{ color: '#D7E0EA' }}>{(+gfx[k]).toFixed(3)}</span></div>
      <input type="range" min={mn} max={mx} step={st} value={gfx[k]} style={{ width: '100%', accentColor: accent || '#7DEFFF' }}
        onChange={e => setGfx(g => ({ ...g, [k]: +e.target.value }))} />
    </div>
  ));
  if (embedded) return <div>{sliders}</div>;
  if (!open) return (
    <button className="btn sm" style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }} onClick={() => setOpen(true)}>graphics</button>
  );
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 26, width: 236, background: 'rgba(8,10,14,0.93)', border: '1px solid #273245', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span className="eyebrow" style={{ color: accent || '#7DEFFF' }}>graphics · tune live</span>
        <button className="lnk" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>close</button>
      </div>
      {sliders}
      <button className="btn sm" style={{ width: '100%', marginTop: 4 }}
        onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(gfx)); } catch (e) { } }}>
        copy settings → paste to Claude
      </button>
    </div>
  );
}

function EnterFade() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 28, background: '#000',
      opacity: on ? 1 : 0, transition: 'opacity 0.9s ease', pointerEvents: 'none',
    }} />
  );
}

export { TouchControls, CinematicFX, GfxPanel, EnterFade };

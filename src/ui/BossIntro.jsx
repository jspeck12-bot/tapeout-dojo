import { ChevronRight, Swords, X } from 'lucide-react';
import { AudioFX } from '../audio/index.js';

function BossIntro({ spec, onEnter, onCancel }) {
  if (!spec) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 66, background: 'radial-gradient(ellipse at center,rgba(18,8,8,.45),rgba(2,3,6,.96))', display: 'grid', placeItems: 'center', padding: 20 }}>
      <style>{`@keyframes boss-name{from{opacity:0;letter-spacing:.5em;transform:scale(.92)}to{opacity:1;letter-spacing:.16em;transform:none}}.boss-name{animation:boss-name 1.1s cubic-bezier(.2,.8,.2,1) both}`}</style>
      <div style={{ width: 'min(720px,94vw)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ color: '#ff8b82', marginBottom: 12 }}>FOG GATE CROSSED</div>
        <Swords size={34} color="#facc15" style={{ marginBottom: 12 }} />
        <div className="boss-name" style={{ fontSize: 'clamp(28px,6vw,58px)', fontWeight: 700, color: '#f5e9dc', textShadow: '0 0 32px rgba(255,90,60,.35)' }}>
          {spec.name}
        </div>
        <div style={{ marginTop: 9, color: '#c99d91', fontSize: 14, letterSpacing: '.1em' }}>{spec.epithet}</div>
        <div style={{ display: 'flex', gap: 6, margin: '24px auto 18px', maxWidth: 560 }}>
          {spec.phases.map((phase, index) => (
            <div key={phase} style={{ flex: 1, padding: '8px 5px', borderTop: '2px solid ' + (index === 0 ? '#facc15' : '#5a2a2e'), color: index === 0 ? '#ffe27a' : '#8a6670', fontSize: 10 }}>
              {phase}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 9 }}>
          <button className="btn" onClick={() => { AudioFX.click(); onCancel(); }}><X size={12} /> step back</button>
          <button className="btn gold" onClick={() => { AudioFX.bad(); onEnter(); }}>enter the fog <ChevronRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}

export { BossIntro };

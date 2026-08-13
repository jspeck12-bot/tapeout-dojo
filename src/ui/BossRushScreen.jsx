import { ChevronLeft, ChevronRight, Lock, Medal, Swords } from './components/fab-icons.jsx';
import { AudioFX } from '../audio/index.js';
import { BOSS_SPECS } from '../game/bosses.js';
import { ITEM_BY_ID } from '../game/rpg.js';
import { ALL_CHALLENGES } from '../world/challenges.js';

function BossRushScreen({ save, go }) {
  const bosses = Object.entries(BOSS_SPECS).map(([id, spec]) => ({
    id,
    spec,
    challenge: ALL_CHALLENGES.find((challenge) => challenge.id === id),
  }));
  if (!save.tapeoutDone) {
    return (
      <div style={{ marginTop: 28 }}>
        <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={13} /> menu</button>
        <div className="card" style={{ maxWidth: 560, padding: 24, marginTop: 12, textAlign: 'center' }}>
          <Lock size={28} color="#76849A" />
          <h2>BOSS RUSH SEALED</h2>
          <div style={{ color: '#8A98AC' }}>Tape out CHIP-1 to unlock the remembrance gauntlet.</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 22, maxWidth: 820 }}>
      <button className="lnk" onClick={() => go({ name: 'menu' })}><ChevronLeft size={13} /> menu</button>
      <div className="eyebrow" style={{ color: '#FACC15', marginTop: 12 }}>post-campaign spaced review</div>
      <h1 style={{ margin: '5px 0 6px' }}>BOSS RUSH</h1>
      <div style={{ color: '#8A98AC', marginBottom: 17 }}>Seven concepts. No runback. Pick the memory you want to sharpen.</div>
      <div style={{ display: 'grid', gap: 9 }}>
        {bosses.map(({ id, spec, challenge }) => {
          const remembrance = save.remembrances?.[id];
          const reward = ITEM_BY_ID[spec.reward];
          return (
            <button key={id} className="card"
              onClick={() => { AudioFX.bad(); go({ name: challenge.kind, id }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', borderColor: remembrance ? '#7A6310' : '#273245' }}>
              <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 99, background: 'rgba(250,204,21,.1)' }}>
                {remembrance ? <Medal size={17} color="#FACC15" /> : <Swords size={17} color="#FF8B82" />}
              </span>
              <span>
                <div style={{ fontWeight: 650, color: '#FFE27A' }}>{spec.name}</div>
                <div style={{ fontSize: 11, color: '#76849A' }}>{spec.epithet}</div>
                <div style={{ fontSize: 10.5, color: remembrance ? '#7CE7A2' : '#5A6A80', marginTop: 2 }}>
                  {remembrance ? `remembrance · ${reward?.name}` : 'remembrance unclaimed'}
                </div>
              </span>
              <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#5A6A80' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { BossRushScreen };

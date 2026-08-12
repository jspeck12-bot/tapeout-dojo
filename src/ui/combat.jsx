import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Coins, FlaskConical, Heart, Skull, Swords, Zap,
} from "lucide-react";
import { AudioFX } from '../audio/index.js';
import { bossPhase } from '../engine/debug/diagnostics.js';
import { ITEMS, derivedStats } from '../game/rpg.js';
import { FR } from '../telemetry/flight-recorder.js';

// ============================================================
// COMBAT SYSTEM — combat hook, HUD, flatline, shop, level-up
// ============================================================

function useCombat({ enemy, save, live: liveIn, onEnd, onConsume }) {
  const live0 = useRef(liveIn).current;
  const stats = useMemo(() => derivedStats(save), [save.xp, save.gear]);
  const [php, setPhp] = useState(stats.maxHp);
  const [ehp, setEhp] = useState(enemy.hp);
  const [phase, setPhase] = useState(1);
  const phaseRef = useRef(1); phaseRef.current = phase;
  const [phaseT, setPhaseT] = useState(0);
  const [tele, setTele] = useState(0);
  const [feed, setFeed] = useState([]);
  const [over, setOver] = useState(null); // 'won' | 'dead'
  const [fluxArmed, setFluxArmed] = useState(false);
  const bestRef = useRef(0);
  const hitRef = useRef(false);
  const endedRef = useRef(false);
  const nextRef = useRef(null);
  const overRef = useRef(null); overRef.current = over;
  const fluxRef = useRef(false); fluxRef.current = fluxArmed;
  const statsRef = useRef(stats); statsRef.current = stats;
  const saveRef = useRef(save); saveRef.current = save;
  const fid = useRef(0);
  const push = (txt, cls) => setFeed(f => [...f.slice(-3), { id: ++fid.current, txt, cls }]);
  const psp = () => enemy.boss ? (phaseRef.current >= 3 ? 0.84 : phaseRef.current === 2 ? 0.92 : 1) : 1;
  const pdm = () => enemy.boss ? (phaseRef.current >= 3 ? 1.16 : phaseRef.current === 2 ? 1.08 : 1) : 1;
  const applyEhp = (ne) => {
    setEhp(ne);
    if (!enemy.boss) return;
    const np = bossPhase(ne, enemy.hp);
    if (np > phaseRef.current) {
      phaseRef.current = np; setPhase(np); setPhaseT(Date.now()); AudioFX.bad();
      push(enemy.name + (np >= 3 ? ' — LAST STAND · PHASE III' : ' — ENRAGED · PHASE II'), 'boss');
      if (nextRef.current) nextRef.current = Math.min(nextRef.current, Date.now() + 700);
    }
  };

  useEffect(() => {
    if (!live0) return;
    nextRef.current = Date.now() + enemy.grace * 1000;
    const iv = setInterval(() => {
      if (overRef.current) return;
      const now = Date.now();
      const windowMs = enemy.interval * 1000 * statsRef.current.slowMult * psp();
      setTele(Math.max(0, Math.min(1, 1 - (nextRef.current - now) / windowMs)));
      if (now >= nextRef.current) {
        const dmg = Math.max(1, Math.round(enemy.atk * (1 - statsRef.current.defPct) * pdm()));
        hitRef.current = true;
        AudioFX.bad();
        push(enemy.name + ' hits — −' + dmg + ' HP', 'hit');
        nextRef.current = now + windowMs;
        setPhp(p => {
          const np = Math.max(0, p - dmg);
          if (np <= 0 && !endedRef.current) { try { FR.ev('flatline', {}); } catch (eFl) { } setOver('dead'); }
          return np;
        });
      }
    }, 120);
    return () => clearInterval(iv);
  }, [live0]); // eslint-disable-line

  const suppress = () => {
    const sec = Math.min(20, (0.5 + statsRef.current.atk / 10) * (fluxRef.current ? 3 : 1));
    if (nextRef.current) nextRef.current = Math.max(nextRef.current, Date.now()) + sec * 1000;
    push((fluxRef.current ? 'flux burn — ' : '') + 'suppressed +' + sec.toFixed(1) + 's', 'good');
    if (fluxRef.current) setFluxArmed(false);
    if (statsRef.current.lifesteal) setPhp(p => Math.min(statsRef.current.maxHp, p + statsRef.current.lifesteal));
  };
  const counter = (why) => {
    const dmg = Math.max(1, Math.round(enemy.counter * (1 - statsRef.current.defPct) * pdm()));
    hitRef.current = true;
    push(why + ' — −' + dmg + ' HP', 'hit');
    setPhp(p => {
      const np = Math.max(0, p - dmg);
      if (np <= 0 && !endedRef.current) { try { FR.ev('flatline', {}); } catch (eFl) { } setOver('dead'); }
      return np;
    });
  };
  const victory = () => {
    if (endedRef.current || !live0 || overRef.current === 'dead') return;
    endedRef.current = true;
    setEhp(0); setOver('won');
    const flaw = !hitRef.current;
    const scrap = Math.round(enemy.scrap * statsRef.current.scrapMult * (flaw ? 1.5 : 1));
    push(enemy.name + ' destroyed · +' + scrap + ' scrap' + (flaw ? ' · FLAWLESS ×1.5' : ''), 'win');
    onEnd({ win: true, scrap, flawless: flaw });
  };
  const onRun = ({ ok, frac }) => {
    if (!live0 || overRef.current) return;
    if (ok) { victory(); return; }
    const f = Math.max(0, Math.min(1, frac || 0));
    if (f > bestRef.current) {
      const gained = f - bestRef.current;
      bestRef.current = f;
      applyEhp(Math.max(1, Math.round(enemy.hp * (1 - f))));
      push('dealt ' + Math.max(1, Math.round(enemy.hp * gained)) + ' dmg', 'good');
      suppress();
    } else {
      counter('no ground gained');
    }
  };
  const onAnswer = (right) => {
    if (!live0 || overRef.current) return;
    if (right) {
      bestRef.current = Math.min(1, bestRef.current + 0.2);
      applyEhp(Math.max(1, Math.round(enemy.hp * (1 - bestRef.current))));
      push('clean hit — ' + Math.round(enemy.hp * 0.2) + ' dmg', 'good');
      suppress();
    } else counter('counterattack');
  };
  const retreatDead = () => {
    if (endedRef.current) return 0;
    endedRef.current = true;
    const loss = Math.min(saveRef.current.scrap || 0, Math.max(10, Math.round(enemy.scrap * 0.6)));
    onEnd({ death: true, scrapLoss: loss });
    return loss;
  };
  const potion = () => {
    if (!live0 || overRef.current) return;
    if ((saveRef.current.inv && saveRef.current.inv.potions || 0) <= 0) return;
    onConsume('potions');
    AudioFX.good();
    setPhp(p => Math.min(statsRef.current.maxHp, p + 40));
    push('solder ration — +40 HP', 'good');
  };
  const flux = () => {
    if (!live0 || overRef.current || fluxArmed) return;
    if ((saveRef.current.inv && saveRef.current.inv.flux || 0) <= 0) return;
    onConsume('flux');
    AudioFX.click();
    setFluxArmed(true);
    push('flux armed — next gain ×3 suppression', 'good');
  };

  return { live: live0, stats, enemy, php, ehp, tele, feed, over, dead: over === 'dead', won: over === 'won', fluxArmed, onRun, onAnswer, victory, retreatDead, potion, flux, phase, phaseT };
}

function Bar({ pct, color, h }) {
  return (
    <div style={{ height: h || 8, background: '#11161F', borderRadius: 99, overflow: 'hidden', marginTop: 3, border: '1px solid #1A2230' }}>
      <div style={{ height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color, transition: 'width .25s ease' }} />
    </div>
  );
}

function CombatHUD({ c, save }) {
  if (!c) return null;
  if (!c.live) {
    return (
      <div className="card" style={{ margin: '10px 0 4px', padding: '8px 14px', display: 'flex', gap: 9, alignItems: 'center' }}>
        <Swords size={13} color="#5A6A80" />
        <span className="eyebrow">sparring — already cleared, the {c.enemy.name.toLowerCase()} won't bite</span>
      </div>
    );
  }
  const hpPct = c.php / c.stats.maxHp * 100;
  const ePct = c.ehp / c.enemy.hp * 100;
  const pots = (save.inv && save.inv.potions) || 0;
  const fluxN = (save.inv && save.inv.flux) || 0;
  return (
    <div className="card" style={{ margin: '10px 0 4px', padding: '10px 14px', borderColor: c.enemy.boss ? '#7A6310' : undefined }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8FA3BC', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Heart size={11} color="#7CE7A2" /> ENGINEER · Lv {c.stats.lvl}</span>
            <span>{c.php}/{c.stats.maxHp}</span>
          </div>
          <Bar pct={hpPct} color={hpPct > 50 ? '#2EA56A' : hpPct > 25 ? '#FFC76B' : '#FF6B62'} />
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button className="btn sm" disabled={pots <= 0} onClick={c.potion} title="restore 40 HP">
              <FlaskConical size={11} /> ration ×{pots}
            </button>
            <button className="btn sm" disabled={fluxN <= 0 || c.fluxArmed} onClick={c.flux} title="next improving run ×3 suppression"
              style={c.fluxArmed ? { borderColor: '#7DEFFF', color: '#7DEFFF' } : undefined}>
              <Zap size={11} /> {c.fluxArmed ? 'flux armed' : 'flux ×' + fluxN}
            </button>
          </div>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.enemy.boss ? '#FFE27A' : '#FF8B82', letterSpacing: '.06em' }}>
              <Skull size={11} /> {c.enemy.name}{c.enemy.boss ? ' · BOSS' : ''}
            </span>
            <span style={{ color: '#8FA3BC' }}>{c.ehp}/{c.enemy.hp}</span>
          </div>
          <Bar pct={ePct} color={c.enemy.boss ? '#FACC15' : '#C4453F'} />
          {c.enemy.boss && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
              {[1, 2, 3].map(p => (
                <span key={p} style={{ flex: 1, height: 4, borderRadius: 2, transition: 'background .25s', background: p <= (c.phase || 1) ? ((c.phase || 1) >= 3 ? '#FF6B62' : '#FACC15') : '#2A3344' }} />
              ))}
              <span style={{ fontSize: 9, color: '#8FA3BC', letterSpacing: '.12em', marginLeft: 4 }}>PHASE {['I', 'II', 'III'][(c.phase || 1) - 1]}</span>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#76849A', marginTop: 7, display: 'flex', justifyContent: 'space-between' }}>
            <span>winding up{c.tele > 0.85 ? ' — BRACE' : ''}</span>
          </div>
          <Bar pct={c.tele * 100} color={c.tele > 0.85 ? '#FF6B62' : '#3A4A63'} h={4} />
        </div>
      </div>
      {c.feed.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #161D29', paddingTop: 6 }}>
          {c.feed.map(f => (
            <div key={f.id} style={{ fontSize: 11, color: f.cls === 'hit' ? '#FF8B82' : f.cls === 'win' ? '#FFE27A' : '#7CE7A2' }}>{f.txt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlatlineOverlay({ c, onRetreat }) {
  const [loss, setLoss] = useState(null);
  useEffect(() => { setLoss(c.retreatDead()); AudioFX.bad(); }, []); // eslint-disable-line
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,10,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card popin" style={{ maxWidth: 440, padding: 26, textAlign: 'center', borderColor: '#B14A52' }}>
        <Skull size={30} color="#FF6B62" style={{ margin: '0 auto' }} />
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '.12em', color: '#FF8B82', margin: '12px 0 6px' }}>FLATLINED</div>
        <div style={{ fontSize: 13, color: '#B9C6D6', lineHeight: 1.6 }}>
          The {c.enemy.name.toLowerCase()} grinds you into the substrate.
          {loss > 0 ? <> Scavengers strip <b style={{ color: '#FFC76B' }}>{loss} scrap</b> from your kit.</> : null} Your code draft survives — come back leveled, geared, or both.
        </div>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { AudioFX.click(); onRetreat(); }}>
          crawl back <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, val }) {
  return (
    <span style={{ fontSize: 11.5, border: '1px solid #1D2632', borderRadius: 6, padding: '4px 9px', color: '#B9C6D6' }}>
      <span style={{ color: '#76849A' }}>{label} </span>{val}
    </span>
  );
}

function ShopScreen({ save, go, onBuy, onEquip }) {
  const st = derivedStats(save);
  const groups = [['weapon', 'probes'], ['armor', 'suits'], ['tool', 'talismans'], ['consumable', 'rations']];
  return (
    <div style={{ marginTop: 22, maxWidth: 760 }}>
      <button className="lnk" onClick={() => go({ name: 'home' })}><ChevronLeft size={14} /> the fab</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 4px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '.06em' }}>SCRAP EXCHANGE</h2>
        <span style={{ fontSize: 14, color: '#FFC76B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Coins size={14} /> {save.scrap || 0}
        </span>
      </div>
      <div style={{ color: '#76849A', fontSize: 12.5, marginBottom: 12 }}>Scrap in, edge out. Kills pay; flawless kills pay half again.</div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>loadout · Lv {st.lvl}</span>
        <StatChip label="HP" val={st.maxHp} />
        <StatChip label="ATK" val={st.atk} />
        <StatChip label="DEF" val={Math.round(st.defPct * 100) + '%'} />
        {st.lifesteal > 0 && <StatChip label="LEECH" val={'+' + st.lifesteal} />}
        {st.scrapMult > 1 && <StatChip label="SALVAGE" val={'+' + Math.round((st.scrapMult - 1) * 100) + '%'} />}
        {st.timerMult > 1 && <StatChip label="BOSS TIMER" val={'+' + Math.round((st.timerMult - 1) * 100) + '%'} />}
        {st.slowMult > 1 && <StatChip label="ENEMY SLOW" val={Math.round((st.slowMult - 1) * 100) + '%'} />}
        {st.hintBonus > 0 && <StatChip label="HINTS" val={'+' + st.hintBonus} />}
      </div>

      {groups.map(([slot, label]) => (
        <div key={slot}>
          <div className="eyebrow" style={{ margin: '14px 0 8px' }}>{label}</div>
          <div className="twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ITEMS.filter(i => i.slot === slot).map(it => {
              const owned = (save.owned || []).includes(it.id);
              const equipped = save.gear && save.gear[it.slot] === it.id;
              const cnt = it.slot === 'consumable' ? ((save.inv && save.inv[it.inv]) || 0) : null;
              const afford = (save.scrap || 0) >= it.cost;
              return (
                <div key={it.id} className="card" style={{ padding: '12px 14px', borderColor: equipped ? '#155E6B' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</span>
                    {it.cost > 0 && <span style={{ fontSize: 11, color: '#FFC76B', marginLeft: 'auto' }}>{it.cost} ⛁</span>}
                    {cnt !== null && <span style={{ fontSize: 11, color: '#76849A', marginLeft: it.cost > 0 ? 0 : 'auto' }}>held ×{cnt}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8A93A3', margin: '5px 0 9px', lineHeight: 1.5 }}>{it.blurb}</div>
                  {it.slot === 'consumable' ? (
                    <button className="btn sm" disabled={!afford || cnt >= 5} onClick={() => onBuy(it.id)}>buy · {it.name}</button>
                  ) : equipped ? (
                    <span style={{ fontSize: 11, letterSpacing: '.14em', color: '#7DEFFF' }}>EQUIPPED</span>
                  ) : owned ? (
                    <button className="btn sm" onClick={() => onEquip(it.id)}>equip {it.name}</button>
                  ) : (
                    <button className="btn sm" disabled={!afford} onClick={() => onBuy(it.id)}>buy · {it.name}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#5A6A80', marginTop: 14 }}>Stats come from level (XP) and gear. Defeats cost scrap — the work itself is never lost.</div>
    </div>
  );
}

function LevelUpModal({ info, save, onClose }) {
  const st = derivedStats(save);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(4,6,10,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card popin" style={{ maxWidth: 420, padding: 26, textAlign: 'center', borderColor: '#155E6B' }}>
        <div className="eyebrow" style={{ color: '#7DEFFF' }}>promotion</div>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '.1em', margin: '10px 0 4px', color: '#E8F1FA' }}>
          Lv {info.from} <span style={{ color: '#5A6A80' }}>→</span> <span style={{ color: '#7DEFFF' }}>Lv {info.to}</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#B9C6D6', margin: '6px 0 14px' }}>+14 max HP · +4 ATK per level</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <StatChip label="HP" val={st.maxHp} />
          <StatChip label="ATK" val={st.atk} />
          <StatChip label="DEF" val={Math.round(st.defPct * 100) + '%'} />
        </div>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { AudioFX.click(); onClose(); }}>onward <ChevronRight size={13} /></button>
      </div>
    </div>
  );
}

export {
  useCombat, Bar, CombatHUD, FlatlineOverlay, StatChip, ShopScreen, LevelUpModal,
};

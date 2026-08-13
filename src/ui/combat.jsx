import { useEffect, useMemo, useRef, useState } from "react";
import { AudioFX } from '../audio/index.js';
import { bossPhase } from '../engine/debug/diagnostics.js';
import { derivedStats } from '../game/rpg.js';
import { FR } from '../telemetry/flight-recorder.js';
import { VictoryReport } from './victory/VictoryReport.jsx';
import { Button } from './components/Button.jsx';
import { Badge } from './components/Badge.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { ShopBay } from './shop/ShopBay.jsx';
import {
  FlaskMark, HeartMark, SkullMark, SparkMark, SwordMark,
} from './components/icons.jsx';

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
  const [loot, setLoot] = useState(null);
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
      const phaseName = enemy.bossSpec?.phases?.[np - 1] || (np >= 3 ? 'LAST STAND' : 'ENRAGED');
      push(`${enemy.name} — ${phaseName} · PHASE ${np === 3 ? 'III' : 'II'}`, 'boss');
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
    setLoot({ kind: 'win', scrap, flawless: flaw });
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
    setLoot({ kind: 'dead', scrapLoss: loss });
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

  return { live: live0, stats, enemy, php, ehp, tele, feed, over, loot, dead: over === 'dead', won: over === 'won', fluxArmed, onRun, onAnswer, victory, retreatDead, potion, flux, phase, phaseT };
}

function Bar({ pct, tone, size }) {
  const t = tone || (pct > 50 ? 'ok' : pct > 25 ? 'brass' : 'danger');
  return <ProgressBar value={pct} tone={t} size={size} />;
}

function CombatHUD({ c, save }) {
  if (!c) return null;
  if (!c.live) {
    return (
      <div className="sg-combat" data-combat-hud="1" data-live="0">
        <span className="sg-combat__name"><SwordMark size={13} /> sparring — already cleared, the {c.enemy.name.toLowerCase()} won't bite</span>
      </div>
    );
  }
  const hpPct = c.php / c.stats.maxHp * 100;
  const ePct = c.ehp / c.enemy.hp * 100;
  const pots = (save.inv && save.inv.potions) || 0;
  const fluxN = (save.inv && save.inv.flux) || 0;
  const hpTone = hpPct > 50 ? 'ok' : hpPct > 25 ? 'brass' : 'danger';
  return (
    <div className="sg-combat" data-combat-hud="1" data-live="1" data-boss={c.enemy.boss ? '1' : '0'}>
      <div className="sg-combat__row">
        <div className="sg-combat__col">
          <div className="sg-combat__label">
            <span className="sg-combat__name"><HeartMark size={11} /> ENGINEER · Lv {c.stats.lvl}</span>
            <span>{c.php}/{c.stats.maxHp}</span>
          </div>
          <Bar pct={hpPct} tone={hpTone} />
          <div className="sg-combat__acts">
            <Button size="sm" disabled={pots <= 0} onClick={c.potion} title="restore 40 HP" icon={<FlaskMark size={11} />}>
              ration ×{pots}
            </Button>
            <Button
              size="sm"
              variant={c.fluxArmed ? 'primary' : 'default'}
              disabled={fluxN <= 0 || c.fluxArmed}
              onClick={c.flux}
              title="next improving run ×3 suppression"
              icon={<SparkMark size={11} />}
            >
              {c.fluxArmed ? 'flux armed' : 'flux ×' + fluxN}
            </Button>
          </div>
        </div>
        <div className="sg-combat__col">
          <div className="sg-combat__label">
            <span className={`sg-combat__name ${c.enemy.boss ? 'is-boss' : 'is-foe'}`}>
              <SkullMark size={11} /> {c.enemy.name}{c.enemy.boss ? ' · BOSS' : ''}
            </span>
            <span>{c.ehp}/{c.enemy.hp}</span>
          </div>
          <Bar pct={ePct} tone={c.enemy.boss ? 'brass' : 'danger'} />
          {c.enemy.boss && (
            <div className="sg-combat__phases">
              {[1, 2, 3].map((p) => (
                <span
                  key={p}
                  className={`sg-combat__pip${p <= (c.phase || 1) ? ' is-on' : ''}${(c.phase || 1) >= 3 && p <= (c.phase || 1) ? ' is-last' : ''}`}
                />
              ))}
              <span className="sg-eyebrow">PHASE {['I', 'II', 'III'][(c.phase || 1) - 1]}</span>
            </div>
          )}
          {c.enemy.boss && c.enemy.bossSpec?.mechanic?.[Math.max(0, (c.phase || 1) - 1)] && (
            <div className="sg-combat__mech">
              {c.enemy.bossSpec.mechanic[Math.max(0, (c.phase || 1) - 1)]}
            </div>
          )}
          <div className="sg-combat__tele">
            <span>winding up{c.tele > 0.85 ? ' — BRACE' : ''}</span>
          </div>
          <Bar pct={c.tele * 100} tone={c.tele > 0.85 ? 'danger' : 'cyan'} size="sm" />
        </div>
      </div>
      {c.feed.length > 0 && (
        <div className="sg-combat__feed">
          {c.feed.map((f) => (
            <div key={f.id} className={`sg-combat__feed-line${f.cls === 'hit' ? ' is-hit' : f.cls === 'win' ? ' is-win' : ''}`}>{f.txt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, val }) {
  return <Badge>{label} {val}</Badge>;
}

function ShopScreen(props) {
  return <ShopBay {...props} />;
}

function FlatlineOverlay({ c, onRetreat }) {
  const [loss, setLoss] = useState(null);
  useEffect(() => { setLoss(c.retreatDead()); AudioFX.bad(); }, []); // eslint-disable-line
  const stripped = loss == null ? (c.loot && c.loot.scrapLoss) || 0 : loss;
  return (
    <VictoryReport
      overlay
      tone="danger"
      kicker="probe fail · substrate dump"
      title="FLATLINED"
      body={(
        <>
          The {c.enemy.name.toLowerCase()} grinds you into the substrate.
          {stripped > 0 ? <> Scavengers strip {stripped} scrap from your kit.</> : null}
          {' '}Your code draft survives — come back leveled, geared, or both.
        </>
      )}
      stats={[
        { id: 'loss', label: 'stripped', value: stripped, prefix: '−', accent: 'danger' },
        { id: 'draft', label: 'code draft', value: 'kept', accent: 'cyan' },
      ]}
      meta={[
        { label: 'hostile', value: c.enemy.name },
        { label: 'result', value: 'probe fail' },
        { label: 'draft', value: 'kept' },
      ]}
      meter={{ label: 'integrity', value: 0, suffix: '%' }}
      primary={{ label: 'crawl back', onClick: () => { AudioFX.click(); onRetreat(); } }}
      hint="ENTER · crawl back"
    />
  );
}

function LevelUpModal({ info, save, onClose }) {
  const st = derivedStats(save);
  return (
    <VictoryReport
      overlay
      tone="ok"
      kicker="promotion · process credit"
      title={`Lv ${info.from} → ${info.to}`}
      body="+14 max HP · +4 ATK per level. The fab expects more of you now."
      stats={[
        { id: 'hp', label: 'HP', value: st.maxHp, accent: 'ok' },
        { id: 'atk', label: 'ATK', value: st.atk, accent: 'cyan' },
        { id: 'def', label: 'DEF', value: `${Math.round(st.defPct * 100)}%`, accent: 'brass' },
      ]}
      meta={[
        { label: 'from', value: `Lv ${info.from}` },
        { label: 'to', value: `Lv ${info.to}` },
        { label: 'delta', value: '+14 HP · +4 ATK' },
      ]}
      meter={{ label: 'rank', value: 100, suffix: '%' }}
      primary={{ label: 'onward', onClick: () => { AudioFX.click(); onClose(); } }}
      hint="ENTER · onward"
    />
  );
}

export {
  useCombat, Bar, CombatHUD, FlatlineOverlay, StatChip, ShopScreen, LevelUpModal,
};

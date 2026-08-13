import { useMemo, useState } from 'react';
import { TOKEN_CSS } from '../tokens.js';
import { derivedStats, ITEMS, ITEM_BY_ID } from '../../game/rpg.js';
import { Button } from '../components/Button.jsx';
import { Panel } from '../components/Panel.jsx';
import { Badge } from '../components/Badge.jsx';
import { ListRow } from '../components/ListRow.jsx';
import { StatBlock } from '../components/StatBlock.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import { BackMark, CoinMark, ChipMark } from '../components/icons.jsx';

const SLOTS = [
  { id: 'weapon', label: 'probes' },
  { id: 'armor', label: 'suits' },
  { id: 'tool', label: 'talismans' },
  { id: 'consumable', label: 'rations' },
];

const SHOP_CSS = `
  .sx-root{ position:fixed;inset:0;z-index:40;overflow:auto; }
  .sx-shell{
    position:relative;z-index:1;
    width:min(1280px,94vw);margin:0 auto;
    min-height:calc(100vh - 48px);
    display:grid;grid-template-rows:auto auto 1fr auto;
    gap:clamp(12px,1.8vh,20px);
    padding:clamp(16px,2.4vh,32px) 0 28px;
  }
  .sx-grid{
    display:grid;
    grid-template-columns:minmax(220px,.8fr) minmax(0,1.4fr) minmax(240px,.9fr);
    gap:14px;align-items:stretch;
  }
  .sx-plate,.sx-hero,.sx-rack{
    min-height:320px;
  }
  .sx-hero{
    clip-path:polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
  }
  .sx-hero__name{
    font-family:var(--sg-font-display);font-size:clamp(22px,3.2vw,36px);
    letter-spacing:.08em;text-transform:uppercase;color:var(--sg-ink);
    margin:4px 0 8px;line-height:1.05;
  }
  .sx-hero__blurb{ color:var(--sg-ink-muted); font-size:14px; line-height:1.55; margin:0 0 18px; max-width:42ch; }
  .sx-compare{ display:flex; gap:18px; flex-wrap:wrap; margin:16px 0 20px; }
  .sx-rack{ display:flex; flex-direction:column; gap:8px; }
  .sx-load{ display:flex; gap:16px; flex-wrap:wrap; }
  @media (max-width:980px){
    .sx-grid{ grid-template-columns:1fr; }
  }
`;

function fmtDelta(n, suffix = '') {
  if (!n) return null;
  const sign = n > 0 ? '+' : '−';
  return `${sign}${Math.abs(n)}${suffix}`;
}

function itemStats(it) {
  if (!it) return { atk: 0, hp: 0, def: 0, extra: [] };
  const extra = [];
  if (it.lifesteal) extra.push(`leech ${it.lifesteal}`);
  if (it.scrapMult) extra.push(`salvage +${Math.round((it.scrapMult - 1) * 100)}%`);
  if (it.timer) extra.push(`boss timer +${Math.round((it.timer - 1) * 100)}%`);
  if (it.slow) extra.push(`slow +${Math.round((it.slow - 1) * 100)}%`);
  if (it.hint) extra.push(`hints +${it.hint}`);
  if (it.heal) extra.push(`heal ${it.heal}`);
  return {
    atk: it.atk || 0,
    hp: it.hp || 0,
    def: Math.round((it.def || 0) * 100),
    extra,
  };
}

function ShopBay({ save, go, onBuy, onEquip, still = false, initialSlot = 'weapon' }) {
  const st = derivedStats(save);
  const [slot, setSlot] = useState(initialSlot);
  const catalog = useMemo(
    () => ITEMS.filter((i) => i.slot === slot && (!i.remembrance || (save.owned || []).includes(i.id))),
    [slot, save.owned],
  );
  const [selId, setSelId] = useState(() => catalog[0] && catalog[0].id);
  const selected = ITEM_BY_ID[selId] && ITEM_BY_ID[selId].slot === slot
    ? ITEM_BY_ID[selId]
    : catalog[0];
  const equippedId = selected && selected.slot !== 'consumable'
    ? (save.gear && save.gear[selected.slot])
    : null;
  const equipped = equippedId ? ITEM_BY_ID[equippedId] : null;
  const owned = selected ? (save.owned || []).includes(selected.id) : false;
  const isEq = selected && equippedId === selected.id;
  const cnt = selected && selected.slot === 'consumable' ? ((save.inv && save.inv[selected.inv]) || 0) : null;
  const afford = selected ? (save.scrap || 0) >= selected.cost : false;
  const next = itemStats(selected);
  const cur = itemStats(equipped && selected && equipped.slot === selected.slot ? equipped : null);

  const pickSlot = (id) => {
    setSlot(id);
    const first = ITEMS.find((i) => i.slot === id && (!i.remembrance || (save.owned || []).includes(i.id)));
    setSelId(first ? first.id : null);
  };

  return (
    <div className="sg-ui sx-root sg-enter" data-shop-status="ready" data-shop-still={still ? '1' : '0'}>
      <style>{TOKEN_CSS}</style>
      <style>{SHOP_CSS}</style>
      <div className="sx-shell">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-brass)' }}>scrap exchange · loadout bay</div>
            <h1 className="sg-display" style={{ margin: '8px 0 6px', fontSize: 'clamp(28px,5vw,48px)', lineHeight: 1 }}>
              SCRAP EXCHANGE
            </h1>
            <p style={{ margin: 0, color: 'var(--sg-ink-muted)', maxWidth: 560 }}>
              Comparison plate, not a storefront grid. Equip against the current probe / suit / talisman.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone="brass">
              <CoinMark size={12} /> {save.scrap || 0} scrap
            </Badge>
            <Badge tone="cyan">Lv {st.lvl}</Badge>
            <Button variant="ghost" size="sm" icon={<BackMark size={13} />} onClick={() => go && go({ name: 'home' })}>
              the fab
            </Button>
          </div>
        </header>

        <Tabs
          value={slot}
          onChange={pickSlot}
          aria-label="equipment slots"
          tabs={SLOTS}
        />

        <div className="sx-grid">
          <Panel title="Loadout" className="sx-plate" tight>
            <div className="sx-load">
              <StatBlock label="HP" value={st.maxHp} tone="ok" />
              <StatBlock label="ATK" value={st.atk} tone="cyan" />
              <StatBlock label="DEF" value={`${Math.round(st.defPct * 100)}%`} tone="brass" />
            </div>
            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              {['weapon', 'armor', 'tool'].map((s) => {
                const id = save.gear && save.gear[s];
                const it = id ? ITEM_BY_ID[id] : null;
                return (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                    <span className="sg-eyebrow">{s}</span>
                    <span style={{ color: it ? 'var(--sg-ink)' : 'var(--sg-ink-dim)' }}>{it ? it.name : '—'}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="sg-eyebrow">rations</span>
                <span>solder ×{(save.inv && save.inv.potions) || 0} · flux ×{(save.inv && save.inv.flux) || 0}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Comparison plate" className="sx-hero" wide>
            {selected ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {isEq && <Badge tone="cyan">equipped</Badge>}
                  {owned && !isEq && selected.slot !== 'consumable' && <Badge>owned</Badge>}
                  {selected.remembrance && <Badge tone="brass">remembrance</Badge>}
                  {cnt != null && <Badge tone="ok">held ×{cnt}</Badge>}
                </div>
                <h2 className="sx-hero__name">{selected.name}</h2>
                <p className="sx-hero__blurb">{selected.blurb}</p>
                <div className="sx-compare">
                  <StatBlock
                    label="ATK"
                    value={next.atk}
                    tone="cyan"
                    delta={selected.slot === 'weapon' ? fmtDelta(next.atk - cur.atk) : null}
                  />
                  <StatBlock
                    label="HP"
                    value={next.hp}
                    tone="ok"
                    delta={selected.slot === 'armor' ? fmtDelta(next.hp - cur.hp) : null}
                  />
                  <StatBlock
                    label="DEF"
                    value={`${next.def}%`}
                    tone="brass"
                    delta={selected.slot === 'armor' ? fmtDelta(next.def - cur.def, '%') : null}
                  />
                </div>
                {next.extra.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {next.extra.map((x) => <Badge key={x} tone="cyan">{x}</Badge>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.slot === 'consumable' ? (
                    <Tooltip label={afford ? 'buy one ration' : 'not enough scrap'}>
                      <Button
                        variant="brass"
                        disabled={!afford || cnt >= 5}
                        onClick={() => onBuy && onBuy(selected.id)}
                      >
                        buy · {selected.cost} scrap
                      </Button>
                    </Tooltip>
                  ) : isEq ? (
                    <Badge tone="cyan">on the floor</Badge>
                  ) : owned ? (
                    <Button variant="primary" icon={<ChipMark size={14} />} onClick={() => onEquip && onEquip(selected.id)}>
                      equip {selected.name}
                    </Button>
                  ) : (
                    <Button
                      variant="brass"
                      disabled={!afford}
                      onClick={() => onBuy && onBuy(selected.id)}
                    >
                      buy · {selected.cost} scrap
                    </Button>
                  )}
                  {selected.cost > 0 && <span className="sg-eyebrow">{selected.cost} ⛁</span>}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--sg-ink-dim)' }}>Empty rack.</p>
            )}
          </Panel>

          <Panel title="Rack" className="sx-rack" tight>
            <div className="sx-rack">
              {catalog.map((it) => {
                const eq = save.gear && save.gear[it.slot] === it.id;
                const have = (save.owned || []).includes(it.id);
                const held = it.slot === 'consumable' ? ((save.inv && save.inv[it.inv]) || 0) : null;
                return (
                  <ListRow
                    key={it.id}
                    title={it.name}
                    hint={eq ? 'equipped' : have ? 'owned' : it.blurb}
                    meta={held != null ? `×${held}` : it.cost > 0 ? `${it.cost} ⛁` : '—'}
                    active={selected && selected.id === it.id}
                    equipped={eq}
                    onClick={() => setSelId(it.id)}
                  />
                );
              })}
            </div>
          </Panel>
        </div>

        <footer className="sg-eyebrow" style={{ textAlign: 'center' }}>
          Stats from level and gear. Defeats cost scrap — the work itself is never lost.
        </footer>
      </div>
    </div>
  );
}

export { ShopBay, SLOTS };

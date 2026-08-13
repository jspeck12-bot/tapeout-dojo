import { useEffect, useState } from 'react';
import { ITEM_BY_ID } from '../game/rpg.js';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { Button } from './components/Button.jsx';
import { ShopBay } from './shop/ShopBay.jsx';

const SHOP_DEMO_SAVE = {
  xp: 420,
  scrap: 640,
  owned: ['w_iron', 'a_cloth', 'w_copper', 'a_wrap', 't_jtag', 't_scope'],
  gear: { weapon: 'w_iron', armor: 'a_wrap', tool: 't_jtag' },
  inv: { potions: 2, flux: 1 },
};

const SCENES = {
  probes: { id: 'probes', label: 'PROBES', slot: 'weapon' },
  suits: { id: 'suits', label: 'SUITS', slot: 'armor' },
  talismans: { id: 'talismans', label: 'TALISMANS', slot: 'tool' },
  rations: { id: 'rations', label: 'RATIONS', slot: 'consumable' },
};

function shopSceneFromUrl() {
  if (typeof window === 'undefined') return 'probes';
  const scene = new URLSearchParams(window.location.search).get('scene');
  return scene && SCENES[scene] ? scene : 'probes';
}

function shopStillFromUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('still') === '1';
}

function ShopScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [sceneId, setSceneId] = useState(() => shopSceneFromUrl());
  const stillMode = shopStillFromUrl();
  const [save, setSave] = useState(() => ({
    ...SHOP_DEMO_SAVE,
    owned: [...SHOP_DEMO_SAVE.owned],
    gear: { ...SHOP_DEMO_SAVE.gear },
    inv: { ...SHOP_DEMO_SAVE.inv },
  }));

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { }
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  const onBuy = (iid) => {
    const it = ITEM_BY_ID[iid];
    if (!it) return;
    AudioFX.good();
    setSave((s) => {
      if ((s.scrap || 0) < it.cost) return s;
      if (it.slot === 'consumable') {
        const held = (s.inv && s.inv[it.inv]) || 0;
        if (held >= 5) return s;
        return {
          ...s,
          scrap: s.scrap - it.cost,
          inv: { ...s.inv, [it.inv]: held + 1 },
        };
      }
      if (s.owned.includes(iid)) return s;
      return {
        ...s,
        scrap: s.scrap - it.cost,
        owned: [...s.owned, iid],
        gear: { ...s.gear, [it.slot]: iid },
      };
    });
  };

  const onEquip = (iid) => {
    const it = ITEM_BY_ID[iid];
    if (!it) return;
    AudioFX.click();
    setSave((s) => (s.owned.includes(iid) ? { ...s, gear: { ...s.gear, [it.slot]: iid } } : s));
  };

  const scene = SCENES[sceneId];

  return (
    <div
      className="sg-ui"
      data-shop-status={stage}
      data-shop-scene={sceneId}
      data-shop-still={stillMode ? '1' : '0'}
      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
    >
      {!stillMode && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', gap: 6 }}>
          {Object.values(SCENES).map((sc) => (
            <Button key={sc.id} size="sm" variant={sceneId === sc.id ? 'brass' : 'ghost'} onClick={() => setSceneId(sc.id)}>
              {sc.label}
            </Button>
          ))}
        </div>
      )}
      <ShopBay
        key={sceneId}
        initialSlot={scene.slot}
        save={save}
        go={go}
        onBuy={onBuy}
        onEquip={onEquip}
        still={stillMode}
      />
    </div>
  );
}

export { ShopScreen, SHOP_DEMO_SAVE, SCENES };

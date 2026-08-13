import { useEffect, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { Button } from './components/Button.jsx';
import { SettingsPanel } from './settings/SettingsPanel.jsx';

const SETTINGS_DEMO_SAVE = {
  xp: 420,
  scrap: 186,
  sound: true,
  mode: 'engineer',
  ngplus: false,
  tapeoutDone: true,
};

const SCENES = {
  graphics: { id: 'graphics', label: 'GRAPHICS' },
  difficulty: { id: 'difficulty', label: 'DIFFICULTY' },
  audio: { id: 'audio', label: 'AUDIO' },
  search: { id: 'search', label: 'SEARCH', group: 'graphics', query: 'bloom' },
};

function settingsSceneFromUrl() {
  if (typeof window === 'undefined') return 'graphics';
  const scene = new URLSearchParams(window.location.search).get('scene');
  return scene && SCENES[scene] ? scene : 'graphics';
}

function settingsStillFromUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('still') === '1';
}

function SettingsScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [sceneId, setSceneId] = useState(() => settingsSceneFromUrl());
  const stillMode = settingsStillFromUrl();
  const [save, setSave] = useState({ ...SETTINGS_DEMO_SAVE });
  const [gfx, setGfx] = useState({
    exposure: 1.08, lights: 1.1, ambient: 0.92, fog: 0.032, normal: 0.95, glow: 0.7, bloom: 0.58,
  });
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { }
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  const scene = SCENES[sceneId];

  return (
    <div
      className="sg-ui"
      data-settings-status={stage}
      data-settings-scene={sceneId}
      data-settings-still={stillMode ? '1' : '0'}
      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
    >
      {!stillMode && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 6, display: 'flex', gap: 6 }}>
          {Object.values(SCENES).map((sc) => (
            <Button key={sc.id} size="sm" variant={sceneId === sc.id ? 'primary' : 'ghost'} onClick={() => setSceneId(sc.id)}>
              {sc.label}
            </Button>
          ))}
        </div>
      )}
      <SettingsPanel
        key={sceneId}
        save={save}
        gfx={gfx}
        setGfx={setGfx}
        setMode={(id) => { AudioFX.click(); setSave((s) => ({ ...s, mode: id })); }}
        toggleNg={() => { AudioFX.click(); setSave((s) => ({ ...s, ngplus: !s.ngplus })); }}
        toggleSound={() => { AudioFX.click(); setSave((s) => ({ ...s, sound: !s.sound })); }}
        resetArmed={resetArmed}
        setResetArmed={setResetArmed}
        resetAll={() => setResetArmed(false)}
        activeSlot={1}
        go={go}
        onClose={() => go && go({ name: 'menu' })}
        onFlightReport={() => {}}
        onFlightNote={() => {}}
        still={stillMode}
        seedGroup={scene.group || scene.id}
        seedQuery={scene.query || ''}
      />
    </div>
  );
}

export { SettingsScreen, SETTINGS_DEMO_SAVE, SCENES };

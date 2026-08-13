import { useEffect, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { HudMark } from './components/icons.jsx';
import { ExploreHud } from './hud/ExploreHud.jsx';

/** Demo wafer for `?screen=hud` stills — mid-run operator vitals. */
const HUD_DEMO_SAVE = {
  xp: 420,
  scrap: 186,
};

const SCENES = {
  explore: {
    id: 'explore',
    label: 'EXPLORE',
    zone: 'THE FOUNDRY FLOOR',
    prompt: { text: '[E] ENGAGE STATION · #3 NAND ARRAY', locked: false },
    showHelp: false,
    helpTitle: '',
    helpBody: '',
    accent: 'brass',
    fakeMinimap: false,
  },
  help: {
    id: 'help',
    label: 'HELP',
    zone: 'THE FOUNDRY FLOOR',
    prompt: null,
    showHelp: true,
    helpTitle: 'shaft access granted',
    helpBody: 'Click to capture the mouse. WASD walks, Shift sprints, E engages. Clear the hall to unseal the gate — the boss waits beyond it.',
    accent: 'brass',
    fakeMinimap: false,
  },
  sealed: {
    id: 'sealed',
    label: 'SEALED',
    zone: 'GATE THRESHOLD',
    prompt: { text: 'SEALED — clear the hall first', locked: true },
    showHelp: false,
    helpTitle: '',
    helpBody: '',
    accent: 'danger',
    fakeMinimap: false,
  },
  campus: {
    id: 'campus',
    label: 'CAMPUS',
    zone: 'ARRIVAL WALK',
    prompt: { text: '[E] OPEN BIT MINES CONSOLE', locked: false },
    showHelp: false,
    helpTitle: '',
    helpBody: '',
    accent: 'cyan',
    fakeMinimap: true,
  },
};

function hudSceneFromUrl() {
  if (typeof window === 'undefined') return 'explore';
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('scene');
  return scene && SCENES[scene] ? scene : 'explore';
}

function hudStillFromUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('still') === '1';
}

function HudScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [sceneId, setSceneId] = useState(() => hudSceneFromUrl());
  const stillMode = hudStillFromUrl();
  const scene = SCENES[sceneId];

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { /* optional */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="sg-ui hs-root" data-hud-status={stage} data-hud-scene={sceneId} data-hud-still={stillMode ? '1' : '0'}>
      <style>{TOKEN_CSS}</style>
      <style>{`
        .hs-root{
          position:fixed;inset:0;z-index:40;overflow:hidden;
        }
        .hs-stage{
          position:absolute;inset:0;
          background:
            radial-gradient(90% 70% at 50% 28%,
              color-mix(in srgb, var(--sg-brass) 16%, transparent) 0%,
              transparent 55%),
            radial-gradient(70% 60% at 78% 78%,
              color-mix(in srgb, var(--sg-cyan-deep) 14%, transparent) 0%,
              transparent 50%),
            linear-gradient(180deg,
              var(--sg-bg-wash) 0%,
              var(--sg-bg) 42%,
              var(--sg-bg-deep) 100%);
        }
        .hs-stage::before{
          content:"";position:absolute;inset:0;pointer-events:none;opacity:.35;
          background-image:
            linear-gradient(color-mix(in srgb, var(--sg-line) 55%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-line) 55%, transparent) 1px, transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse at 50% 45%, #000 20%, transparent 72%);
        }
        .hs-landmark{
          position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);
          width:min(42vw,520px);aspect-ratio:4/5;pointer-events:none;
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--sg-bg-panel) 40%, transparent) 0%,
              color-mix(in srgb, var(--sg-brass-deep) 28%, var(--sg-bg-deep)) 100%);
          border:1px solid color-mix(in srgb, var(--sg-brass) 35%, var(--sg-line));
          box-shadow:
            0 0 80px color-mix(in srgb, var(--sg-brass) 18%, transparent),
            inset 0 0 40px color-mix(in srgb, var(--sg-bg) 50%, transparent);
          clip-path:polygon(18% 0, 82% 0, 100% 22%, 88% 100%, 12% 100%, 0 22%);
        }
        .hs-landmark::after{
          content:"STACK";position:absolute;left:50%;bottom:14%;transform:translateX(-50%);
          font-family:var(--sg-font-display);letter-spacing:.28em;font-size:11px;
          color:color-mix(in srgb, var(--sg-brass) 70%, var(--sg-ink-dim));
        }
        .hs-path{
          position:absolute;left:50%;bottom:0;transform:translateX(-50%);
          width:min(18vw,160px);height:42%;
          background:linear-gradient(180deg,
            transparent 0%,
            color-mix(in srgb, var(--sg-brass) 22%, transparent) 40%,
            color-mix(in srgb, var(--sg-brass) 40%, transparent) 100%);
          filter:blur(0.2px);
          pointer-events:none;
        }
        .hs-dock{
          position:absolute;left:12px;top:52px;z-index:30;
          max-width:min(360px,calc(100vw - 24px));
          pointer-events:none;
        }
        .hs-dock > *{ pointer-events:auto; }
        .hs-kicker{
          font-family:var(--sg-font-mono);font-size:10px;letter-spacing:.18em;
          color:var(--sg-cyan);text-transform:uppercase;
        }
        .hs-title{
          margin:2px 0 4px;
          font-family:var(--sg-font-display);font-weight:600;font-size:16px;
          letter-spacing:.1em;color:var(--sg-ink);
        }
        .hs-copy{
          font-size:11.5px;color:var(--sg-ink-muted);line-height:1.45;margin:0 0 8px;
        }
        .hs-scenes{ display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px; }
        .hs-actions{ display:flex;gap:6px;flex-wrap:wrap; }
        @media (max-width:720px){
          .hs-landmark{ width:min(70vw,360px);top:34%; }
          .hs-dock{ top:auto;bottom:12px;max-width:calc(100vw - 24px); }
        }
      `}</style>

      <div className="hs-stage" aria-hidden="true">
        <div className="hs-landmark" />
        <div className="hs-path" />
      </div>

      <ExploreHud
        accent={scene.accent}
        save={HUD_DEMO_SAVE}
        zone={scene.zone}
        prompt={scene.prompt}
        showHelp={scene.showHelp}
        helpTitle={scene.helpTitle}
        helpBody={scene.helpBody}
        onDismissHelp={() => setSceneId('explore')}
        showMap
        fakeMinimap={!!scene.fakeMinimap}
        onMenu={() => { AudioFX.click(); go({ name: 'menu' }); }}
        onMap={() => { AudioFX.click(); }}
        onSettings={() => { AudioFX.click(); }}
        onGraphics={() => { AudioFX.click(); }}
      />

      {!stillMode && (
        <div className="hs-dock">
          <Panel tight className="hs-legend">
            <div className="hs-kicker">operator hud · silicon gothic</div>
            <h1 className="hs-title">OPERATOR HUD</h1>
            <p className="hs-copy">
              Fab-equipment chrome for exploration — vitals, zone plaque, reticle, engage prompt, help, radar.
            </p>
            <div className="hs-scenes" role="group" aria-label="hud scenes">
              {Object.values(SCENES).map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={sceneId === item.id ? 'brass' : 'ghost'}
                  icon={sceneId === item.id ? <HudMark size={12} /> : null}
                  onClick={() => { AudioFX.click(); setSceneId(item.id); }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="hs-actions">
              <Button size="sm" variant="ghost" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
                main menu
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<HudMark size={12} />}
                onClick={() => { AudioFX.click(); go({ name: 'campus' }); }}
              >
                walk the fab
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export { HudScreen, HUD_DEMO_SAVE, SCENES };

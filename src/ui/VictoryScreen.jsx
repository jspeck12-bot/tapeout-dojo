import { useEffect, useState } from 'react';
import {
  AudioFX, musicEnsure, musicSetState, musicSetTrack,
} from '../audio/index.js';
import { TOKEN_CSS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { FailMark, YieldMark } from './components/icons.jsx';
import { VictoryReport } from './victory/VictoryReport.jsx';

const SCENES = {
  signoff: {
    id: 'signoff',
    label: 'SIGNOFF',
    tone: 'ok',
    kicker: 'yield report · station #3',
    title: 'SIGNED OFF',
    body: 'NAND ARRAY compiles clean. The testbench signed the lot. Reclaimed metal is in the hopper — the work itself is in the record.',
    stars: 2,
    stats: [
      { id: 'scrap', label: 'reclaimed', value: 38, prefix: '+', accent: 'brass' },
      { id: 'xp', label: 'process credit', value: 40, prefix: '+', accent: 'ok' },
      { id: 'bins', label: 'probe bins', value: '2 / 3', accent: 'cyan' },
    ],
    primary: { label: 'back to Gate Valley' },
    secondary: { label: 'inspect hardware' },
    hint: 'ENTER · continue',
  },
  flawless: {
    id: 'flawless',
    label: 'ZERO DEFECT',
    tone: 'brass',
    kicker: 'bin-1 yield · flawless ×1.5',
    title: 'ZERO DEFECT',
    body: 'Five for five — not a single missed bit. Salvage pays half again. The hopper rings.',
    stars: 3,
    stats: [
      { id: 'scrap', label: 'reclaimed', value: 57, prefix: '+', accent: 'brass' },
      { id: 'xp', label: 'process credit', value: 35, prefix: '+', accent: 'ok' },
      { id: 'mult', label: 'yield', value: '×1.5', accent: 'brass' },
    ],
    primary: { label: 'onward' },
    secondary: { label: 'run it again', hotkey: 'r' },
    hint: 'ENTER · onward   ·   R · reprobe',
  },
  boss: {
    id: 'boss',
    label: 'BOSS',
    tone: 'brass',
    kicker: 'lot closed · boss destroyed',
    title: 'THE HIERARCH',
    body: 'Module Foundry gate unseals. A remembrance waits in the scrap hopper. The floor remembers who signed this lot.',
    stars: 3,
    stats: [
      { id: 'scrap', label: 'reclaimed', value: 186, prefix: '+', accent: 'brass' },
      { id: 'xp', label: 'process credit', value: 220, prefix: '+', accent: 'ok' },
      { id: 'phase', label: 'phases', value: 'III', accent: 'brass' },
    ],
    primary: { label: 'claim remembrance' },
    secondary: { label: 'back to the floor' },
    hint: 'ENTER · claim',
  },
  flatline: {
    id: 'flatline',
    label: 'FLATLINE',
    tone: 'danger',
    kicker: 'probe fail · substrate dump',
    title: 'FLATLINED',
    body: 'The NAND Golem grinds you into the substrate. Scavengers strip scrap from your kit. Your code draft survives — come back leveled, geared, or both.',
    stars: null,
    stats: [
      { id: 'loss', label: 'stripped', value: 24, prefix: '−', accent: 'danger' },
      { id: 'draft', label: 'code draft', value: 'kept', accent: 'cyan' },
    ],
    primary: { label: 'crawl back' },
    secondary: null,
    hint: 'ENTER · crawl back',
  },
  levelup: {
    id: 'levelup',
    label: 'PROMOTE',
    tone: 'ok',
    kicker: 'promotion · process credit',
    title: 'Lv 4 → 5',
    body: '+14 max HP · +4 ATK per level. The fab expects more of you now.',
    stars: null,
    stats: [
      { id: 'hp', label: 'HP', value: 156, accent: 'ok' },
      { id: 'atk', label: 'ATK', value: 36, accent: 'cyan' },
      { id: 'def', label: 'DEF', value: '0%', accent: 'brass' },
    ],
    primary: { label: 'onward' },
    secondary: null,
    hint: 'ENTER · onward',
  },
};

function victorySceneFromUrl() {
  if (typeof window === 'undefined') return 'signoff';
  const scene = new URLSearchParams(window.location.search).get('scene');
  return scene && SCENES[scene] ? scene : 'signoff';
}

function victoryStillFromUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('still') === '1';
}

function VictoryScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [sceneId, setSceneId] = useState(() => victorySceneFromUrl());
  const stillMode = victoryStillFromUrl();
  const scene = SCENES[sceneId];

  useEffect(() => {
    try { musicEnsure(); musicSetTrack('cold_cathode'); musicSetState('menu'); } catch (e) { /* optional */ }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (stillMode) return undefined;
    if (sceneId === 'flatline') AudioFX.bad();
    else AudioFX.win();
    return undefined;
  }, [sceneId, stillMode]);

  return (
    <div
      className="sg-ui vs-root"
      data-victory-status={stage}
      data-victory-scene={sceneId}
      data-victory-still={stillMode ? '1' : '0'}
    >
      <style>{TOKEN_CSS}</style>
      <style>{`
        .vs-root{
          position:fixed;inset:0;z-index:40;overflow:hidden;
        }
        .vs-stage{
          position:absolute;inset:0;
          background:
            radial-gradient(90% 70% at 50% 28%,
              color-mix(in srgb, var(--sg-brass) 14%, transparent) 0%,
              transparent 55%),
            radial-gradient(70% 60% at 78% 78%,
              color-mix(in srgb, var(--sg-cyan-deep) 12%, transparent) 0%,
              transparent 50%),
            linear-gradient(180deg,
              var(--sg-bg-wash) 0%,
              var(--sg-bg) 42%,
              var(--sg-bg-deep) 100%);
        }
        .vs-wafer{
          position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);
          width:min(58vw,640px);aspect-ratio:1;pointer-events:none;
          border-radius:50%;
          background:
            repeating-linear-gradient(90deg,
              color-mix(in srgb, var(--sg-line) 55%, transparent) 0 1px,
              transparent 1px 42px),
            repeating-linear-gradient(180deg,
              color-mix(in srgb, var(--sg-line) 55%, transparent) 0 1px,
              transparent 1px 42px),
            radial-gradient(circle at 50% 50%,
              color-mix(in srgb, var(--sg-bg-panel) 70%, transparent) 0%,
              var(--sg-bg-deep) 72%);
          border:1px solid color-mix(in srgb, var(--sg-brass) 28%, var(--sg-line));
          box-shadow:
            0 0 80px color-mix(in srgb, var(--sg-brass) 12%, transparent),
            inset 0 0 60px color-mix(in srgb, var(--sg-bg) 50%, transparent);
          opacity:.55;
        }
        .vs-dock{
          position:absolute;left:12px;top:52px;z-index:70;
          max-width:min(360px,calc(100vw - 24px));
        }
        .vs-kicker{
          font-family:var(--sg-font-mono);font-size:10px;letter-spacing:.18em;
          color:var(--sg-cyan);text-transform:uppercase;
        }
        .vs-title{
          margin:2px 0 4px;
          font-family:var(--sg-font-display);font-weight:600;font-size:16px;
          letter-spacing:.1em;color:var(--sg-ink);
        }
        .vs-copy{
          font-size:11.5px;color:var(--sg-ink-muted);line-height:1.45;margin:0 0 8px;
        }
        .vs-scenes{ display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px; }
        .vs-actions{ display:flex;gap:6px;flex-wrap:wrap; }
        @media (max-width:720px){
          .vs-dock{ top:auto;bottom:12px;max-width:calc(100vw - 24px); }
        }
      `}</style>

      <div className="vs-stage" aria-hidden="true">
        <div className="vs-wafer" />
      </div>

      <VictoryReport
        overlay
        still={stillMode}
        injectTokens={false}
        tone={scene.tone}
        kicker={scene.kicker}
        title={scene.title}
        body={scene.body}
        stars={scene.stars}
        stats={scene.stats}
        primary={{
          ...scene.primary,
          onClick: () => { AudioFX.click(); go({ name: 'menu' }); },
        }}
        secondary={scene.secondary ? {
          ...scene.secondary,
          onClick: () => { AudioFX.click(); },
        } : null}
        hint={scene.hint}
      />

      {!stillMode && (
        <div className="vs-dock">
          <Panel tight className="vs-legend">
            <div className="vs-kicker">yield report · silicon gothic</div>
            <h1 className="vs-title">YIELD REPORT</h1>
            <p className="vs-copy">
              Fab checkout terminal — sign-off, zero-defect, boss lot-close, flatline, promotion.
            </p>
            <div className="vs-scenes" role="group" aria-label="yield scenes">
              {Object.values(SCENES).map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={sceneId === item.id ? (item.tone === 'danger' ? 'danger' : 'brass') : 'ghost'}
                  icon={sceneId === item.id
                    ? (item.tone === 'danger' ? <FailMark size={12} /> : <YieldMark size={12} />)
                    : null}
                  onClick={() => { AudioFX.click(); setSceneId(item.id); }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="vs-actions">
              <Button size="sm" variant="ghost" onClick={() => { AudioFX.click(); go({ name: 'menu' }); }}>
                main menu
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<YieldMark size={12} />}
                onClick={() => { AudioFX.click(); go({ name: 'hud' }); }}
              >
                operator hud
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export { VictoryScreen, SCENES };

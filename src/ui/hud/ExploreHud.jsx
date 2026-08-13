import { levelFromXp } from '../../game/rpg.js';
import { TOKEN_CSS } from '../tokens.js';
import { Button } from '../components/Button.jsx';
import { Panel } from '../components/Panel.jsx';
import {
  BackMark, CoinMark, GearMark, HudMark, MapMark,
} from '../components/icons.jsx';

/** Shared exploration HUD styles — token-only (no raw hex in rules). */
const EXPLORE_HUD_CSS = `
  .ehud{
    --hud-accent: var(--sg-cyan);
    --hud-accent-deep: var(--sg-cyan-deep);
    --hud-accent-line: var(--sg-cyan-line);
    position:absolute;inset:0;z-index:24;pointer-events:none;
    font-family:var(--sg-font-mono);color:var(--sg-ink);
  }
  .ehud[data-accent="brass"]{
    --hud-accent: var(--sg-brass);
    --hud-accent-deep: var(--sg-brass);
    --hud-accent-line: var(--sg-brass-deep);
  }
  .ehud[data-accent="danger"]{
    --hud-accent: var(--sg-danger);
    --hud-accent-deep: var(--sg-danger);
    --hud-accent-line: var(--sg-danger-deep);
  }
  .ehud *{ box-sizing:border-box; }
  .ehud .ehud-pe{ pointer-events:auto; }

  .ehud-rail{
    position:absolute;top:12px;left:12px;right:12px;
    display:flex;align-items:flex-start;gap:8px;z-index:2;
  }
  .ehud-rail__left,
  .ehud-rail__right{ display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
  .ehud-rail__right{ margin-left:auto; }
  .ehud-rail .sg-btn{
    background:color-mix(in srgb, var(--sg-bg-elevated) 88%, transparent);
    border-color:color-mix(in srgb, var(--hud-accent) 28%, var(--sg-line));
    color:var(--sg-ink-muted);
  }
  .ehud-rail .sg-btn:hover:not(:disabled){
    border-color:color-mix(in srgb, var(--hud-accent) 55%, var(--sg-line));
    color:var(--hud-accent);
  }

  .ehud-vitals{
    display:flex;align-items:center;gap:10px;
    padding:6px 10px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 34%, var(--sg-line));
    background:
      linear-gradient(120deg,
        color-mix(in srgb, var(--hud-accent) 10%, var(--sg-bg-elevated)) 0%,
        color-mix(in srgb, var(--sg-bg-elevated) 92%, transparent) 55%);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--hud-accent) 16%, transparent),
      0 0 22px color-mix(in srgb, var(--hud-accent) 10%, transparent);
    font-size:11px;letter-spacing:.06em;
  }
  .ehud-vitals__chip{
    display:inline-flex;align-items:center;gap:5px;color:var(--sg-ink-muted);
    font-variant-numeric:tabular-nums;
  }
  .ehud-vitals__chip strong{
    color:var(--hud-accent);font-weight:600;
  }
  .ehud-vitals__scrap{ color:var(--sg-brass); }
  .ehud-vitals__scrap strong{ color:var(--sg-brass); }

  .ehud-objective{
    position:absolute;top:56px;left:50%;transform:translateX(-50%);
    max-width:min(520px,86vw);text-align:center;z-index:2;
  }
  .ehud-objective__plate{
    display:inline-flex;align-items:center;gap:8px;
    padding:7px 16px 7px 12px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 42%, var(--sg-line));
    background:color-mix(in srgb, var(--sg-bg-deep) 88%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--hud-accent) 12%, transparent),
      0 0 28px color-mix(in srgb, var(--hud-accent) 12%, transparent);
  }
  .ehud-objective__mark{ color:var(--hud-accent);display:inline-flex; }
  .ehud-objective__text{
    font-family:var(--sg-font-display);font-weight:600;font-size:13px;
    letter-spacing:.2em;text-transform:uppercase;color:var(--hud-accent);
  }

  .ehud-reticle{
    position:absolute;top:50%;left:50%;width:22px;height:22px;
    transform:translate(-50%,-50%);z-index:1;
  }
  .ehud-reticle__ring{
    position:absolute;inset:0;
    border:1px solid color-mix(in srgb, var(--hud-accent) 70%, transparent);
    box-shadow:0 0 12px color-mix(in srgb, var(--hud-accent) 28%, transparent);
  }
  .ehud-reticle__ring::before,
  .ehud-reticle__ring::after{
    content:"";position:absolute;background:var(--hud-accent);
  }
  .ehud-reticle__ring::before{
    left:50%;top:-3px;width:1px;height:6px;transform:translateX(-50%);
  }
  .ehud-reticle__ring::after{
    left:50%;bottom:-3px;width:1px;height:6px;transform:translateX(-50%);
  }
  .ehud-reticle__cross{
    position:absolute;inset:0;
  }
  .ehud-reticle__cross::before,
  .ehud-reticle__cross::after{
    content:"";position:absolute;background:var(--hud-accent);
  }
  .ehud-reticle__cross::before{
    top:50%;left:-3px;height:1px;width:6px;transform:translateY(-50%);
  }
  .ehud-reticle__cross::after{
    top:50%;right:-3px;height:1px;width:6px;transform:translateY(-50%);
  }
  .ehud-reticle__pip{
    position:absolute;top:50%;left:50%;width:3px;height:3px;
    transform:translate(-50%,-50%);background:var(--hud-accent);
    box-shadow:0 0 8px color-mix(in srgb, var(--hud-accent) 55%, transparent);
  }

  .ehud-prompt{
    position:absolute;left:0;right:0;text-align:center;z-index:2;
    bottom:var(--ehud-prompt-bottom, 64px);
  }
  .ehud-prompt__plate{
    display:inline-flex;align-items:center;gap:8px;
    padding:9px 16px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 48%, var(--sg-line));
    background:color-mix(in srgb, var(--sg-bg-deep) 90%, transparent);
    color:var(--hud-accent);
    font-size:13px;letter-spacing:.08em;
    box-shadow:0 0 26px color-mix(in srgb, var(--hud-accent) 14%, transparent);
  }
  .ehud-prompt__plate[data-locked="1"]{
    border-color:color-mix(in srgb, var(--sg-danger) 70%, var(--sg-line));
    color:var(--sg-danger);
    box-shadow:0 0 26px color-mix(in srgb, var(--sg-danger) 16%, transparent);
  }
  .ehud-help{
    position:absolute;bottom:64px;left:16px;z-index:3;max-width:300px;
  }
  .ehud-help .sg-panel__body{ display:flex;flex-direction:column;gap:8px; }
  .ehud-help__title{
    font-family:var(--sg-font-mono);font-size:11px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--hud-accent);
  }
  .ehud-help__body{
    font-size:12.5px;line-height:1.55;color:var(--sg-ink-muted);
  }

  .ehud-mini{
    position:absolute;top:52px;right:12px;z-index:2;
    padding:4px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 36%, var(--sg-line));
    background:color-mix(in srgb, var(--sg-bg-deep) 88%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--hud-accent) 10%, transparent),
      0 0 20px color-mix(in srgb, var(--hud-accent) 10%, transparent);
  }
  .ehud-mini__label{
    position:absolute;top:-9px;left:6px;padding:0 4px;
    font-size:9px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--hud-accent);background:var(--sg-bg-deep);
  }
  .ehud-mini canvas,
  .ehud-mini .ehud-mini__fake{
    display:block;width:150px;height:150px;
  }
  .ehud-mini__fake{
    background:
      radial-gradient(circle at 50% 50%,
        color-mix(in srgb, var(--hud-accent) 18%, transparent) 0%,
        transparent 55%),
      linear-gradient(180deg,
        color-mix(in srgb, var(--sg-bg-panel) 80%, transparent),
        var(--sg-bg-deep));
    position:relative;overflow:hidden;
  }
  .ehud-mini__fake::before{
    content:"";position:absolute;inset:18px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 40%, transparent);
  }
  .ehud-mini__fake::after{
    content:"";position:absolute;left:50%;top:42%;width:0;height:0;
    border-left:5px solid transparent;border-right:5px solid transparent;
    border-bottom:9px solid var(--sg-brass);
    transform:translate(-50%,-50%);
  }

  .ehud-corners{
    position:absolute;inset:10px;pointer-events:none;z-index:0;
  }
  .ehud-corners::before,
  .ehud-corners::after{
    content:"";position:absolute;width:28px;height:28px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 45%, transparent);
  }
  .ehud-corners::before{ top:0;left:0;border-right:none;border-bottom:none; }
  .ehud-corners::after{ top:0;right:0;border-left:none;border-bottom:none; }
  .ehud-corners span{
    position:absolute;width:28px;height:28px;
    border:1px solid color-mix(in srgb, var(--hud-accent) 45%, transparent);
  }
  .ehud-corners span:first-child{ bottom:0;left:0;border-right:none;border-top:none; }
  .ehud-corners span:last-child{ bottom:0;right:0;border-left:none;border-top:none; }

  @media (prefers-reduced-motion: reduce){
    .ehud-vitals,
    .ehud-objective__plate,
    .ehud-prompt__plate{ box-shadow:none; }
  }
`;

/**
 * Silicon Gothic exploration HUD — diegetic operator chrome for 3D worlds.
 * Accent via data-accent (cyan|brass|danger) or --hud-accent CSS variables from parent.
 */
function ExploreHud({
  accent = 'cyan',
  /** Optional CSS color for world-specific accents (sets --hud-accent*). */
  accentColor = null,
  save,
  zone,
  objective,
  prompt,
  showHelp = false,
  helpTitle = 'access granted',
  helpBody,
  onDismissHelp,
  showReticle = true,
  showMap = true,
  onMenu,
  menuLabel = 'menu',
  onMap,
  onSettings,
  onGraphics,
  graphicsLabel = 'graphics',
  topRight = null,
  minimapRef = null,
  fakeMinimap = false,
  isTouch = false,
  hidden = false,
  injectTokens = false,
}) {
  if (hidden) return null;
  const lvl = levelFromXp(save?.xp || 0);
  const scrap = save?.scrap || 0;
  const xp = save?.xp || 0;
  const zoneText = (objective || zone || '').toString();
  const accentStyle = accentColor ? {
    '--hud-accent': accentColor,
    '--hud-accent-deep': accentColor,
    '--hud-accent-line': accentColor,
  } : undefined;

  return (
    <div
      className="ehud"
      data-accent={accentColor ? 'custom' : accent}
      data-explore-hud="1"
      style={accentStyle}
    >
      {injectTokens ? <style>{TOKEN_CSS}</style> : null}
      <style>{EXPLORE_HUD_CSS}</style>
      <div className="ehud-corners" aria-hidden="true"><span /><span /></div>

      <div className="ehud-rail">
        <div className="ehud-rail__left ehud-pe">
          {onMenu && (
            <Button size="sm" icon={<BackMark size={12} />} onClick={onMenu}>
              {menuLabel}
            </Button>
          )}
          {showMap && onMap && (
            <Button size="sm" icon={<MapMark size={12} />} onClick={onMap}>
              map
            </Button>
          )}
        </div>

        <div className="ehud-vitals ehud-pe" aria-label="operator vitals">
          <span className="ehud-vitals__chip">
            <HudMark size={12} />
            <strong>Lv {lvl}</strong>
          </span>
          <span className="ehud-vitals__chip ehud-vitals__scrap">
            <CoinMark size={12} />
            <strong>{scrap}</strong> scrap
          </span>
          <span className="ehud-vitals__chip">
            <strong>{xp}</strong> XP
          </span>
        </div>

        <div className="ehud-rail__right ehud-pe">
          {onGraphics && (
            <Button size="sm" onClick={onGraphics}>{graphicsLabel}</Button>
          )}
          {onSettings && (
            <Button size="sm" icon={<GearMark size={12} />} onClick={onSettings} title="settings">
              settings
            </Button>
          )}
          {topRight}
        </div>
      </div>

      {zoneText ? (
        <div className="ehud-objective" key={zoneText}>
          <div className="ehud-objective__plate">
            <span className="ehud-objective__mark" aria-hidden="true"><HudMark size={13} /></span>
            <span className="ehud-objective__text">{zoneText}</span>
          </div>
        </div>
      ) : null}

      {showReticle && !isTouch && (
        <div className="ehud-reticle" aria-hidden="true">
          <div className="ehud-reticle__ring" />
          <div className="ehud-reticle__cross" />
          <div className="ehud-reticle__pip" />
        </div>
      )}

      {prompt && (
        <div className="ehud-prompt" style={{ '--ehud-prompt-bottom': isTouch ? '120px' : '64px' }}>
          <span className="ehud-prompt__plate" data-locked={prompt.locked ? '1' : '0'}>
            {prompt.text}
          </span>
        </div>
      )}

      {showHelp && (
        <div className="ehud-help ehud-pe">
          <Panel title={null} tight className="ehud-help-panel">
            <div className="ehud-help__title">{helpTitle}</div>
            <div className="ehud-help__body">{helpBody}</div>
            {onDismissHelp && (
              <Button size="sm" variant="ghost" onClick={onDismissHelp}>got it</Button>
            )}
          </Panel>
        </div>
      )}

      {(minimapRef || fakeMinimap) && (
        <div className="ehud-mini ehud-pe" aria-label="floorplan radar">
          <span className="ehud-mini__label">radar</span>
          {fakeMinimap
            ? <div className="ehud-mini__fake" />
            : <canvas ref={minimapRef} width={150} height={150} />}
        </div>
      )}
    </div>
  );
}

export { ExploreHud, EXPLORE_HUD_CSS };

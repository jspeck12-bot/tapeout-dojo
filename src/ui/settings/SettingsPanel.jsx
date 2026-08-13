import { useMemo, useState } from 'react';
import { TOKEN_CSS } from '../tokens.js';
import { MODES } from '../../game/content.js';
import { Button } from '../components/Button.jsx';
import { Panel } from '../components/Panel.jsx';
import { Badge } from '../components/Badge.jsx';
import { ListRow } from '../components/ListRow.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import {
  BackMark, GearMark, MuteMark, SearchMark, SoundMark,
} from '../components/icons.jsx';

const GROUPS = [
  { id: 'controls', label: 'controls' },
  { id: 'audio', label: 'audio' },
  { id: 'graphics', label: 'graphics' },
  { id: 'difficulty', label: 'difficulty' },
  { id: 'wafers', label: 'wafers' },
  { id: 'flight', label: 'flight' },
];

const CONTROL_ROWS = [
  ['WASD / arrows', 'move'],
  ['mouse / drag', 'look'],
  ['Shift', 'sprint'],
  ['E / Enter', 'interact'],
  ['M', 'cycle soundtrack'],
  ['`', 'flight note'],
];

const GFX_ROWS = [
  ['exposure', 0.5, 2.2, 0.01],
  ['lights', 0.2, 3, 0.05],
  ['ambient', 0, 2.5, 0.05],
  ['fog', 0, 0.08, 0.002],
  ['normal', 0, 2.5, 0.05],
  ['glow', 0, 1.5, 0.05],
  ['bloom', 0, 2, 0.05],
];

const SETTINGS_CSS = `
  .st-root{ position:fixed;inset:0;z-index:90;overflow:auto; }
  .st-shell{
    position:relative;z-index:1;width:min(1100px,94vw);margin:0 auto;
    min-height:calc(100vh - 40px);
    display:grid;grid-template-rows:auto auto 1fr;
    gap:clamp(12px,1.8vh,20px);
    padding:clamp(16px,2.4vh,32px) 0 28px;
  }
  .st-grid{ display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:14px;align-items:start; }
  .st-search{
    width:100%;background:var(--sg-bg-deep);border:1px solid var(--sg-line);
    color:var(--sg-ink);font:inherit;font-size:14px;padding:10px 12px 10px 36px;
    border-radius:var(--sg-radius-sm);
  }
  .st-search:focus{ outline:2px solid var(--sg-focus); outline-offset:2px; }
  .st-search-wrap{ position:relative; }
  .st-search-wrap svg{ position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--sg-ink-dim); }
  .st-preview{
    position:relative;height:168px;overflow:hidden;
    border:1px solid var(--sg-line);background:var(--sg-bg-deep);
  }
  .st-preview__fog{
    position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(180deg, transparent, var(--sg-bg));
  }
  .st-preview__wafer{
    position:absolute;left:50%;top:46%;width:46%;aspect-ratio:1;
    transform:translate(-50%,-50%);
    border-radius:50%;
    border:2px solid var(--sg-cyan);
    background:
      repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--sg-cyan) 18%, transparent) 0 8deg, transparent 8deg 16deg),
      radial-gradient(circle at 38% 32%, var(--sg-cyan), var(--sg-bg));
  }
  .st-preview__bloom{
    position:absolute;inset:18%;border-radius:50%;pointer-events:none;
    background:radial-gradient(circle, color-mix(in srgb, var(--sg-cyan) 55%, transparent), transparent 70%);
  }
  .st-slider{ width:100%; accent-color:var(--sg-cyan); }
  .st-group{ margin-bottom:18px; }
  @media (max-width:860px){ .st-grid{ grid-template-columns:1fr; } }
`;

function hay(parts) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function SettingsPanel({
  save,
  gfx,
  setGfx,
  setMode,
  toggleNg,
  toggleSound,
  resetArmed,
  setResetArmed,
  resetAll,
  activeSlot = 1,
  go,
  onClose,
  onFlightReport,
  onFlightNote,
  still = false,
  seedGroup = 'graphics',
  seedQuery = '',
}) {
  const [query, setQuery] = useState(seedQuery);
  const [group, setGroup] = useState(seedGroup);
  const q = query.trim().toLowerCase();
  const modeId = save.ngplus ? 'architect' : save.mode;

  const match = (text) => !q || hay([text]).includes(q);

  const groups = useMemo(
    () => GROUPS.filter((g) => {
      if (!q) return true;
      if (g.id.includes(q) || g.label.includes(q)) return true;
      if (g.id === 'controls' && CONTROL_ROWS.some(([a, b]) => match(`${a} ${b}`))) return true;
      if (g.id === 'audio' && match('audio sound mute soundtrack')) return true;
      if (g.id === 'graphics' && (match('graphics bloom fog exposure lights') || GFX_ROWS.some(([k]) => match(k)))) return true;
      if (g.id === 'difficulty' && match(`difficulty apprentice engineer architect ng+ ${MODES.map((m) => m.label).join(' ')}`)) return true;
      if (g.id === 'wafers' && match('profiles reset wafer save slot')) return true;
      if (g.id === 'flight' && match('flight recorder note report')) return true;
      return false;
    }),
    [q],
  );

  const show = (id) => {
    if (!groups.some((g) => g.id === id)) return false;
    if (q) return true;
    return group === id;
  };

  const previewStyle = {
    filter: `brightness(${0.72 + gfx.exposure * 0.28}) saturate(${0.55 + gfx.lights * 0.22})`,
  };
  const fogOp = Math.min(0.72, gfx.fog * 9);
  const bloomOp = Math.min(0.85, 0.15 + gfx.bloom * 0.35);
  const glowOp = Math.min(0.7, gfx.glow * 0.4);

  return (
    <div className="sg-ui st-root sg-enter" data-settings-status="ready" data-settings-still={still ? '1' : '0'}>
      <style>{TOKEN_CSS}</style>
      <style>{SETTINGS_CSS}</style>
      <div className="st-shell">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>fab controls · searchable</div>
            <h1 className="sg-display" style={{ margin: '8px 0 6px', fontSize: 'clamp(28px,5vw,48px)', lineHeight: 1 }}>
              SETTINGS
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={save.sound ? 'ok' : 'danger'}>{save.sound ? 'audio live' : 'muted'}</Badge>
            {save.ngplus && <Badge tone="brass">NG+</Badge>}
            <Button variant="ghost" size="sm" icon={<BackMark size={13} />} onClick={() => { onClose && onClose(); go && go({ name: 'menu' }); }}>
              close
            </Button>
          </div>
        </header>

        <div className="st-search-wrap">
          <SearchMark size={14} />
          <input
            className="st-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search controls, bloom, NG+, wafers…"
            aria-label="search settings"
          />
        </div>

        <Tabs value={group} onChange={setGroup} aria-label="settings groups" tabs={groups} />

        <div className="st-grid">
          <div>
            {show('controls') && (
              <div className="st-group">
                <Panel title="Controls" tight>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13 }}>
                    {CONTROL_ROWS.filter(([a, b]) => match(`${a} ${b}`)).map(([k, v]) => (
                      <div key={k} style={{ display: 'contents' }}>
                        <span className="sg-mono" style={{ color: 'var(--sg-ink)' }}>{k}</span>
                        <span style={{ color: 'var(--sg-ink-dim)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {show('audio') && (
              <div className="st-group">
                <Panel title="Audio" tight>
                  <Button
                    variant={save.sound ? 'primary' : 'danger'}
                    icon={save.sound ? <SoundMark size={14} /> : <MuteMark size={14} />}
                    onClick={toggleSound}
                  >
                    {save.sound ? 'mute synthesized score' : 'restore audio'}
                  </Button>
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--sg-ink-dim)' }}>
                    All audio is synthesized. Reduced-motion is honored via prefers-reduced-motion.
                  </p>
                </Panel>
              </div>
            )}

            {show('difficulty') && (
              <div className="st-group">
                <Panel title="Difficulty" tight>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {MODES.filter((m) => match(`${m.label} ${m.blurb} ${m.id}`)).map((m) => (
                      <ListRow
                        key={m.id}
                        title={m.label}
                        hint={m.blurb}
                        active={modeId === m.id}
                        disabled={!!save.ngplus}
                        onClick={() => setMode && setMode(m.id)}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      size="sm"
                      variant={save.ngplus ? 'brass' : 'default'}
                      disabled={!save.tapeoutDone}
                      onClick={toggleNg}
                    >
                      {save.ngplus ? 'NG+ engaged — disengage' : 'engage NG+'}
                    </Button>
                    <span className="sg-eyebrow">
                      {save.tapeoutDone ? 'every spec remixed · architect rules' : 'locked until CHIP-1 tapes out'}
                    </span>
                  </div>
                </Panel>
              </div>
            )}

            {show('wafers') && (
              <div className="st-group">
                <Panel title="Wafers" tight>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" onClick={() => { onClose && onClose(); go && go({ name: 'profiles' }); }}>
                      profiles & save codes
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => { if (resetArmed) resetAll && resetAll(); else setResetArmed && setResetArmed(true); }}
                    >
                      {resetArmed ? 'click again — no undo' : `scrap wafer (slot ${activeSlot})`}
                    </Button>
                  </div>
                </Panel>
              </div>
            )}

            {show('flight') && (
              <div className="st-group">
                <Panel title="Flight recorder" tight>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" onClick={onFlightReport}>view flight report</Button>
                    <Button size="sm" onClick={onFlightNote}>add note (`)</Button>
                  </div>
                </Panel>
              </div>
            )}
          </div>

          {(show('graphics') || !q) && (
            <Panel title="Graphics · live preview" className="st-group">
              <div className="st-preview" aria-label="live graphics preview">
                <div className="st-preview__wafer" style={previewStyle} />
                <div className="st-preview__bloom" style={{ opacity: bloomOp }} />
                <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${18 + gfx.glow * 40}px color-mix(in srgb, var(--sg-cyan) ${Math.round(glowOp * 100)}%, transparent)` }} />
                <div className="st-preview__fog" style={{ opacity: fogOp }} />
              </div>
              <div style={{ margin: '10px 0 12px' }}>
                <div className="sg-eyebrow" style={{ marginBottom: 6 }}>exposure</div>
                <ProgressBar value={((gfx.exposure - 0.5) / 1.7) * 100} tone="cyan" label="exposure" />
              </div>
              {GFX_ROWS.filter(([k]) => match(k) || match('graphics')).map(([k, mn, mx, st]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sg-ink-muted)', marginBottom: 2 }}>
                    <span>{k}</span>
                    <span className="sg-mono" style={{ color: 'var(--sg-ink)' }}>{(+gfx[k]).toFixed(3)}</span>
                  </div>
                  <input
                    className="st-slider"
                    type="range"
                    min={mn}
                    max={mx}
                    step={st}
                    value={gfx[k]}
                    aria-label={k}
                    onChange={(e) => setGfx((g) => ({ ...g, [k]: +e.target.value }))}
                  />
                </div>
              ))}
              <Tooltip label="copy JSON for a flight note">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<GearMark size={12} />}
                  onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(gfx)); } catch (e) { } }}
                >
                  copy gfx JSON
                </Button>
              </Tooltip>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

export { SettingsPanel, GROUPS, GFX_ROWS };

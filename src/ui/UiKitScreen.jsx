import { useEffect, useState } from 'react';
import { TOKEN_CSS, TOKENS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
import { Badge } from './components/Badge.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { StatBlock } from './components/StatBlock.jsx';
import { ListRow } from './components/ListRow.jsx';
import { Tabs } from './components/Tabs.jsx';
import { Tooltip } from './components/Tooltip.jsx';
import { Toast } from './components/Toast.jsx';
import { ChipMark, GearMark, PlayMark } from './components/icons.jsx';

const SWATCHES = [
  ['bg', TOKENS.color.bg],
  ['panel', TOKENS.color.bgPanel],
  ['ink', TOKENS.color.ink],
  ['muted', TOKENS.color.inkMuted],
  ['brass', TOKENS.color.brass],
  ['cyan', TOKENS.color.cyan],
  ['danger', TOKENS.color.danger],
  ['ok', TOKENS.color.ok],
];

function UiKitScreen({ go }) {
  const [stage, setStage] = useState('boot');
  const [armed, setArmed] = useState(false);
  const [tab, setTab] = useState('probes');

  useEffect(() => {
    const id = setTimeout(() => setStage('ready'), 16);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="sg-ui"
      data-uikit-status={stage}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        overflow: 'auto',
        padding: 'clamp(20px, 3vh, 40px) clamp(20px, 4vw, 56px) 40px',
      }}
    >
      <style>{TOKEN_CSS}</style>
      <style>{`
        .sg-ui-floor{
          position:fixed;left:-20%;right:-20%;bottom:-8%;height:42%;
          background-image:
            linear-gradient(color-mix(in srgb, var(--sg-brass) 12%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--sg-cyan) 10%, transparent) 1px, transparent 1px);
          background-size:48px 48px;
          transform:perspective(520px) rotateX(58deg);
          transform-origin:50% 100%;
          pointer-events:none;
          -webkit-mask-image:linear-gradient(to top,#000 10%,transparent 78%);
          mask-image:linear-gradient(to top,#000 10%,transparent 78%);
          z-index:0;
        }
        .sg-ui-swatches{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:var(--sg-space-3)}
        .sg-ui-main{display:grid;grid-template-columns:1.4fr 1fr;gap:var(--sg-space-4);align-content:start}
        .sg-ui-type{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;align-items:center}
        @media (max-width:860px){
          .sg-ui-swatches{grid-template-columns:repeat(4,minmax(0,1fr))}
          .sg-ui-main{grid-template-columns:1fr}
          .sg-ui-type{grid-template-columns:1fr}
        }
        @media (max-width:520px){
          .sg-ui-swatches{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (prefers-reduced-motion:reduce){
          .sg-ui-floor{transform:none;opacity:.35}
        }
      `}</style>
      <div className="sg-ui-floor" aria-hidden="true" />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1280,
          margin: '0 auto',
          minHeight: 'calc(100vh - 80px)',
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto',
          gap: 'clamp(16px, 2.4vh, 28px)',
        }}
      >
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              silicon gothic · ui kit
            </div>
            <h1 className="sg-display" style={{ margin: '10px 0 8px', fontSize: 'clamp(36px, 6vw, 64px)', color: 'var(--sg-ink)', lineHeight: 1 }}>
              TAPEOUT<span style={{ color: 'var(--sg-cyan)' }}>_</span>
            </h1>
            <p style={{ margin: 0, maxWidth: 640, color: 'var(--sg-ink-muted)', fontSize: 14.5 }}>
              Self-hosted Oxanium / IBM Plex Sans / JetBrains Mono. Button, Panel, Modal, Tabs, Toast, Tooltip, ProgressBar, StatBlock, ListRow, Badge.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'menu' })}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'workbench' })}>
              workbench
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'styleguide' })}>
              3D lab
            </Button>
          </div>
        </header>

        <Panel title="Color tokens" wide>
          <div className="sg-ui-swatches">
            {SWATCHES.map(([name, value]) => (
              <div key={name} style={{ display: 'grid', gap: 6 }}>
                <div
                  aria-label={`${name} ${value}`}
                  style={{
                    height: 56,
                    borderRadius: 'var(--sg-radius-sm)',
                    border: '1px solid var(--sg-line)',
                    background: value,
                  }}
                />
                <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--sg-ink)' }}>
                  {name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--sg-ink-dim)' }}>{value}</div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="sg-ui-main">
          <Panel title="Buttons">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <Button variant="primary" icon={<PlayMark size={15} />}>continue</Button>
              <Button variant="brass" icon={<ChipMark size={15} />}>forge</Button>
              <Button>default</Button>
              <Button variant="danger" onClick={() => setArmed(a => !a)}>
                {armed ? 'armed' : 'erase'}
              </Button>
              <Button variant="ghost" icon={<GearMark size={15} />}>settings</Button>
              <Button size="sm" disabled>locked</Button>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sg-ink-dim)' }}>
              Variants: primary · brass · default · danger · ghost. Focus ring uses --sg-focus.
              Reduced-motion strips button transitions.
            </p>
          </Panel>

          <Panel title="Panel anatomy">
            <p style={{ margin: '0 0 14px' }}>
              Brass corner brackets mark equipment frames. Titles: Oxanium. Body: IBM Plex Sans. Code: JetBrains Mono with ligatures.
            </p>
            <Button variant="primary" size="lg" style={{ width: '100%' }}>
              commit to wafer
            </Button>
          </Panel>

          <Panel title="Kit pieces" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <Badge tone="cyan">cyan</Badge>
              <Badge tone="brass">brass</Badge>
              <Badge tone="ok">ok</Badge>
              <Badge tone="danger">danger</Badge>
              <Tooltip label="token tooltip">
                <Badge>hover me</Badge>
              </Tooltip>
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[{ id: 'probes', label: 'probes' }, { id: 'suits', label: 'suits' }]}
            />
            <div style={{ margin: '12px 0' }}>
              <ProgressBar value={armed ? 100 : 67} tone="cyan" label="yield" />
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <StatBlock label="HP" value={156} tone="ok" delta="+20" />
              <StatBlock label="ATK" value={45} tone="cyan" />
            </div>
            <ListRow title="Copper Probe" hint="low resistance" meta="120 ⛁" active={tab === 'probes'} onClick={() => setTab('probes')} />
            <div style={{ marginTop: 12, maxWidth: 280 }}>
              <Toast title="WAFER SYNCED" sub="settings saved to this slot" />
            </div>
          </Panel>

          <Panel title="Type & motion" style={{ gridColumn: '1 / -1' }}>
            <div className="sg-ui-type">
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="sg-display" style={{ fontSize: 28, color: 'var(--sg-brass)' }}>
                  Display · Oxanium
                </div>
                <div style={{ fontFamily: 'var(--sg-font-body)', color: 'var(--sg-ink)', fontSize: 15 }}>
                  Body · IBM Plex Sans — the fab keeps the work.
                </div>
                <div style={{ fontFamily: 'var(--sg-font-mono)', color: 'var(--sg-ink)', fontSize: 15 }}>
                  Mono · JetBrains Mono — module and_gate (a, b, y);
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--sg-ink-dim)', lineHeight: 1.7 }}>
                --sg-motion-fast {TOKENS.motion.fast}<br />
                --sg-motion-med {TOKENS.motion.med}<br />
                ease {TOKENS.motion.ease}
              </div>
            </div>
          </Panel>
        </div>

        <footer className="sg-eyebrow" style={{ textAlign: 'center' }}>
          UI KIT · data-uikit-status={stage} · self-hosted faces · full kit
        </footer>
      </div>
    </div>
  );
}

export { UiKitScreen };

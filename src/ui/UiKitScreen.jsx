import { useEffect, useState } from 'react';
import { TOKEN_CSS, TOKENS } from './tokens.js';
import { Button } from './components/Button.jsx';
import { Panel } from './components/Panel.jsx';
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
        padding: '28px 22px 48px',
      }}
    >
      <style>{TOKEN_CSS}</style>

      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          display: 'grid',
          gap: 'var(--sg-space-5)',
        }}
      >
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="sg-eyebrow" style={{ color: 'var(--sg-cyan)' }}>
              silicon gothic · ui kit
            </div>
            <h1 className="sg-display" style={{ margin: '8px 0 6px', fontSize: 'clamp(28px, 5vw, 42px)', color: 'var(--sg-ink)' }}>
              TAPEOUT<span style={{ color: 'var(--sg-cyan)' }}>_</span> CONTROLS
            </h1>
            <p style={{ margin: 0, maxWidth: 520, color: 'var(--sg-ink-muted)', fontSize: 13.5 }}>
              Tokens, Button, and Panel — diegetic fab chrome for the upcoming screen pass.
              Gameplay routes are unchanged.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'menu' })}>
              ← menu
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go({ name: 'styleguide' })}>
              3D lab
            </Button>
          </div>
        </header>

        <Panel title="Color tokens" wide>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 'var(--sg-space-3)',
            }}
          >
            {SWATCHES.map(([name, value]) => (
              <div key={name} style={{ display: 'grid', gap: 6 }}>
                <div
                  aria-label={`${name} ${value}`}
                  style={{
                    height: 44,
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--sg-space-4)',
          }}
        >
          <Panel title="Buttons">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <Button variant="primary" icon={<PlayMark size={14} />}>continue</Button>
              <Button variant="brass" icon={<ChipMark size={14} />}>forge</Button>
              <Button>default</Button>
              <Button variant="danger" onClick={() => setArmed(a => !a)}>
                {armed ? 'armed' : 'erase'}
              </Button>
              <Button variant="ghost" icon={<GearMark size={14} />}>settings</Button>
              <Button size="sm" disabled>locked</Button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--sg-ink-dim)' }}>
              Variants: primary · brass · default · danger · ghost. Focus ring uses --sg-focus. Reduced-motion disables hover transitions.
            </p>
          </Panel>

          <Panel title="Panel anatomy" tight>
            <p style={{ margin: '0 0 10px' }}>
              Brass corner brackets mark equipment frames. Titles use Oxanium; body copy stays IBM Plex Mono.
            </p>
            <Button variant="primary" size="lg" style={{ width: '100%' }}>
              commit to wafer
            </Button>
          </Panel>
        </div>

        <Panel title="Type & motion">
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="sg-display" style={{ fontSize: 22, color: 'var(--sg-brass)' }}>
              Display · Oxanium
            </div>
            <div style={{ fontFamily: 'var(--sg-font-mono)', color: 'var(--sg-ink)' }}>
              Mono · IBM Plex Mono — module and_gate (a, b, y);
            </div>
            <div style={{ fontSize: 12, color: 'var(--sg-ink-dim)' }}>
              Motion tokens: --sg-motion-fast {TOKENS.motion.fast} · --sg-motion-med {TOKENS.motion.med} · ease {TOKENS.motion.ease}
            </div>
          </div>
        </Panel>

        <footer className="sg-eyebrow" style={{ textAlign: 'center', paddingBottom: 8 }}>
          UI KIT · data-uikit-status={stage} · screens still on legacy .btn until migrated
        </footer>
      </div>
    </div>
  );
}

export { UiKitScreen };

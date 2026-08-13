import { useEffect, useState } from 'react';
import { TOKEN_CSS } from '../tokens.js';
import { Button } from '../components/Button.jsx';
import { ChevronMark, FailMark, YieldMark } from '../components/icons.jsx';

const VICTORY_CSS = `
  .vr-root{ color:var(--sg-ink); font-family:var(--sg-font-mono); }
  .vr-root *{ box-sizing:border-box; }
  .vr-overlay{
    position:fixed;inset:0;z-index:60;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:clamp(18px,3.2vh,36px) clamp(16px,4vw,48px);
    background:
      radial-gradient(70% 60% at 50% 42%,
        color-mix(in srgb, var(--vr-glow) 20%, transparent) 0%,
        transparent 62%),
      color-mix(in srgb, var(--sg-bg-deep) 58%, transparent);
  }
  .vr-overlay::before{
    content:"";position:absolute;inset:0;pointer-events:none;opacity:.34;
    background-image:
      linear-gradient(color-mix(in srgb, var(--sg-line) 80%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--sg-line) 80%, transparent) 1px, transparent 1px);
    background-size:42px 42px;
    mask-image:radial-gradient(ellipse at 50% 46%, #000 22%, transparent 78%);
  }
  .vr-overlay::after{
    content:"";position:absolute;inset:0;pointer-events:none;opacity:.14;
    background:repeating-linear-gradient(
      180deg,
      transparent 0 2px,
      color-mix(in srgb, var(--sg-bg-deep) 80%, transparent) 2px 3px
    );
  }
  .vr-root[data-tone="ok"]{ --vr-glow:var(--sg-ok); --vr-ink:var(--sg-ok); --vr-line:color-mix(in srgb, var(--sg-ok) 50%, var(--sg-line)); }
  .vr-root[data-tone="brass"]{ --vr-glow:var(--sg-brass); --vr-ink:var(--sg-brass); --vr-line:color-mix(in srgb, var(--sg-brass) 58%, var(--sg-line)); }
  .vr-root[data-tone="danger"]{ --vr-glow:var(--sg-danger); --vr-ink:var(--sg-danger); --vr-line:color-mix(in srgb, var(--sg-danger) 55%, var(--sg-line)); }

  .vr-banner{
    position:relative;z-index:2;width:min(1400px,94vw);
    display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
    font-size:10px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--sg-ink-dim);margin-bottom:14px;
  }
  .vr-banner strong{ color:var(--vr-ink); font-weight:600; }
  .vr-bay{
    position:relative;z-index:2;
    width:min(1400px,94vw);
    display:grid;
    grid-template-columns:minmax(180px,.72fr) minmax(0,1.55fr) minmax(160px,.62fr);
    gap:14px;align-items:stretch;
  }
  .vr-ticket,.vr-meter,.vr-chassis{
    position:relative;
    background:
      linear-gradient(180deg,
        color-mix(in srgb, var(--sg-bg-panel) 94%, var(--vr-glow)) 0%,
        var(--sg-bg-elevated) 42%,
        var(--sg-bg-deep) 100%);
    border:1px solid var(--vr-line);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--vr-glow) 18%, transparent),
      0 18px 48px color-mix(in srgb, var(--sg-bg-deep) 55%, transparent);
  }
  .vr-ticket,.vr-meter{
    padding:18px 16px;
    clip-path:polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
  }
  .vr-ticket__label,.vr-meter__label{
    font-size:9px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--sg-ink-dim);margin:0 0 12px;
  }
  .vr-ticket__row{
    display:flex;flex-direction:column;gap:2px;
    padding:8px 0;border-top:1px solid var(--sg-line);
  }
  .vr-ticket__row:first-of-type{ border-top:none; }
  .vr-ticket__k{ font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--sg-ink-dim); }
  .vr-ticket__v{ font-size:13px;color:var(--sg-ink);letter-spacing:.04em; }
  .vr-meter__track{
    height:min(280px,36vh);width:100%;
    border:1px solid var(--sg-line);
    background:var(--sg-bg-deep);
    display:flex;align-items:flex-end;padding:4px;
  }
  .vr-meter__fill{
    width:100%;
    background:linear-gradient(180deg, var(--vr-ink), color-mix(in srgb, var(--vr-glow) 30%, var(--sg-bg-deep)));
    box-shadow:0 0 18px color-mix(in srgb, var(--vr-glow) 35%, transparent);
    min-height:4px;
  }
  .vr-meter__value{
    margin-top:10px;
    font-family:var(--sg-font-display);font-size:28px;font-weight:700;
    letter-spacing:.06em;color:var(--vr-ink);
    font-variant-numeric:tabular-nums;
  }

  .vr-chassis{
    padding:32px 34px 26px;text-align:center;
    clip-path:polygon(22px 0, calc(100% - 22px) 0, 100% 22px, 100% calc(100% - 22px), calc(100% - 22px) 100%, 22px 100%, 0 calc(100% - 22px), 0 22px);
    animation:vr-enter var(--sg-motion-enter) var(--sg-spring) both;
  }
  .vr-chassis::before,
  .vr-chassis::after{
    content:"";position:absolute;width:16px;height:16px;
    border:1px solid color-mix(in srgb, var(--vr-glow) 75%, transparent);
    pointer-events:none;
  }
  .vr-chassis::before{ top:12px;left:12px;border-right:none;border-bottom:none; }
  .vr-chassis::after{ top:12px;right:12px;border-left:none;border-bottom:none; }
  .vr-screws{
    position:absolute;inset:12px;pointer-events:none;
  }
  .vr-screws::before,
  .vr-screws::after{
    content:"";position:absolute;width:16px;height:16px;
    border:1px solid color-mix(in srgb, var(--vr-glow) 75%, transparent);
  }
  .vr-screws::before{ left:0;bottom:0;border-right:none;border-top:none; }
  .vr-screws::after{ right:0;bottom:0;border-left:none;border-top:none; }
  .vr-screw{
    position:absolute;width:7px;height:7px;border-radius:50%;
    border:1px solid color-mix(in srgb, var(--vr-glow) 55%, var(--sg-line));
    background:color-mix(in srgb, var(--sg-bg-hover) 80%, transparent);
  }
  .vr-screw--tl{ top:18px;left:18px; }
  .vr-screw--tr{ top:18px;right:18px; }
  .vr-screw--bl{ bottom:18px;left:18px; }
  .vr-screw--br{ bottom:18px;right:18px; }

  .vr-kicker{
    font-size:10px;letter-spacing:.22em;text-transform:uppercase;
    color:var(--vr-ink);margin:0 0 10px;
  }
  .vr-mark{
    display:flex;justify-content:center;margin:0 0 8px;
    color:var(--vr-ink);
    filter:drop-shadow(0 0 12px color-mix(in srgb, var(--vr-glow) 45%, transparent));
  }
  .vr-title{
    margin:0;
    font-family:var(--sg-font-display);
    font-weight:700;
    font-size:clamp(32px,4.4vw,52px);
    letter-spacing:.14em;
    text-transform:uppercase;
    line-height:1.05;
    color:var(--sg-ink);
    text-shadow:
      1px 0 color-mix(in srgb, var(--sg-cyan) 35%, transparent),
      -1px 0 color-mix(in srgb, var(--sg-danger) 22%, transparent),
      0 0 28px color-mix(in srgb, var(--vr-glow) 40%, transparent);
  }
  .vr-body{
    margin:14px auto 0;
    max-width:42ch;
    font-size:14px;
    line-height:1.55;
    color:var(--sg-ink-muted);
  }
  .vr-bins{
    display:flex;justify-content:center;gap:14px;margin:18px 0 4px;
  }
  .vr-bin{
    width:40px;height:40px;color:var(--sg-ink-dim);
    opacity:.4;transform:scale(.92);
  }
  .vr-bin.is-lit{
    color:var(--vr-ink);opacity:1;transform:none;
    filter:drop-shadow(0 0 10px color-mix(in srgb, var(--vr-glow) 55%, transparent));
    animation:vr-bin var(--sg-motion-enter) var(--sg-spring) both;
  }
  .vr-bin.is-lit:nth-child(2){ animation-delay:90ms; }
  .vr-bin.is-lit:nth-child(3){ animation-delay:180ms; }
  .vr-stats{
    display:flex;flex-wrap:wrap;justify-content:center;gap:10px;
    margin:18px 0 4px;
  }
  .vr-stat{
    min-width:110px;
    padding:10px 14px 9px;
    border:1px solid var(--sg-line);
    background:color-mix(in srgb, var(--sg-bg-elevated) 88%, transparent);
    display:flex;flex-direction:column;gap:2px;
    animation:vr-enter var(--sg-motion-enter) var(--sg-spring) both;
  }
  .vr-stat:nth-child(2){ animation-delay:80ms; }
  .vr-stat:nth-child(3){ animation-delay:160ms; }
  .vr-stat__label{
    font-size:9px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--sg-ink-dim);
  }
  .vr-stat__value{
    font-family:var(--sg-font-display);
    font-size:22px;font-weight:600;letter-spacing:.04em;
    color:var(--sg-ink);font-variant-numeric:tabular-nums;
  }
  .vr-stat[data-accent="brass"] .vr-stat__value{ color:var(--sg-brass); }
  .vr-stat[data-accent="ok"] .vr-stat__value{ color:var(--sg-ok); }
  .vr-stat[data-accent="danger"] .vr-stat__value{ color:var(--sg-danger); }
  .vr-stat[data-accent="cyan"] .vr-stat__value{ color:var(--sg-cyan); }
  .vr-actions{
    display:flex;flex-wrap:wrap;justify-content:center;gap:10px;
    margin:20px 0 0;
  }
  .vr-actions .sg-btn--primary{
    background:color-mix(in srgb, var(--sg-cyan-deep) 28%, var(--sg-cyan-bottom));
    border-color:var(--sg-cyan-deep);
    color:var(--sg-cyan);
    box-shadow:0 0 18px color-mix(in srgb, var(--sg-cyan-deep) 28%, transparent);
  }
  .vr-actions .sg-btn--brass{
    background:color-mix(in srgb, var(--sg-brass) 22%, var(--sg-brass-bottom));
    border-color:var(--sg-brass);
    color:var(--sg-brass);
    box-shadow:0 0 18px color-mix(in srgb, var(--sg-brass) 26%, transparent);
  }
  .vr-actions .sg-btn--danger{
    background:color-mix(in srgb, var(--sg-danger) 20%, var(--sg-danger-bottom));
    border-color:var(--sg-danger);
    color:var(--sg-danger);
    box-shadow:0 0 18px color-mix(in srgb, var(--sg-danger) 22%, transparent);
  }
  .vr-hint{
    margin:14px 0 0;
    font-size:10px;letter-spacing:.16em;text-transform:uppercase;
    color:var(--sg-ink-dim);
  }
  @keyframes vr-enter{
    from{ opacity:0; transform:translateY(10px) scale(.97); }
    to{ opacity:1; transform:none; }
  }
  @keyframes vr-bin{
    from{ opacity:0; transform:scale(.6); }
    to{ opacity:1; transform:none; }
  }
  @media (max-width:900px){
    .vr-bay{ grid-template-columns:1fr; }
    .vr-meter__track{ height:64px; }
  }
  @media (prefers-reduced-motion:reduce){
    .vr-chassis,.vr-stat,.vr-bin.is-lit{ animation:none !important; }
  }
`;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function TickNum({ value, still }) {
  const reduced = useReducedMotion();
  const snap = still || reduced;
  const [shown, setShown] = useState(() => (snap ? value : 0));
  useEffect(() => {
    if (snap || typeof requestAnimationFrame !== 'function') {
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const from = 0;
    const dur = 800;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - ((1 - t) ** 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, snap]);
  return <span data-stat-value={value}>{shown}</span>;
}

function ProbeBins({ n }) {
  const lit = Math.max(0, Math.min(3, n || 0));
  return (
    <div className="vr-bins" aria-label={`${lit} of 3 probe bins`}>
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          className={`vr-bin${i < lit ? ' is-lit' : ''}`}
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <rect x="2.2" y="2.2" width="11.6" height="11.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.2 8h11.6M8 2.2v11.6" stroke="currentColor" strokeWidth="1.05" />
          {i < lit ? <rect x="5.4" y="5.4" width="5.2" height="5.2" fill="currentColor" /> : null}
        </svg>
      ))}
    </div>
  );
}

function VictoryReport({
  tone = 'ok',
  kicker,
  title,
  body,
  stars = null,
  stats = [],
  meta = [],
  meter = null,
  banner = null,
  primary,
  secondary,
  hint,
  still = false,
  overlay = true,
  injectTokens = true,
  onPrimary,
  onSecondary,
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKey = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (primary?.onClick) primary.onClick();
        else if (onPrimary) onPrimary();
      }
      if ((event.key === 'r' || event.key === 'R') && (secondary?.hotkey === 'r' || hint?.includes('R'))) {
        event.preventDefault();
        if (secondary?.onClick) secondary.onClick();
        else if (onSecondary) onSecondary();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary, secondary, onPrimary, onSecondary, hint]);

  const primaryClick = primary?.onClick || onPrimary;
  const secondaryClick = secondary?.onClick || onSecondary;
  const Mark = tone === 'danger' ? FailMark : YieldMark;
  const meterPct = meter ? Math.max(0, Math.min(100, meter.value)) : 0;

  const chassis = (
    <section className="vr-chassis" role="dialog" aria-labelledby="vr-title" aria-describedby={body ? 'vr-body' : undefined}>
      <span className="vr-screws" aria-hidden="true" />
      <span className="vr-screw vr-screw--tl" aria-hidden="true" />
      <span className="vr-screw vr-screw--tr" aria-hidden="true" />
      <span className="vr-screw vr-screw--bl" aria-hidden="true" />
      <span className="vr-screw vr-screw--br" aria-hidden="true" />
      {kicker ? <div className="vr-kicker">{kicker}</div> : null}
      <div className="vr-mark" aria-hidden="true"><Mark size={32} /></div>
      <h1 id="vr-title" className="vr-title">{title}</h1>
      {stars != null ? <ProbeBins n={stars} /> : null}
      {body ? <p id="vr-body" className="vr-body">{body}</p> : null}
      {stats.length > 0 && (
        <div className="vr-stats">
          {stats.map((stat) => (
            <div key={stat.id} className="vr-stat" data-accent={stat.accent || 'ok'}>
              <span className="vr-stat__label">{stat.label}</span>
              <span className="vr-stat__value">
                {stat.prefix || ''}
                {typeof stat.value === 'number'
                  ? <TickNum value={stat.value} still={still} />
                  : stat.value}
                {stat.suffix || ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="vr-actions">
        {secondary?.label && (
          <Button
            size="sm"
            variant={tone === 'danger' ? 'ghost' : 'default'}
            onClick={secondaryClick}
          >
            {secondary.label}
          </Button>
        )}
        {primary?.label && (
          <Button
            variant={tone === 'danger' ? 'danger' : tone === 'brass' ? 'brass' : 'primary'}
            icon={tone === 'danger' ? <FailMark size={13} /> : <ChevronMark size={13} />}
            autoFocus
            onClick={primaryClick}
          >
            {primary.label}
          </Button>
        )}
      </div>
      {hint ? <div className="vr-hint">{hint}</div> : null}
    </section>
  );

  return (
    <div
      className={`sg-ui vr-root${overlay ? ' vr-overlay' : ''}`}
      data-victory-overlay={overlay ? '1' : '0'}
      data-victory-bay={meta.length || meter ? '1' : '0'}
      data-tone={tone}
      data-victory-still={still ? '1' : '0'}
      data-reduced-motion={reduced ? '1' : '0'}
    >
      {injectTokens ? <style>{TOKEN_CSS}</style> : null}
      <style>{VICTORY_CSS}</style>
      {overlay && (
        <div className="vr-banner">
          <span><strong>fab checkout</strong> · n4 terminal</span>
          <span>{banner || kicker}</span>
        </div>
      )}
      {overlay && (meta.length > 0 || meter) ? (
        <div className="vr-bay">
          <aside className="vr-ticket" aria-label="lot ticket">
            <div className="vr-ticket__label">lot ticket</div>
            {meta.map((row) => (
              <div key={row.label} className="vr-ticket__row">
                <span className="vr-ticket__k">{row.label}</span>
                <span className="vr-ticket__v">{row.value}</span>
              </div>
            ))}
          </aside>
          {chassis}
          {meter ? (
            <aside className="vr-meter" aria-label={meter.label}>
              <div className="vr-meter__label">{meter.label}</div>
              <div className="vr-meter__track">
                <div className="vr-meter__fill" style={{ height: `${meterPct}%` }} />
              </div>
              <div className="vr-meter__value">
                {typeof meter.value === 'number'
                  ? <TickNum value={meter.value} still={still} />
                  : meter.value}
                {meter.suffix || ''}
              </div>
            </aside>
          ) : <div />}
        </div>
      ) : chassis}
    </div>
  );
}

export { VictoryReport, ProbeBins, TickNum, VICTORY_CSS };

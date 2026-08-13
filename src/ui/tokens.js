// ============================================================
// SILICON GOTHIC — UI design tokens
// Single source for palette, type, space, motion. Components
// consume CSS custom properties only (no raw hex in JSX).
// ============================================================

function assetBase() {
  try {
    const b = import.meta.env && import.meta.env.BASE_URL;
    if (typeof b === 'string' && b.length) return b.endsWith('/') ? b : `${b}/`;
  } catch (e) { /* cjs / tests */ }
  return '/';
}

const FONT_BASE = assetBase();
const FONT_LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const FONT_DISPLAY = "'Oxanium', sans-serif";
const FONT_BODY = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

/** Canonical token map (JS consumers / tests). */
const TOKENS = {
  color: {
    bg: '#070a10',
    bgDeep: '#05070b',
    bgWash: '#0a0f16',
    bgElevated: '#0c1118',
    bgPanel: '#10161f',
    bgHover: '#16202c',
    ink: '#d7e0ea',
    inkMuted: '#8a9aab',
    inkDim: '#5a6a80',
    line: '#273245',
    lineStrong: '#3a4a63',
    brass: '#ffc76b',
    brassDeep: '#7a6310',
    brassTop: '#32280c',
    brassBottom: '#2b2208',
    cyan: '#7defff',
    cyanDeep: '#22d3ee',
    cyanTop: '#12343c',
    cyanBottom: '#0c2c33',
    cyanLine: '#1a6a78',
    danger: '#ff8b82',
    dangerDeep: '#b14a52',
    dangerTop: '#2a1216',
    dangerBottom: '#1a0c0e',
    ok: '#7ce7a2',
    focus: '#22d3ee',
  },
  font: {
    display: FONT_DISPLAY,
    body: FONT_BODY,
    mono: FONT_MONO,
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '24px',
    6: '32px',
  },
  radius: {
    sm: '2px',
    md: '4px',
  },
  motion: {
    fast: '120ms',
    med: '220ms',
    enter: '320ms',
    ease: 'cubic-bezier(.22,1,.36,1)',
    spring: 'cubic-bezier(.22,1.4,.36,1)',
  },
};

const TOKEN_CSS = `
@font-face{font-family:'Oxanium';font-style:normal;font-weight:600;font-display:swap;src:url('${FONT_BASE}fonts/oxanium-600.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'Oxanium';font-style:normal;font-weight:700;font-display:swap;src:url('${FONT_BASE}fonts/oxanium-700.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:400;font-display:swap;src:url('${FONT_BASE}fonts/ibm-plex-sans-400.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:500;font-display:swap;src:url('${FONT_BASE}fonts/ibm-plex-sans-500.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;font-display:swap;src:url('${FONT_BASE}fonts/jetbrains-mono-400.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:500;font-display:swap;src:url('${FONT_BASE}fonts/jetbrains-mono-500.woff2') format('woff2');unicode-range:${FONT_LATIN}}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:600;font-display:swap;src:url('${FONT_BASE}fonts/jetbrains-mono-600.woff2') format('woff2');unicode-range:${FONT_LATIN}}

:root, .tk-root, .sg-ui {
  --sg-bg: ${TOKENS.color.bg};
  --sg-bg-deep: ${TOKENS.color.bgDeep};
  --sg-bg-wash: ${TOKENS.color.bgWash};
  --sg-bg-elevated: ${TOKENS.color.bgElevated};
  --sg-bg-panel: ${TOKENS.color.bgPanel};
  --sg-bg-hover: ${TOKENS.color.bgHover};
  --sg-ink: ${TOKENS.color.ink};
  --sg-ink-muted: ${TOKENS.color.inkMuted};
  --sg-ink-dim: ${TOKENS.color.inkDim};
  --sg-line: ${TOKENS.color.line};
  --sg-line-strong: ${TOKENS.color.lineStrong};
  --sg-brass: ${TOKENS.color.brass};
  --sg-brass-deep: ${TOKENS.color.brassDeep};
  --sg-brass-top: ${TOKENS.color.brassTop};
  --sg-brass-bottom: ${TOKENS.color.brassBottom};
  --sg-cyan: ${TOKENS.color.cyan};
  --sg-cyan-deep: ${TOKENS.color.cyanDeep};
  --sg-cyan-top: ${TOKENS.color.cyanTop};
  --sg-cyan-bottom: ${TOKENS.color.cyanBottom};
  --sg-cyan-line: ${TOKENS.color.cyanLine};
  --sg-danger: ${TOKENS.color.danger};
  --sg-danger-deep: ${TOKENS.color.dangerDeep};
  --sg-danger-top: ${TOKENS.color.dangerTop};
  --sg-danger-bottom: ${TOKENS.color.dangerBottom};
  --sg-ok: ${TOKENS.color.ok};
  --sg-focus: ${TOKENS.color.focus};
  --sg-font-display: ${FONT_DISPLAY};
  --sg-font-body: ${FONT_BODY};
  --sg-font-mono: ${FONT_MONO};
  --sg-space-1: ${TOKENS.space[1]};
  --sg-space-2: ${TOKENS.space[2]};
  --sg-space-3: ${TOKENS.space[3]};
  --sg-space-4: ${TOKENS.space[4]};
  --sg-space-5: ${TOKENS.space[5]};
  --sg-space-6: ${TOKENS.space[6]};
  --sg-radius-sm: ${TOKENS.radius.sm};
  --sg-radius-md: ${TOKENS.radius.md};
  --sg-motion-fast: ${TOKENS.motion.fast};
  --sg-motion-med: ${TOKENS.motion.med};
  --sg-motion-enter: ${TOKENS.motion.enter};
  --sg-ease: ${TOKENS.motion.ease};
  --sg-spring: ${TOKENS.motion.spring};
}

.sg-ui {
  color: var(--sg-ink);
  font-family: var(--sg-font-body);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  font-variant-ligatures: contextual;
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--sg-brass) 14%, transparent) 0%, transparent 55%),
    radial-gradient(90% 70% at 85% 110%, color-mix(in srgb, var(--sg-cyan-deep) 12%, transparent) 0%, transparent 50%),
    linear-gradient(180deg, var(--sg-bg-wash) 0%, var(--sg-bg) 48%, var(--sg-bg-deep) 100%);
}

.sg-ui * { box-sizing: border-box; }
.sg-ui code, .sg-ui pre, .sg-ui kbd, .sg-ui .sg-mono, .sg-ui textarea, .sg-ui .cm-editor {
  font-family: var(--sg-font-mono);
  font-variant-ligatures: contextual;
  font-feature-settings: "calt" 1, "liga" 1;
}

.sg-ui .sg-display {
  font-family: var(--sg-font-display);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sg-ui .sg-eyebrow {
  font-family: var(--sg-font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--sg-ink-dim);
}

.sg-btn {
  --sg-btn-bg: linear-gradient(180deg, var(--sg-bg-hover), var(--sg-bg-elevated));
  --sg-btn-border: var(--sg-line);
  --sg-btn-ink: var(--sg-ink);
  --sg-btn-glow: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sg-space-2);
  border: 1px solid var(--sg-btn-border);
  background: var(--sg-btn-bg);
  color: var(--sg-btn-ink);
  padding: 8px 14px;
  border-radius: var(--sg-radius-sm);
  font-family: var(--sg-font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 transparent;
  transition:
    border-color var(--sg-motion-fast) var(--sg-ease),
    background var(--sg-motion-fast) var(--sg-ease),
    box-shadow var(--sg-motion-med) var(--sg-ease),
    transform 60ms linear;
}
.sg-btn:hover:not(:disabled) {
  border-color: var(--sg-line-strong);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 18px var(--sg-btn-glow);
}
.sg-btn:active:not(:disabled) { transform: translateY(1px); }
.sg-btn:focus-visible {
  outline: 2px solid var(--sg-focus);
  outline-offset: 2px;
}
.sg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sg-btn--sm { padding: 5px 10px; font-size: 12px; }
.sg-btn--lg { padding: 11px 18px; font-size: 14px; }

.sg-btn--primary {
  --sg-btn-bg: linear-gradient(180deg, var(--sg-cyan-top), var(--sg-cyan-bottom));
  --sg-btn-border: var(--sg-cyan-line);
  --sg-btn-ink: var(--sg-cyan);
  --sg-btn-glow: color-mix(in srgb, var(--sg-cyan-deep) 28%, transparent);
}
.sg-btn--primary:hover:not(:disabled) { --sg-btn-border: var(--sg-cyan-deep); }

.sg-btn--brass {
  --sg-btn-bg: linear-gradient(180deg, var(--sg-brass-top), var(--sg-brass-bottom));
  --sg-btn-border: var(--sg-brass-deep);
  --sg-btn-ink: var(--sg-brass);
  --sg-btn-glow: color-mix(in srgb, var(--sg-brass) 26%, transparent);
}
.sg-btn--brass:hover:not(:disabled) { --sg-btn-border: var(--sg-brass); }

.sg-btn--danger {
  --sg-btn-bg: linear-gradient(180deg, var(--sg-danger-top), var(--sg-danger-bottom));
  --sg-btn-border: var(--sg-danger-deep);
  --sg-btn-ink: var(--sg-danger);
  --sg-btn-glow: color-mix(in srgb, var(--sg-danger) 24%, transparent);
}
.sg-btn--danger:hover:not(:disabled) { --sg-btn-border: var(--sg-danger); }

.sg-btn--ghost {
  --sg-btn-bg: transparent;
  --sg-btn-border: transparent;
  --sg-btn-ink: var(--sg-ink-muted);
}
.sg-btn--ghost:hover:not(:disabled) {
  --sg-btn-ink: var(--sg-ink);
  background: rgba(255, 255, 255, 0.03);
}

.sg-panel {
  position: relative;
  background:
    linear-gradient(180deg, rgba(16, 22, 31, 0.96), rgba(10, 14, 20, 0.96));
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-radius-md);
  color: var(--sg-ink);
  padding: var(--sg-space-4);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 12px 40px rgba(0, 0, 0, 0.35);
}
.sg-panel::before,
.sg-panel::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--sg-brass) 55%, transparent);
  pointer-events: none;
}
.sg-panel::before {
  top: 6px;
  left: 6px;
  border-right: none;
  border-bottom: none;
}
.sg-panel::after {
  top: 6px;
  right: 6px;
  border-left: none;
  border-bottom: none;
}
.sg-panel__brackets {
  position: absolute;
  inset: 6px;
  pointer-events: none;
}
.sg-panel__brackets::before,
.sg-panel__brackets::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--sg-brass) 55%, transparent);
}
.sg-panel__brackets::before {
  left: 0;
  bottom: 0;
  border-right: none;
  border-top: none;
}
.sg-panel__brackets::after {
  right: 0;
  bottom: 0;
  border-left: none;
  border-top: none;
}
.sg-panel__title {
  font-family: var(--sg-font-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sg-brass);
  margin: 0 0 var(--sg-space-2);
}
.sg-panel__body {
  color: var(--sg-ink-muted);
  font-size: 13px;
  line-height: 1.55;
}
.sg-panel--tight { padding: var(--sg-space-3); }
.sg-panel--wide { padding: var(--sg-space-5); }

.sg-menu-row {
  --sg-row-border: var(--sg-line);
  --sg-row-bg: color-mix(in srgb, var(--sg-bg-elevated) 88%, transparent);
  --sg-row-title: var(--sg-ink);
  --sg-row-glow: transparent;
  --sg-row-ico-bg: color-mix(in srgb, var(--sg-cyan-deep) 12%, transparent);
  --sg-row-ico: var(--sg-cyan);
  display: flex;
  align-items: center;
  gap: 13px;
  width: min(340px, 84vw);
  padding: 12px 16px;
  border-radius: var(--sg-radius-sm);
  border: 1px solid var(--sg-row-border);
  background: var(--sg-row-bg);
  color: var(--sg-ink);
  font: inherit;
  cursor: pointer;
  text-align: left;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 0 transparent;
  transition:
    border-color var(--sg-motion-fast) var(--sg-ease),
    background var(--sg-motion-fast) var(--sg-ease),
    box-shadow var(--sg-motion-med) var(--sg-ease),
    transform 60ms linear;
}
.sg-menu-row:hover:not(:disabled) {
  border-color: var(--sg-brass);
  background: color-mix(in srgb, var(--sg-bg-hover) 92%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 22px var(--sg-row-glow);
}
.sg-menu-row:active:not(:disabled) { transform: translateY(1px); }
.sg-menu-row:focus-visible {
  outline: 2px solid var(--sg-focus);
  outline-offset: 2px;
}
.sg-menu-row:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sg-menu-row--primary {
  --sg-row-border: var(--sg-brass);
  --sg-row-bg: linear-gradient(180deg, var(--sg-brass-top), color-mix(in srgb, var(--sg-bg-elevated) 55%, var(--sg-brass-bottom)));
  --sg-row-title: var(--sg-cyan);
  --sg-row-glow: color-mix(in srgb, var(--sg-brass) 26%, transparent);
  --sg-row-ico-bg: color-mix(in srgb, var(--sg-cyan-deep) 22%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 18px var(--sg-row-glow);
}
.sg-menu-row--primary:hover:not(:disabled) {
  --sg-row-border: var(--sg-brass);
  --sg-row-glow: color-mix(in srgb, var(--sg-brass) 36%, transparent);
}
.sg-menu-row--danger {
  --sg-row-border: var(--sg-danger-deep);
  --sg-row-title: var(--sg-danger);
  --sg-row-glow: color-mix(in srgb, var(--sg-danger) 16%, transparent);
  --sg-row-ico: var(--sg-danger);
  --sg-row-ico-bg: color-mix(in srgb, var(--sg-danger) 14%, transparent);
}
.sg-menu-row__ico {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: var(--sg-radius-sm);
  background: var(--sg-row-ico-bg);
  color: var(--sg-row-ico);
  flex: none;
}
.sg-menu-row__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.sg-menu-row__title {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--sg-row-title);
}
.sg-menu-row__hint {
  font-size: 11px;
  color: var(--sg-ink-dim);
  white-space: normal;
}
.sg-menu-row__chev {
  color: var(--sg-ink-dim);
  flex: none;
  display: flex;
}

@media (prefers-reduced-motion: reduce) {
  .sg-btn,
  .sg-menu-row,
  .sg-list-row,
  .sg-tab,
  .sg-modal__panel,
  .sg-toast,
  .sg-progress__fill,
  .sg-combat,
  .sg-enter {
    transition: none !important;
    animation: none !important;
  }
}

@keyframes sg-enter {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.sg-enter {
  animation: sg-enter var(--sg-motion-enter) var(--sg-ease) both;
}

.sg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--sg-line);
  border-radius: var(--sg-radius-sm);
  font-family: var(--sg-font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--sg-ink-muted);
  background: color-mix(in srgb, var(--sg-bg-elevated) 80%, transparent);
}
.sg-badge--cyan { color: var(--sg-cyan); border-color: var(--sg-cyan-line); background: color-mix(in srgb, var(--sg-cyan) 10%, transparent); }
.sg-badge--brass { color: var(--sg-brass); border-color: var(--sg-brass-deep); background: color-mix(in srgb, var(--sg-brass) 10%, transparent); }
.sg-badge--danger { color: var(--sg-danger); border-color: var(--sg-danger-deep); background: color-mix(in srgb, var(--sg-danger) 10%, transparent); }
.sg-badge--ok { color: var(--sg-ok); border-color: color-mix(in srgb, var(--sg-ok) 40%, var(--sg-line)); background: color-mix(in srgb, var(--sg-ok) 10%, transparent); }

.sg-progress {
  height: 8px;
  background: var(--sg-bg-deep);
  border: 1px solid var(--sg-line);
  border-radius: 99px;
  overflow: hidden;
}
.sg-progress--sm { height: 4px; }
.sg-progress__fill {
  height: 100%;
  width: 0;
  border-radius: 99px;
  background: var(--sg-cyan);
  transition: width var(--sg-motion-med) var(--sg-ease);
}
.sg-progress--cyan .sg-progress__fill { background: linear-gradient(90deg, var(--sg-cyan-deep), var(--sg-cyan)); }
.sg-progress--brass .sg-progress__fill { background: linear-gradient(90deg, var(--sg-brass-deep), var(--sg-brass)); }
.sg-progress--ok .sg-progress__fill { background: var(--sg-ok); }
.sg-progress--danger .sg-progress__fill { background: var(--sg-danger); }

.sg-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 72px;
}
.sg-stat__label {
  font-family: var(--sg-font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sg-ink-dim);
}
.sg-stat__value {
  font-family: var(--sg-font-mono);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: var(--sg-ink);
  letter-spacing: 0.04em;
}
.sg-stat--cyan .sg-stat__value { color: var(--sg-cyan); }
.sg-stat--brass .sg-stat__value { color: var(--sg-brass); }
.sg-stat--ok .sg-stat__value { color: var(--sg-ok); }
.sg-stat--danger .sg-stat__value { color: var(--sg-danger); }
.sg-stat__delta { font-size: 11px; color: var(--sg-ok); }
.sg-stat__delta.is-down { color: var(--sg-danger); }

.sg-list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--sg-line);
  background: color-mix(in srgb, var(--sg-bg-elevated) 88%, transparent);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: var(--sg-radius-sm);
  transition: border-color var(--sg-motion-fast) var(--sg-ease), background var(--sg-motion-fast) var(--sg-ease);
}
.sg-list-row:hover:not(:disabled) { border-color: var(--sg-line-strong); background: var(--sg-bg-hover); }
.sg-list-row:focus-visible { outline: 2px solid var(--sg-focus); outline-offset: 2px; }
.sg-list-row.is-active {
  border-color: var(--sg-cyan-line);
  background: color-mix(in srgb, var(--sg-cyan) 8%, var(--sg-bg-elevated));
}
.sg-list-row.is-equipped { border-color: var(--sg-brass-deep); }
.sg-list-row:disabled { opacity: 0.45; cursor: not-allowed; }
.sg-list-row__copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.sg-list-row__title { font-size: 13.5px; font-weight: 600; color: var(--sg-ink); }
.sg-list-row__hint { font-size: 11px; color: var(--sg-ink-dim); }
.sg-list-row__meta { font-family: var(--sg-font-mono); font-size: 11px; color: var(--sg-brass); flex: none; }

.sg-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.sg-tab {
  border: 1px solid var(--sg-line);
  background: transparent;
  color: var(--sg-ink-muted);
  font-family: var(--sg-font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: var(--sg-radius-sm);
}
.sg-tab:hover { color: var(--sg-ink); border-color: var(--sg-line-strong); }
.sg-tab:focus-visible { outline: 2px solid var(--sg-focus); outline-offset: 2px; }
.sg-tab.is-active {
  color: var(--sg-cyan);
  border-color: var(--sg-cyan-line);
  background: color-mix(in srgb, var(--sg-cyan) 10%, transparent);
}

.sg-tooltip {
  position: relative;
  display: inline-flex;
}
.sg-tooltip__tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  padding: 5px 8px;
  background: var(--sg-bg-panel);
  border: 1px solid var(--sg-line-strong);
  color: var(--sg-ink);
  font-family: var(--sg-font-mono);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--sg-motion-fast) var(--sg-ease);
  z-index: 4;
}
.sg-tooltip:hover .sg-tooltip__tip,
.sg-tooltip:focus-within .sg-tooltip__tip { opacity: 1; }

.sg-toast-stack {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 95;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}
.sg-toast {
  padding: 10px 14px;
  border: 1px solid var(--sg-cyan-line);
  background: color-mix(in srgb, var(--sg-bg-panel) 94%, transparent);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--sg-bg-deep) 50%, transparent);
  animation: sg-enter var(--sg-motion-med) var(--sg-ease);
}
.sg-toast--brass { border-color: var(--sg-brass-deep); }
.sg-toast__title { font-size: 12.5px; color: var(--sg-cyan); }
.sg-toast--brass .sg-toast__title { color: var(--sg-brass); }
.sg-toast__sub { font-size: 11px; color: var(--sg-ink-dim); }

.sg-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: color-mix(in srgb, var(--sg-bg-deep) 78%, transparent);
  overflow: auto;
}
.sg-modal__panel {
  width: min(560px, 100%);
  max-height: 88vh;
  overflow: auto;
  animation: sg-enter var(--sg-motion-enter) var(--sg-ease);
}

.sg-combat {
  margin: 10px 0 4px;
  padding: 10px 14px;
  border: 1px solid var(--sg-line);
  background: linear-gradient(180deg, var(--sg-bg-panel), var(--sg-bg-elevated));
  color: var(--sg-ink);
  font-family: var(--sg-font-mono);
}
.sg-combat[data-boss="1"] { border-color: var(--sg-brass-deep); }
.sg-combat__row { display: flex; gap: 16px; flex-wrap: wrap; }
.sg-combat__col { flex: 1 1 200px; min-width: 180px; }
.sg-combat__label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--sg-ink-muted);
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.sg-combat__name { display: inline-flex; align-items: center; gap: 5px; }
.sg-combat__name.is-boss { color: var(--sg-brass); letter-spacing: 0.06em; }
.sg-combat__name.is-foe { color: var(--sg-danger); letter-spacing: 0.06em; }
.sg-combat__acts { display: flex; gap: 6px; margin-top: 7px; }
.sg-combat__phases { display: flex; gap: 4px; margin-top: 6px; align-items: center; }
.sg-combat__pip { flex: 1; height: 4px; background: var(--sg-line); }
.sg-combat__pip.is-on { background: var(--sg-brass); }
.sg-combat__pip.is-last { background: var(--sg-danger); }
.sg-combat__mech { margin-top: 6px; font-size: 10.5px; color: var(--sg-brass); }
.sg-combat__tele { font-size: 10px; color: var(--sg-ink-dim); margin-top: 7px; display: flex; justify-content: space-between; }
.sg-combat__feed { margin-top: 8px; border-top: 1px solid var(--sg-line); padding-top: 6px; }
.sg-combat__feed-line { font-size: 11px; color: var(--sg-ok); }
.sg-combat__feed-line.is-hit { color: var(--sg-danger); }
.sg-combat__feed-line.is-win { color: var(--sg-brass); }
`;

export { TOKENS, TOKEN_CSS, FONT_DISPLAY, FONT_BODY, FONT_MONO, FONT_BASE };

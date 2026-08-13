// ============================================================
// SILICON GOTHIC — UI design tokens
// Single source for palette, type, space, motion. Components
// consume CSS custom properties only (no raw hex in JSX).
// ============================================================

const FONT_DISPLAY = "'Oxanium', 'Segoe UI', sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Cascadia Code', monospace";

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
    ease: 'cubic-bezier(.22,1,.36,1)',
  },
};

const TOKEN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Oxanium:wght@500;600;700&display=swap');

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
  --sg-ease: ${TOKENS.motion.ease};
}

.sg-ui {
  color: var(--sg-ink);
  font-family: var(--sg-font-mono);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--sg-brass) 14%, transparent) 0%, transparent 55%),
    radial-gradient(90% 70% at 85% 110%, color-mix(in srgb, var(--sg-cyan-deep) 12%, transparent) 0%, transparent 50%),
    linear-gradient(180deg, var(--sg-bg-wash) 0%, var(--sg-bg) 48%, var(--sg-bg-deep) 100%);
}

.sg-ui * { box-sizing: border-box; }

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

@media (prefers-reduced-motion: reduce) {
  .sg-btn {
    transition: none !important;
  }
}
`;

export { TOKENS, TOKEN_CSS, FONT_DISPLAY, FONT_MONO };

// Custom fab glyphs — geometric marks, not stock lucide paths.

function FabMark({ size = 16, children, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{ display: 'block', flex: 'none' }}
    >
      {children}
    </svg>
  );
}

function PlayMark({ size }) {
  return (
    <FabMark size={size} label="play">
      <path
        d="M4 2.5v11l9-5.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path d="M1 1h2v2H1zm12 12h2v2h-2z" fill="currentColor" opacity="0.45" />
    </FabMark>
  );
}

function GearMark({ size }) {
  return (
    <FabMark size={size} label="settings">
      <rect x="1" y="1" width="3" height="3" fill="currentColor" opacity="0.4" />
      <rect x="12" y="12" width="3" height="3" fill="currentColor" opacity="0.4" />
      <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.6v2.2M8 12.2v2.2M1.6 8h2.2M12.2 8h2.2M3.2 3.2l1.6 1.6M11.2 11.2l1.6 1.6M12.8 3.2l-1.6 1.6M4.8 11.2l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
      />
    </FabMark>
  );
}

function ChipMark({ size }) {
  return (
    <FabMark size={size} label="chip">
      <rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6 1v3M10 1v3M6 12v3M10 12v3M1 6h3M1 10h3M12 6h3M12 10h3"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect x="6.5" y="6.5" width="3" height="3" fill="currentColor" opacity="0.7" />
    </FabMark>
  );
}

function SparkMark({ size }) {
  return (
    <FabMark size={size} label="new">
      <path
        d="M8 1.2l1.1 3.4 3.5.2-2.7 2.3.9 3.5L8 8.8 5.2 10.6l.9-3.5-2.7-2.3 3.5-.2z"
        fill="currentColor"
      />
      <path d="M2 2h1.6v1.6H2zm10.4 10.4H14V14h-1.6z" fill="currentColor" opacity="0.4" />
    </FabMark>
  );
}

function ReplayMark({ size }) {
  return (
    <FabMark size={size} label="replay">
      <path
        d="M3.2 8a4.8 4.8 0 1 0 1.4-3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <path d="M2.2 2.4v3.4h3.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
    </FabMark>
  );
}

function BookMark({ size }) {
  return (
    <FabMark size={size} label="codex">
      <path d="M3 2.5h4.2v11H3.8A1.3 1.3 0 0 1 2.5 12.2V4A1.5 1.5 0 0 1 4 2.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M13 2.5H8.8v11H12.2A1.3 1.3 0 0 0 13.5 12.2V4A1.5 1.5 0 0 0 12 2.5z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 3.2v9.6" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function SwordMark({ size }) {
  return (
    <FabMark size={size} label="boss rush">
      <path d="M9.2 1.6l5.2 5.2-1.2 1.2-5.2-5.2z" fill="currentColor" />
      <path d="M3.2 12.8l4.4-4.4 1.2 1.2-4.4 4.4z" fill="currentColor" opacity="0.75" />
      <path d="M2 14l2.2-.6-.6-2.2z" fill="currentColor" />
      <path d="M6.2 7.4l2.4 2.4" stroke="currentColor" strokeWidth="1.3" />
    </FabMark>
  );
}

function ArcadeMark({ size }) {
  return (
    <FabMark size={size} label="arcade">
      <rect x="2.5" y="5" width="11" height="7.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.6" cy="9" r="1.1" fill="currentColor" />
      <path d="M9.2 8.2h3.2M10.8 6.6v3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
      <path d="M5 3.2h6v1.8H5z" fill="currentColor" opacity="0.45" />
    </FabMark>
  );
}

function CoinMark({ size }) {
  return (
    <FabMark size={size} label="scrap">
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <path d="M8 5.2v5.6M6.4 6.4c.5-.6 1.1-.9 1.6-.9.9 0 1.5.5 1.5 1.2 0 1.5-3.1 1.1-3.1 2.6 0 .7.7 1.2 1.6 1.2.6 0 1.1-.2 1.5-.7" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </FabMark>
  );
}

function ChevronMark({ size }) {
  return (
    <FabMark size={size} label="next">
      <path d="M6 3.2l4.8 4.8L6 12.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
    </FabMark>
  );
}

export {
  FabMark,
  PlayMark,
  GearMark,
  ChipMark,
  SparkMark,
  ReplayMark,
  BookMark,
  SwordMark,
  ArcadeMark,
  CoinMark,
  ChevronMark,
};

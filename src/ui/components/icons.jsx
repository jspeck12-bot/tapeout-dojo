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

export { FabMark, PlayMark, GearMark, ChipMark };

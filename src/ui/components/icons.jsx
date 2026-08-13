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

function LockMark({ size }) {
  return (
    <FabMark size={size} label="sealed">
      <rect x="4" y="7" width="8" height="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.2" y="9.2" width="1.6" height="2.4" fill="currentColor" />
    </FabMark>
  );
}

function DieMark({ size }) {
  return (
    <FabMark size={size} label="die floorplan">
      <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 7h12M7 2v12M10 7v7M2 11h5" stroke="currentColor" strokeWidth="1.15" />
      <rect x="3.2" y="3.2" width="2.6" height="2.6" fill="currentColor" opacity="0.55" />
    </FabMark>
  );
}

function ScopeMark({ size }) {
  return (
    <FabMark size={size} label="debug bay">
      <rect x="1.5" y="3" width="13" height="10" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="3" y="4.5" width="7.5" height="5.5" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M3.4 8.2h1.2l.7-2 1 4 1.1-3.2.6 1.4H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="miter"
      />
      <circle cx="12.2" cy="6.2" r="0.9" fill="currentColor" />
      <circle cx="12.2" cy="9.4" r="0.9" fill="currentColor" opacity="0.55" />
    </FabMark>
  );
}

function HudMark({ size }) {
  return (
    <FabMark size={size} label="operator hud">
      <rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 4.2h4.2M3 6h2.8" stroke="currentColor" strokeWidth="1.15" />
      <circle cx="11.2" cy="5.2" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path d="M11.2 3.4v.6M11.2 6.4v.6M9.4 5.2h.6M12.4 5.2h.6" stroke="currentColor" strokeWidth="1.05" />
      <rect x="3" y="9.2" width="10" height="2.6" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path d="M4.2 10.5h3.4" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function MapMark({ size }) {
  return (
    <FabMark size={size} label="map">
      <path
        d="M2.2 3.2l3.6-1 4.2 1 3.8-1v11.2l-3.8 1-4.2-1-3.6 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="miter"
      />
      <path d="M5.8 2.4v11.2M10 3.2v11.2" stroke="currentColor" strokeWidth="1.1" opacity="0.75" />
      <circle cx="7.8" cy="8" r="1.15" fill="currentColor" />
    </FabMark>
  );
}

function BackMark({ size }) {
  return (
    <FabMark size={size} label="back">
      <path d="M10 3.2L5.2 8 10 12.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
      <path d="M5.6 8h7.2" stroke="currentColor" strokeWidth="1.3" />
    </FabMark>
  );
}

function YieldMark({ size }) {
  return (
    <FabMark size={size} label="yield report">
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5.2h6v5.6H5z" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path d="M5 7h6M7 5.2v5.6" stroke="currentColor" strokeWidth="1.05" />
      <path d="M3.6 11.4l2.2 2 4.8-5.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" />
    </FabMark>
  );
}

function FailMark({ size }) {
  return (
    <FabMark size={size} label="probe fail">
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="square" />
      <rect x="1.4" y="1.4" width="2.2" height="2.2" fill="currentColor" opacity="0.45" />
      <rect x="12.4" y="12.4" width="2.2" height="2.2" fill="currentColor" opacity="0.45" />
    </FabMark>
  );
}

function HeartMark({ size }) {
  return (
    <FabMark size={size} label="integrity">
      <path
        d="M8 13.2L3.2 8.2A3.1 3.1 0 0 1 8 4.2a3.1 3.1 0 0 1 4.8 4L8 13.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M8 6.2v3.4M6.3 7.9h3.4" stroke="currentColor" strokeWidth="1.1" />
    </FabMark>
  );
}

function SkullMark({ size }) {
  return (
    <FabMark size={size} label="hostile">
      <rect x="3.2" y="2.4" width="9.6" height="8.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6.2" cy="6.2" r="1.1" fill="currentColor" />
      <circle cx="9.8" cy="6.2" r="1.1" fill="currentColor" />
      <path d="M6.4 11.2v2.2M8 11.2v2.4M9.6 11.2v2.2" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function FlaskMark({ size }) {
  return (
    <FabMark size={size} label="ration">
      <path d="M6 2.2h4v3.2L12.4 12a2 2 0 0 1-1.9 2.6H5.5A2 2 0 0 1 3.6 12L6 5.4z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.4 9.2h3.2" stroke="currentColor" strokeWidth="1.15" />
    </FabMark>
  );
}

function SearchMark({ size }) {
  return (
    <FabMark size={size} label="search">
      <circle cx="7" cy="7" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.2 10.2L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </FabMark>
  );
}

function SoundMark({ size }) {
  return (
    <FabMark size={size} label="audio on">
      <path d="M2.4 6.2h2.4L8.2 3.6v8.8L4.8 9.8H2.4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" />
      <path d="M10.2 6.2c.8.7.8 2.9 0 3.6M12.2 4.8c1.6 1.4 1.6 5 0 6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function MuteMark({ size }) {
  return (
    <FabMark size={size} label="audio off">
      <path d="M2.4 6.2h2.4L8.2 3.6v8.8L4.8 9.8H2.4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" />
      <path d="M10.4 6.2l3.2 3.6M13.6 6.2l-3.2 3.6" stroke="currentColor" strokeWidth="1.3" />
    </FabMark>
  );
}

function CheckMark({ size }) {
  return (
    <FabMark size={size} label="ok">
      <rect x="1.6" y="1.6" width="12.8" height="12.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 8.2l2.6 2.6 5.4-5.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
    </FabMark>
  );
}

function StarMark({ size, filled }) {
  return (
    <FabMark size={size} label="star">
      <path
        d="M8 1.5l1.7 3.5 3.8.4-2.8 2.6.8 3.8L8 9.8 4.5 11.8l.8-3.8-2.8-2.6 3.8-.4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="miter"
      />
    </FabMark>
  );
}

function CloseMark({ size }) {
  return (
    <FabMark size={size} label="close">
      <rect x="1.6" y="1.6" width="12.8" height="12.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </FabMark>
  );
}

function DownMark({ size }) {
  return (
    <FabMark size={size} label="expand">
      <path d="M3.2 6l4.8 4.8L12.8 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="miter" />
    </FabMark>
  );
}

function EyeMark({ size }) {
  return (
    <FabMark size={size} label="reveal">
      <path d="M1.8 8c1.8-3.2 3.8-4.6 6.2-4.6S12.4 4.8 14.2 8c-1.8 3.2-3.8 4.6-6.2 4.6S3.6 11.2 1.8 8z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="8" cy="8" r="1.7" fill="currentColor" />
      <rect x="1.4" y="1.4" width="2" height="2" fill="currentColor" opacity="0.4" />
    </FabMark>
  );
}

function TimerMark({ size }) {
  return (
    <FabMark size={size} label="timer">
      <circle cx="8" cy="8.4" r="5.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.4 1.6h3.2M8 1.6v1.8M8 8.4l2.4-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </FabMark>
  );
}

function BugMark({ size }) {
  return (
    <FabMark size={size} label="defect">
      <rect x="4.2" y="3.2" width="7.6" height="8.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.2 6.4H1.8M11.8 6.4h2.4M4.2 9.4H2.2M11.8 9.4h2M8 3.2V1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6.2" cy="6.2" r="0.8" fill="currentColor" />
      <circle cx="9.8" cy="6.2" r="0.8" fill="currentColor" />
    </FabMark>
  );
}

function FlameMark({ size, filled }) {
  return (
    <FabMark size={size} label="streak">
      <path
        d="M8 1.8c1.2 2.2-.2 3.6-.2 5.2 0 1 .8 1.8 1.8 1.8 1.6 0 2.8-1.8 2.8-4 0 3.8-1.6 8.4-5.4 8.4S2.8 10.4 2.8 7.2C2.8 5 5.4 3.4 8 1.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </FabMark>
  );
}

function PickaxeMark({ size }) {
  return (
    <FabMark size={size} label="mines">
      <path d="M2.2 5.2h11.6L12 7.2H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" />
      <path d="M8 7.2v6.6M6.6 13.8h2.8" stroke="currentColor" strokeWidth="1.3" />
    </FabMark>
  );
}

function BinaryMark({ size }) {
  return (
    <FabMark size={size} label="gates">
      <rect x="2" y="2.4" width="5.2" height="11.2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <rect x="8.8" y="2.4" width="5.2" height="11.2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M3.4 5.2h2.4M3.4 8h2.4M10.2 5.2h2.4M11.4 8v3.2" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function MountainMark({ size }) {
  return (
    <FabMark size={size} label="canyon">
      <path d="M1.6 13.2L5.6 4.8 8 9.2 10.2 6.4 14.4 13.2z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" />
      <path d="M5.6 4.8l1.2 2.4" stroke="currentColor" strokeWidth="1.15" />
    </FabMark>
  );
}

function ClockMark({ size }) {
  return (
    <FabMark size={size} label="clock">
      <rect x="2.2" y="2.2" width="11.6" height="11.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.4v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" />
      <path d="M2.2 2.2h2.2v2.2H2.2zm9.4 9.4h2.2v2.2h-2.2z" fill="currentColor" opacity="0.45" />
    </FabMark>
  );
}

function CastleMark({ size }) {
  return (
    <FabMark size={size} label="keep">
      <path d="M2.4 14V6.2h2.2V3.6h2.2V6.2h2.4V3.6h2.2V6.2h2.2V14z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="miter" />
      <path d="M6.4 14v-3.4h3.2V14" stroke="currentColor" strokeWidth="1.2" />
    </FabMark>
  );
}

function WrenchMark({ size }) {
  return (
    <FabMark size={size} label="tool">
      <path d="M10.4 2.2l3.4 3.4-2 2-1.4-1.4-4.6 4.6-2.2 2.2-1.6-1.6 2.2-2.2 4.6-4.6-1.4-1.4z" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="miter" />
      <circle cx="12.2" cy="3.8" r="1.1" fill="currentColor" />
    </FabMark>
  );
}

function SkipMark({ size }) {
  return (
    <FabMark size={size} label="skip">
      <path d="M3 3.2v9.6l6.4-4.8z" fill="currentColor" />
      <path d="M11.4 3.2v9.6" stroke="currentColor" strokeWidth="1.5" />
    </FabMark>
  );
}

function LightMark({ size }) {
  return (
    <FabMark size={size} label="hint">
      <circle cx="8" cy="6.4" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.4 10.6h3.2v2.2H6.4zM7 13.6h2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.6v1.2M12.8 6.4h1.2M2 6.4h1.2" stroke="currentColor" strokeWidth="1.15" />
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
  LockMark,
  DieMark,
  ScopeMark,
  HudMark,
  MapMark,
  BackMark,
  YieldMark,
  FailMark,
  HeartMark,
  SkullMark,
  FlaskMark,
  SearchMark,
  SoundMark,
  MuteMark,
  CheckMark,
  StarMark,
  CloseMark,
  DownMark,
  EyeMark,
  TimerMark,
  BugMark,
  FlameMark,
  PickaxeMark,
  BinaryMark,
  MountainMark,
  ClockMark,
  CastleMark,
  WrenchMark,
  SkipMark,
  LightMark,
};

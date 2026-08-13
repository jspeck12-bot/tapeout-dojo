// Lucide-shaped API over custom fab marks — no stock library paths.
import {
  ArcadeMark,
  BackMark,
  BinaryMark,
  BookMark,
  BugMark,
  CastleMark,
  CheckMark,
  ChevronMark,
  ChipMark,
  ClockMark,
  CloseMark,
  CoinMark,
  DownMark,
  EyeMark,
  FlameMark,
  GearMark,
  LightMark,
  LockMark,
  MapMark,
  MountainMark,
  MuteMark,
  PickaxeMark,
  PlayMark,
  ReplayMark,
  ScopeMark,
  SkipMark,
  SoundMark,
  SparkMark,
  StarMark,
  SwordMark,
  TimerMark,
  WrenchMark,
  YieldMark,
} from './icons.jsx';

function fabIcon(Mark) {
  function Icon({ size = 16, color, fill, style, className, strokeWidth: _strokeWidth, ...rest }) {
    return (
      <span
        className={className}
        style={{ color: color || 'currentColor', display: 'inline-flex', lineHeight: 0, ...style }}
        {...rest}
      >
        <Mark size={size} filled={!!(fill && fill !== 'none')} />
      </span>
    );
  }
  Icon.displayName = Mark.name || 'FabIcon';
  return Icon;
}

const Award = fabIcon(YieldMark);
const Binary = fabIcon(BinaryMark);
const BookOpen = fabIcon(BookMark);
const Bug = fabIcon(BugMark);
const Castle = fabIcon(CastleMark);
const Check = fabIcon(CheckMark);
const ChevronDown = fabIcon(DownMark);
const ChevronLeft = fabIcon(BackMark);
const ChevronRight = fabIcon(ChevronMark);
const Clock = fabIcon(ClockMark);
const Coins = fabIcon(CoinMark);
const Cpu = fabIcon(ChipMark);
const Eye = fabIcon(EyeMark);
const Flame = fabIcon(FlameMark);
const Gamepad2 = fabIcon(ArcadeMark);
const Lightbulb = fabIcon(LightMark);
const Lock = fabIcon(LockMark);
const Medal = fabIcon(YieldMark);
const Mountain = fabIcon(MountainMark);
const Pickaxe = fabIcon(PickaxeMark);
const Play = fabIcon(PlayMark);
const RotateCcw = fabIcon(ReplayMark);
const Settings = fabIcon(GearMark);
const SkipForward = fabIcon(SkipMark);
const SlidersHorizontal = fabIcon(GearMark);
const Sparkles = fabIcon(SparkMark);
const Star = fabIcon(StarMark);
const Swords = fabIcon(SwordMark);
const Terminal = fabIcon(ScopeMark);
const Timer = fabIcon(TimerMark);
const Trophy = fabIcon(YieldMark);
const Volume2 = fabIcon(SoundMark);
const VolumeX = fabIcon(MuteMark);
const Wrench = fabIcon(WrenchMark);
const X = fabIcon(CloseMark);
const Zap = fabIcon(SparkMark);
const Map = fabIcon(MapMark);
const MapIcon = Map;

export {
  Award,
  Binary,
  BookOpen,
  Bug,
  Castle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  Flame,
  Gamepad2,
  Lightbulb,
  Lock,
  Map,
  MapIcon,
  Medal,
  Mountain,
  Pickaxe,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Star,
  Swords,
  Terminal,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
};

"use client";

import type { ComponentType, CSSProperties, HTMLAttributes } from "react";
import { useReducedMotion } from "motion/react";
// AnimateIcons / Lucide, disponível no catálogo 21st.dev (licença MIT).
import {
  ActivityIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  AtSignIcon,
  AttachFileIcon,
  BadgeAlertIcon,
  BellElectricIcon,
  BellIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  ChartBarIncreasingIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleChevronDownIcon,
  CircleChevronUpIcon,
  CircleDollarSignIcon,
  CircleHelpIcon,
  ClockIcon,
  CogIcon,
  CreditCardIcon,
  DatabaseIcon,
  DeleteIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FlameIcon,
  GavelIcon,
  HistoryIcon,
  IdCardIcon,
  KeyIcon,
  LayoutGridIcon,
  LoaderCircleIcon,
  LockIcon,
  LogoutIcon,
  MailCheckIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneNfcIcon,
  StampIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserRoundPlusIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "lucide-animated";
import { cn } from "@/lib/utils";

/**
 * Interface de compatibilidade para a migração dos ícones estáticos.
 * Os ícones do catálogo animado desenham o próprio traço; por isso
 * strokeWidth/absoluteStrokeWidth/weight são aceitos, mas não repassados.
 */
export interface AnimatedIconProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  size?: number;
  animateOnHover?: boolean;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
  weight?: string;
}

type AnimatedIconSource = ComponentType<
  HTMLAttributes<HTMLDivElement> & {
    size?: number;
    animateOnHover?: boolean;
  }
>;

function createAnimatedIcon(Source: AnimatedIconSource) {
  function AnimatedIcon({
    className,
    size,
    animateOnHover = true,
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absoluteStrokeWidth,
    weight: _weight,
    "aria-label": ariaLabel,
    "aria-hidden": ariaHidden,
    role,
    style,
    ...props
  }: AnimatedIconProps) {
    const reduceMotion = useReducedMotion();

    return (
      <Source
        {...props}
        className={cn("animated-icon", className)}
        size={size ?? 24}
        animateOnHover={animateOnHover && !reduceMotion}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
        role={role ?? (ariaLabel ? "img" : undefined)}
        data-animated-icon="true"
        style={size ? ({ width: size, height: size, ...style } satisfies CSSProperties) : style}
      />
    );
  }

  AnimatedIcon.displayName = `AnimatedIcon(${Source.displayName ?? Source.name ?? "Icon"})`;
  return AnimatedIcon;
}

const ActivityAnimated = createAnimatedIcon(ActivityIcon);
const AlertAnimated = createAnimatedIcon(BadgeAlertIcon);
const ArrowDownCircleAnimated = createAnimatedIcon(CircleChevronDownIcon);
const ArrowRightAnimated = createAnimatedIcon(ArrowRightIcon);
const ArrowUpCircleAnimated = createAnimatedIcon(CircleChevronUpIcon);
const ArrowUpRightAnimated = createAnimatedIcon(ArrowUpRightIcon);
const BarChartAnimated = createAnimatedIcon(ChartBarIncreasingIcon);
const BellAnimated = createAnimatedIcon(BellIcon);
const BellRingAnimated = createAnimatedIcon(BellElectricIcon);
const BookUserAnimated = createAnimatedIcon(IdCardIcon);
const BuildingAnimated = createAnimatedIcon(BriefcaseBusinessIcon);
const CalendarAnimated = createAnimatedIcon(CalendarDaysIcon);
const CalendarClockAnimated = createAnimatedIcon(ClockIcon);
const CheckAnimated = createAnimatedIcon(CircleCheckIcon);
const ChevronRightAnimated = createAnimatedIcon(ChevronRightIcon);
const CircleDollarAnimated = createAnimatedIcon(CircleDollarSignIcon);
const CircleHelpAnimated = createAnimatedIcon(CircleHelpIcon);
const ClockAnimated = createAnimatedIcon(ClockIcon);
const CreditCardAnimated = createAnimatedIcon(CreditCardIcon);
const DatabaseAnimated = createAnimatedIcon(DatabaseIcon);
const DownloadAnimated = createAnimatedIcon(DownloadIcon);
const EyeAnimated = createAnimatedIcon(EyeIcon);
const EyeOffAnimated = createAnimatedIcon(EyeOffIcon);
const FileAnimated = createAnimatedIcon(AttachFileIcon);
const FlameAnimated = createAnimatedIcon(FlameIcon);
const HistoryAnimated = createAnimatedIcon(HistoryIcon);
const KeyAnimated = createAnimatedIcon(KeyIcon);
const LayoutDashboardAnimated = createAnimatedIcon(LayoutGridIcon);
const LifeBuoyAnimated = createAnimatedIcon(CircleHelpIcon);
const ListChecksAnimated = createAnimatedIcon(CheckCheckIcon);
const LoaderAnimated = createAnimatedIcon(LoaderCircleIcon);
const LockAnimated = createAnimatedIcon(LockIcon);
const LogoutAnimated = createAnimatedIcon(LogoutIcon);
const EmailAnimated = createAnimatedIcon(AtSignIcon);
const MailAnimated = createAnimatedIcon(MailCheckIcon);
const PanelLeftCloseAnimated = createAnimatedIcon(PanelLeftCloseIcon);
const PanelLeftOpenAnimated = createAnimatedIcon(PanelLeftOpenIcon);
const RepeatAnimated = createAnimatedIcon(RefreshCwIcon);
const RotateCcwAnimated = createAnimatedIcon(RotateCcwIcon);
const ScaleAnimated = createAnimatedIcon(GavelIcon);
const SearchAnimated = createAnimatedIcon(SearchIcon);
const SettingsAnimated = createAnimatedIcon(CogIcon);
const ShieldCheckAnimated = createAnimatedIcon(ShieldCheckIcon);
const SlidersAnimated = createAnimatedIcon(SlidersHorizontalIcon);
const SmartphoneAnimated = createAnimatedIcon(SmartphoneNfcIcon);
const TagAnimated = createAnimatedIcon(StampIcon);
const TrashAnimated = createAnimatedIcon(DeleteIcon);
const TrendingDownAnimated = createAnimatedIcon(TrendingDownIcon);
const TrendingUpAnimated = createAnimatedIcon(TrendingUpIcon);
const UserPlusAnimated = createAnimatedIcon(UserRoundPlusIcon);
const UsersAnimated = createAnimatedIcon(UsersIcon);
const WalletAnimated = createAnimatedIcon(WalletIcon);
const XAnimated = createAnimatedIcon(XIcon);

export {
  ActivityAnimated as Activity,
  AlertAnimated as AlertTriangle,
  AlertAnimated as FileWarning,
  AlertAnimated as MailWarning,
  AlertAnimated as ShieldAlert,
  AlertAnimated as TriangleAlert,
  ArrowDownCircleAnimated as ArrowDownCircle,
  ArrowRightAnimated as ArrowRight,
  ArrowUpCircleAnimated as ArrowUpCircle,
  ArrowUpRightAnimated as ArrowUpRight,
  BarChartAnimated as BarChart3,
  BellAnimated as Bell,
  BellRingAnimated as BellRing,
  BookUserAnimated as BookUser,
  BuildingAnimated as Building2,
  CalendarAnimated as CalendarDays,
  CalendarAnimated as CalendarRange,
  CalendarClockAnimated as CalendarClock,
  CheckAnimated as CheckCircle2,
  CheckAnimated as CircleCheck,
  ChevronRightAnimated as ChevronRight,
  CircleDollarAnimated as CircleDollarSign,
  CircleHelpAnimated as CircleHelp,
  ClockAnimated as Clock3,
  CreditCardAnimated as CreditCard,
  DatabaseAnimated as Database,
  DownloadAnimated as Download,
  EyeAnimated as Eye,
  EyeOffAnimated as EyeSlash,
  FileAnimated as Paperclip,
  FlameAnimated as Flame,
  HistoryAnimated as History,
  KeyAnimated as Key,
  KeyAnimated as KeyRound,
  LayoutDashboardAnimated as LayoutDashboard,
  LifeBuoyAnimated as LifeBuoy,
  ListChecksAnimated as ListChecks,
  LoaderAnimated as CircleNotch,
  LockAnimated as Lock,
  LockAnimated as LockSimple,
  LogoutAnimated as LogOut,
  EmailAnimated as EnvelopeSimple,
  MailAnimated as Mail,
  PanelLeftCloseAnimated as PanelLeftClose,
  PanelLeftOpenAnimated as PanelLeftOpen,
  RepeatAnimated as Repeat,
  RotateCcwAnimated as RotateCcw,
  ScaleAnimated as Scale,
  SearchAnimated as Search,
  SettingsAnimated as Settings,
  ShieldCheckAnimated as ShieldCheck,
  SlidersAnimated as Filter,
  SlidersAnimated as SlidersHorizontal,
  SmartphoneAnimated as Smartphone,
  TagAnimated as Tag,
  TrashAnimated as Trash2,
  TrendingDownAnimated as TrendingDown,
  TrendingUpAnimated as TrendingUp,
  UserPlusAnimated as UserPlus,
  UsersAnimated as Users,
  WalletAnimated as Landmark,
  WalletAnimated as Wallet,
  CreditCardAnimated as WalletCards,
  XAnimated as X,
};

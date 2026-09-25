import { BadgeCheck, Hourglass, Sparkles, type LucideIcon } from "lucide-react";

export type VerificationStatus = "COMMUNITY_VERIFIED" | "PENDING_VERIFICATION" | "NEWLY_LISTED";

// The three states from the Homepage Full Body doc: green Community Verified, yellow Verification
// Pending, blue Newly Listed. Icon plus text so the state never relies on colour alone.
export const VERIFICATION_BADGES: Record<
  VerificationStatus,
  { label: string; Icon: LucideIcon; className: string }
> = {
  COMMUNITY_VERIFIED: {
    label: "Community Verified",
    Icon: BadgeCheck,
    className: "bg-green-100 text-green-800 ring-green-700/30",
  },
  PENDING_VERIFICATION: {
    label: "Verification Pending",
    Icon: Hourglass,
    className: "bg-amber-100 text-amber-900 ring-amber-700/30",
  },
  NEWLY_LISTED: {
    label: "Newly Listed",
    Icon: Sparkles,
    className: "bg-blue-100 text-blue-900 ring-blue-700/30",
  },
};

// "sm" is the compact pill used on listing cards; "md" is for the business page header.
const SIZES = {
  sm: { pill: "gap-1 px-2 py-0.5 text-xs", icon: "h-3.5 w-3.5" },
  md: { pill: "gap-1.5 px-3 py-1 text-sm", icon: "h-4 w-4" },
};

export default function VerificationBadge({
  status,
  size = "md",
  className = "",
}: {
  status: VerificationStatus;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { label, Icon, className: tone } = VERIFICATION_BADGES[status];
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${s.pill} ${tone} ${className}`}
    >
      <Icon className={`${s.icon} shrink-0`} aria-hidden="true" />
      {label}
    </span>
  );
}

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

export default function VerificationBadge({ status, className = "" }: { status: VerificationStatus; className?: string }) {
  const { label, Icon, className: tone } = VERIFICATION_BADGES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${tone} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

import Image from "next/image";

// The logo is a transparent PNG keyed from the client's JPEG (no vector or transparent original was
// supplied). It is designed for light backgrounds, so keep it on white or pale surfaces. Images are
// small static files, so optimisation is skipped (the standalone build does not ship sharp).
export default function Logo({ className = "h-11", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/bsd-logo-header.png"
      width={354}
      height={104}
      alt="BSD, Bangladeshi Business & Service Directory, Swansea Bay Edition. Find. Connect. Grow."
      className={`w-auto ${className}`}
      priority={priority}
      unoptimized
    />
  );
}

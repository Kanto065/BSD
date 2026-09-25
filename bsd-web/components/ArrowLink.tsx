import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function ArrowLink({
  href,
  children,
  direction = "right",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  direction?: "left" | "right";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group -my-2 inline-flex items-center gap-1.5 py-2 font-semibold text-brand-teal-dark hover:underline ${className}`}
    >
      {direction === "left" && (
        <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
      )}
      {children}
      {direction === "right" && (
        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}

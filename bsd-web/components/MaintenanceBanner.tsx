"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

// Site-wide notice above the header, switched on in the admin Site screen. The text arrives as plain strings and is
// rendered as text nodes only, never as HTML. It scrolls as a marquee, pauses on hover and focus and with the
// Pause button, and shows as static wrapped text when the visitor prefers reduced motion (see globals.css).
// data-copy-ignore keeps it out of the copy guard, because an admin may change it at any time.
export default function MaintenanceBanner({ lines }: { lines: string[] }) {
  const [paused, setPaused] = useState(false);
  if (lines.length === 0) return null;
  const items = lines.map((t, i) => (
    <span key={i} className="maint-item">
      {t}
    </span>
  ));
  return (
    <div data-copy-ignore role="status" className="maint flex min-h-11 items-center gap-2 bg-amber-400 px-4 text-sm font-semibold text-slate-900">
      <div className="maint-view min-w-0 flex-1" tabIndex={0} aria-label="Site notice">
        <div className="maint-track" data-paused={paused ? "true" : undefined}>
          {items}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="maint-pause inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 hover:bg-black/10"
      >
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        <span className="sr-only">{paused ? "Play notice" : "Pause notice"}</span>
      </button>
    </div>
  );
}

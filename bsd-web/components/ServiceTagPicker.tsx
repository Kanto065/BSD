"use client";

import { hasTag, showTag, toggleTag } from "@/lib/service-tags";

/**
 * Suggested "Services Offered" tags for the chosen category, as toggle chips. Choosing a chip adds the tag to the
 * Services offered text (one service per line), choosing it again removes it. People can still type their own lines,
 * the chips only follow what is in the field. Mounted next to the field by the forms (Submit and My listings).
 */
export function ServiceTagPicker({ tags, value, onChange }: { tags: string[]; value: string; onChange: (next: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <div role="group" aria-label="Suggested services" className="mt-2">
      <p className="text-sm text-slate-600">Tap to add a suggested service. You can also type your own below.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = hasTag(value, tag);
          return (
            <li key={tag}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(toggleTag(value, tag))}
                className={`press inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition sm:text-sm ${
                  on ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-teal"
                }`}
              >
                {showTag(tag)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { PUBLIC_LABELS as T } from "@/lib/pass-site-labels";
import { annualSaving, PERCENT, SPEND } from "@/lib/calculator";

type Range = { min: number; max: number; step: number };

function Slider({ label, shown, range, value, onChange }: { label: string; shown: string; range: Range; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm font-semibold text-bc-shell">
        <span>{label}</span>
        <span className="text-base text-teal-700">{shown}</span>
      </label>
      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-11 w-full cursor-pointer accent-teal-600"
      />
    </div>
  );
}

export default function Calculator() {
  const [spend, setSpend] = useState<number>(SPEND.start);
  const [pct, setPct] = useState<number>(PERCENT.start);
  return (
    <div className="space-y-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <Slider label={T.calcSpend} shown={`£${spend}`} range={SPEND} value={spend} onChange={setSpend} />
      <Slider label={T.calcPercent} shown={`${pct}%`} range={PERCENT} value={pct} onChange={setPct} />
      <div className="rounded-xl bg-teal-50 p-4 text-center" aria-live="polite">
        <p className="text-sm font-semibold text-teal-900">{T.calcResult}</p>
        <p className="font-heading text-4xl font-bold text-teal-700">£{annualSaving(spend, pct)}</p>
      </div>
      <p className="text-xs text-slate-600">{T.calcNote}</p>
    </div>
  );
}

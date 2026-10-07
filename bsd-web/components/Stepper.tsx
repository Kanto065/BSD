import { Check } from "lucide-react";

// A small step indicator for the Submit form. Plain markup and CSS, no dependency. The current step is marked with
// aria-current and the text "Step 2 of 5", so it does not rely on colour alone.

export default function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <nav aria-label="Progress">
      <p className="text-sm font-semibold text-brand-navy">
        Step {current + 1} of {steps.length}<span className="font-normal text-slate-600">, {steps[current]}</span>
      </p>
      <ol className="mt-3 flex gap-1.5" role="list">
        {steps.map((title, i) => (
          <li
            key={title}
            aria-current={i === current ? "step" : undefined}
            className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-md border text-xs font-semibold motion-safe:transition-colors ${
              i === current
                ? "border-brand-navy bg-brand-navy text-white"
                : i < current
                  ? "border-green-700 bg-green-50 text-green-800"
                  : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {i < current ? <Check className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
            <span className="sr-only">
              {title}
              {i < current ? ", done" : i === current ? ", current step" : ""}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Back and Next, 44px tall. The final step brings its own submit button instead of Next. */
export function StepButtons({ step, last, onBack, onNext }: { step: number; last: number; onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 0}
        className="press inline-flex min-h-11 items-center rounded-md border border-slate-300 px-6 text-base font-semibold text-brand-navy hover:border-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
      >
        Back
      </button>
      {step < last && (
        <button type="button" onClick={onNext} className="press inline-flex min-h-11 items-center rounded-md bg-brand-navy px-8 text-base font-semibold text-white hover:bg-brand-blue">
          Next
        </button>
      )}
    </div>
  );
}

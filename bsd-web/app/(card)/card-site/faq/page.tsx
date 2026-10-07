import type { Metadata } from "next";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import { FAQ_PASS, PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";

export const metadata: Metadata = { title: `${SITE_NAV.faq} | BSD Privilege Pass` };

// Native details elements, so the accordion works from the keyboard with no client script.
export default function Page() {
  return (
    <CardFrame>
      <CardMain title={SITE_NAV.faq} intro={T.faqIntro}>
        <div className="space-y-3">
          {FAQ_PASS.map((f) => (
            <details key={f.question} className="rounded-xl bg-white ring-1 ring-slate-200">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 font-semibold text-bc-shell">{f.question}</summary>
              <p className="px-4 pb-4 text-slate-700">{f.answer}</p>
            </details>
          ))}
        </div>
      </CardMain>
    </CardFrame>
  );
}

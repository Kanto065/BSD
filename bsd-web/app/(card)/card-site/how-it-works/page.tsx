import type { Metadata } from "next";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import { PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";

export const metadata: Metadata = { title: `${SITE_NAV.howItWorks} | BSD Privilege Pass` };

function Track({ title, steps }: { title: string; steps: readonly string[] }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-heading text-xl font-bold text-bc-shell">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </section>
  );
}

export default function Page() {
  return (
    <CardFrame>
      <CardMain title={SITE_NAV.howItWorks} intro={T.howIntro}>
        <div className="grid gap-4 md:grid-cols-2">
          <Track title={T.trackShop} steps={T.trackShopSteps} />
          <Track title={T.trackOnline} steps={T.trackOnlineSteps} />
        </div>
      </CardMain>
    </CardFrame>
  );
}

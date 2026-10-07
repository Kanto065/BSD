import type { Metadata } from "next";
import Link from "next/link";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import { PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";
import { SITES } from "@/lib/site";

export const metadata: Metadata = { title: `${SITE_NAV.merchants} | BSD Privilege Pass` };

const solid = "inline-flex min-h-11 items-center rounded-full bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800";
const ghost = "inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-bc-shell hover:border-teal-700";

export default function Page() {
  return (
    <CardFrame>
      <CardMain title={SITE_NAV.merchants} intro={T.merchantIntro}>
        <ul className="list-disc space-y-2 pl-5 text-slate-700">
          {T.merchantPoints.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`${SITES.bsd.origin}/submit`} className={solid}>{T.merchantRegister}</a>
          <a href={`${SITES.bsd.origin}/account`} className={ghost}>{T.merchantDashboard}</a>
          <Link href="/verify" className={ghost}>{T.merchantScanner}</Link>
        </div>
      </CardMain>
    </CardFrame>
  );
}

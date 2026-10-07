import type { Metadata } from "next";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import { SUPPORT_EMAIL } from "@/lib/content";
import { PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";

export const metadata: Metadata = { title: `${SITE_NAV.contact} | BSD Privilege Pass` };

export default function Page() {
  return (
    <CardFrame>
      <CardMain title={SITE_NAV.contact} intro={T.contactIntro}>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center rounded-full bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800">
          {SUPPORT_EMAIL}
        </a>
      </CardMain>
    </CardFrame>
  );
}

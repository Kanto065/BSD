import type { Metadata } from "next";
import Calculator from "@/components/card/Calculator";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import { PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";

export const metadata: Metadata = { title: `${SITE_NAV.calculator} | BSD Privilege Pass` };

export default function Page() {
  return (
    <CardFrame>
      <CardMain title={SITE_NAV.calculator} intro={T.calcIntro}>
        <Calculator />
      </CardMain>
    </CardFrame>
  );
}

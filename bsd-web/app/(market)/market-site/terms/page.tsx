import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import { LEGAL_PENDING } from "@/lib/market-account";

export const metadata: Metadata = { title: "Terms & Disclaimer | BSD Marketplace" };

// The text is supplied by the client (Q-M12-3). Until it arrives the page shows a holding line.
export default function Page() {
  return (
    <MarketFrame>
      <MarketMain title="Terms & Disclaimer">
        <p className="max-w-[60ch] rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">{LEGAL_PENDING}</p>
      </MarketMain>
    </MarketFrame>
  );
}

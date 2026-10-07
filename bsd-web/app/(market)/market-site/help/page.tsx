import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import HelpCenter from "@/components/market/HelpCenter";

export const metadata: Metadata = { title: "Help Center | BSD Marketplace" };

export default function Page() {
  return (
    <MarketFrame>
      <MarketMain title="Help Center">
        <HelpCenter />
      </MarketMain>
    </MarketFrame>
  );
}

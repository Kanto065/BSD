import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import MarketGate from "@/components/market/MarketGate";
import AccountTabs from "@/components/market/AccountTabs";
import { publicApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Account | BSD Marketplace" };

export default function Page() {
  const apiBase = publicApiBase();
  return (
    <MarketFrame>
      <MarketMain title="My Account">
        <MarketGate apiBase={apiBase} title="Sign in to see your account">{() => <AccountTabs apiBase={apiBase} />}</MarketGate>
      </MarketMain>
    </MarketFrame>
  );
}

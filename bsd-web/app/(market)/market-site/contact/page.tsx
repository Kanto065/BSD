import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import MarketGate from "@/components/market/MarketGate";
import AccountContact from "@/components/market/AccountContact";
import { publicApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact Support | BSD Marketplace" };

export default function Page() {
  const apiBase = publicApiBase();
  return (
    <MarketFrame>
      <MarketMain title="Contact Support" intro="Send a ticket and the BSD team will reply on your account page.">
        <MarketGate apiBase={apiBase} title="Sign in to contact support">{() => <AccountContact apiBase={apiBase} />}</MarketGate>
      </MarketMain>
    </MarketFrame>
  );
}

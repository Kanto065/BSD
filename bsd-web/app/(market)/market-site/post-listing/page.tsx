import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import PostForm from "@/components/market/PostForm";
import { publicApiBase } from "@/lib/api";
import { marketCategories, marketSpots } from "@/lib/market-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Post a Listing | BSD Marketplace" };

export default async function Page() {
  const [cats, spots] = await Promise.all([marketCategories(), marketSpots()]);
  return (
    <MarketFrame>
      <MarketMain title="Post a Listing">
        <PostForm apiBase={publicApiBase()} categories={cats.ok ? cats.data.categories : []} spots={spots.ok ? spots.data.spots : []} />
      </MarketMain>
    </MarketFrame>
  );
}

import type { Metadata } from "next";
import PassPage from "@/components/card/PassPage";
import PassSavings from "@/components/card/PassSavings";
import { publicApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My savings | BSD Privilege Pass" };

export default function Page() {
  return (
    <PassPage label="My savings">
      <PassSavings apiBase={publicApiBase()} />
    </PassPage>
  );
}

import type { Metadata } from "next";
import PassApp from "@/components/card/PassApp";
import PassPage from "@/components/card/PassPage";
import { publicApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My pass | BSD Privilege Pass" };

export default function Page() {
  return (
    <PassPage label="My pass">
      <PassApp apiBase={publicApiBase()} />
    </PassPage>
  );
}

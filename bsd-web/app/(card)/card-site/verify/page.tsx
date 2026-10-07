import type { Metadata } from "next";
import ScannerApp from "@/components/card/ScannerApp";
import PassPage from "@/components/card/PassPage";
import { publicApiBase } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan a pass | BSD Privilege Pass" };

export default function Page() {
  return (
    <PassPage label="Scan a pass">
      <ScannerApp apiBase={publicApiBase()} />
    </PassPage>
  );
}

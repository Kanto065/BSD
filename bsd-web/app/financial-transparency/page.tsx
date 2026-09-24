import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";
import { EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Financial Transparency",
  description: "BSD's financial transparency statement is being prepared.",
  alternates: { canonical: "/financial-transparency" },
  robots: { index: false, follow: true },
};

export default function FinancialTransparencyPage() {
  return (
    <PlaceholderPage
      title="Financial Transparency"
      message="Our financial transparency statement is being prepared and will be published here. Until then, questions about sponsorships, grants and print production budgets can be sent to our administration team."
      email={EMAILS.admin}
    />
  );
}

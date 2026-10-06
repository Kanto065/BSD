import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";
import { EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Complaints & Escalation Policy",
  description: "BSD's complaints and escalation policy is being prepared.",
  alternates: { canonical: "/complaints" },
  robots: { index: false, follow: true },
};

export default function ComplaintsPage() {
  return (
    <PlaceholderPage
      title="Complaints & Escalation Policy"
      message="Our complaints and escalation policy is being prepared and will be published here. Until then, please send any complaint or correction request to our support team."
      email={EMAILS.support}
    />
  );
}

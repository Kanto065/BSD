import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";
import { EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "BSD's community guidelines are being prepared.",
  alternates: { canonical: "/community-guidelines" },
  robots: { index: false, follow: true },
};

export default function CommunityGuidelinesPage() {
  return (
    <PlaceholderPage
      title="Community Guidelines"
      message="Our community guidelines are being prepared and will be published here. Until then, please get in touch with any questions."
      email={EMAILS.support}
    />
  );
}

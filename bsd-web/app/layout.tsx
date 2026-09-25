import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteChrome from "@/components/SiteChrome";
import { EMAILS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, ZONES } from "@/lib/content";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// Montserrat is the heading face from the client's brand (see the logo).
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-montserrat" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Swansea Bay`,
    template: `%s | BSD Swansea Bay`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/bsd-logo.png`,
    description: SITE_DESCRIPTION,
    parentOrganization: { "@type": "Organization", name: "BayConnect" },
    areaServed: ZONES.map((z) => `${z.name} (${z.postcodeLabel})`),
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer support", email: EMAILS.support },
      { "@type": "ContactPoint", contactType: "privacy and data protection", email: EMAILS.compliance },
      { "@type": "ContactPoint", contactType: "community outreach", email: EMAILS.community },
      { "@type": "ContactPoint", contactType: "partnerships and governance", email: EMAILS.admin },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <SiteChrome>
          <Header />
        </SiteChrome>
        <main className="flex-1">{children}</main>
        <SiteChrome>
          <Footer />
        </SiteChrome>
      </body>
    </html>
  );
}

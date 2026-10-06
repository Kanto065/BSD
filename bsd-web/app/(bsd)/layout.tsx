import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteChrome from "@/components/SiteChrome";
import BottomNav from "@/components/BottomNav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SUPPORT_EMAIL, ZONES } from "@/lib/content";

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

// viewportFit cover makes env(safe-area-inset-bottom) real on iPhones, for the bottom nav.
export const viewport: Viewport = { viewportFit: "cover" };

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
      { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL },
    ],
  };

  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="bsd-site flex min-h-dvh flex-col bg-white font-sans text-slate-900 antialiased">
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
        <BottomNav site="bsd" />
      </body>
    </html>
  );
}

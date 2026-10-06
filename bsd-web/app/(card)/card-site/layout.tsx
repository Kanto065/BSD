import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "../../globals.css";
import { SITES } from "@/lib/site";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-montserrat" });

const site = SITES.card;

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: site.name,
  description: site.description,
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/192" },
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
        <BottomNav site="card" />
      </body>
    </html>
  );
}

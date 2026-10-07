// The fixed list of site sections the admin can control (R-05 visibility, R-07 order and text).
// Anything not listed here cannot be hidden, reordered or edited. The web app keeps the matching list of
// paths and default copy in bsd-web/lib/sections.ts, and a test there checks the keys agree with this one.

export type SectionDef = {
  key: string;
  label: string;
  kind: "page" | "home" | "footer";
  /** Cannot be hidden (policy pages, submit, account). The value is the reason shown to the admin. */
  locked?: string;
  /** Which text fields the admin may override, with their maximum lengths. */
  text?: { title: number; body?: number };
};

export const SECTIONS: SectionDef[] = [
  { key: "about", label: "About Us page", kind: "page" },
  { key: "faq", label: "FAQ page", kind: "page" },
  { key: "contact", label: "Contact page", kind: "page" },
  { key: "coverage-area", label: "Coverage Area page", kind: "page" },
  { key: "community-initiative", label: "Community Initiative page", kind: "page" },
  { key: "bayconnect", label: "BayConnect page", kind: "page" },
  { key: "branding", label: "Branding page", kind: "page" },
  { key: "download-pdf", label: "Download PDF page", kind: "page" },
  { key: "free-access", label: "Free Access Policy", kind: "page", locked: "Policy pages stay visible." },
  { key: "verification-policy", label: "Verification Policy", kind: "page", locked: "Policy pages stay visible." },
  { key: "privacy", label: "Privacy Policy", kind: "page", locked: "Legal pages stay visible." },
  { key: "legal", label: "Legal Disclaimer", kind: "page", locked: "Legal pages stay visible." },
  { key: "submit", label: "Submit a business", kind: "page", locked: "Needed to add listings." },
  { key: "account", label: "Account", kind: "page", locked: "Needed to sign in." },
  { key: "home-categories", label: "Home: Popular Categories", kind: "home", text: { title: 80, body: 160 } },
  { key: "home-zones", label: "Home: Regional Zones", kind: "home", text: { title: 80, body: 160 } },
  { key: "home-featured", label: "Home: Featured businesses", kind: "home", text: { title: 80, body: 160 } },
  { key: "home-owner", label: "Home: Business owner panel", kind: "home", text: { title: 80, body: 200 } },
  { key: "home-how", label: "Home: How It Works", kind: "home", text: { title: 80, body: 160 } },
  { key: "home-faq", label: "Home: FAQ", kind: "home", text: { title: 80 } },
  { key: "footer-cta", label: "Banner above the footer", kind: "footer", text: { title: 100, body: 240 } },
];

export const SECTION_KEYS = new Set(SECTIONS.map((s) => s.key));
export const byKey = (key: string) => SECTIONS.find((s) => s.key === key);
/** The homepage blocks, in today's order. Only these can be reordered. */
export const HOME_KEYS = SECTIONS.filter((s) => s.kind === "home").map((s) => s.key);

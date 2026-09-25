import type { NextConfig } from "next";

// Category slugs that changed in the v2 taxonomy. The old URLs were live and are in the old sitemap, so they
// redirect permanently to the closest new category.
const RENAMED_CATEGORY_SLUGS: [from: string, to: string][] = [
  ["grocery-and-cash-and-carry", "groceries-and-halal"],
  ["health-and-wellbeing", "health-and-care"],
  ["beauty-and-henna-services", "beauty-and-lifestyle"],
  ["community-and-religious-services", "community-and-faith"],
  ["electrician-plumber-handyman", "trades-and-contractors"],
  ["professional-services", "legal-and-financial"],
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // How long the browser reuses a page it already loaded when moving between pages. Listing pages are never reused
  // (always fresh); fixed content pages for 30 seconds, the shortest Next.js allows (the default is 5 minutes).
  experimental: {
    staleTimes: { dynamic: 0, static: 30 },
  },
  async redirects() {
    return [
      // The v1 Community Transparency page is retired in favour of /financial-transparency.
      { source: "/transparency", destination: "/financial-transparency", permanent: true },
      // The v2 docs link to /coverage, the live page is /coverage-area.
      { source: "/coverage", destination: "/coverage-area", permanent: true },
      ...RENAMED_CATEGORY_SLUGS.map(([from, to]) => ({
        source: `/categories/${from}`,
        destination: `/categories/${to}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;

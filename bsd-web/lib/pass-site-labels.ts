// M11-E public Pass site wording. Page names are the client's (layout 2.2 and the tracker spec). Everything else is
// NEW, drafted by the developer, and needs PM and client sign-off (Q-M11-5, Q-M11-6). No savings figure is claimed.
// Locked against dashes and connector colons by pass-site.test.ts.

export const SITE_NAV = {
  howItWorks: "How It Works",
  partners: "Partner Shops",
  calculator: "Savings Calculator",
  merchants: "Merchant Hub",
  faq: "FAQ",
  contact: "Contact",
} as const;

export const PUBLIC_LABELS = {
  pill: "Free for Swansea Bay residents",
  heroTitle: "Your BSD Privilege Pass",
  heroBody: "A free digital pass for offers at Bangladeshi shops and services across Swansea Bay.",
  heroCta: "See partner shops",
  utilityNote: "Part of BayConnect CIC",
  howIntro: "Two simple ways to use your pass.",
  trackShop: "In the shop",
  trackShopSteps: ["Open your pass on your phone.", "Show the live QR code at the till.", "The shop confirms your discount."],
  trackOnline: "By phone or online",
  trackOnlineSteps: ["Open your pass and pick a partner offer.", "Tap Reveal Instant Discount Code.", "Quote the one time code when you order."],
  partnersIntro: "Shops that currently offer a discount to pass holders.",
  searchLabel: "Search partner shops",
  searchButton: "Search",
  allCategories: "All",
  zoneLabel: "Zone",
  noPartners: "No partner shops match yet. Try another search.",
  partnersDown: "Partner shops could not be loaded. Please try again soon.",
  calcIntro: "Move the sliders to see a rough yearly saving. It uses only the two numbers you choose.",
  calcSpend: "Spend at partner shops each month",
  calcPercent: "Average discount",
  calcResult: "Projected yearly saving",
  calcNote: "An estimate from your sliders only. Real savings depend on the offers you use.",
  merchantIntro: "Offer pass holders a discount and bring new customers through your door.",
  merchantPoints: [
    "Your offer shows on the Partner Shops page once the BSD team approves it.",
    "Customers show a live QR code or a one time code.",
    "You confirm each discount on your phone, no extra hardware.",
  ],
  merchantRegister: "List your business",
  merchantDashboard: "Open my dashboard",
  merchantScanner: "Open the scanner",
  faqIntro: "Quick answers about the Privilege Pass.",
  contactIntro: "For anything about the Privilege Pass, email the BSD team.",
  bannerTitle: "Ready to start saving?",
  bannerBody: "Open your free pass and show it at a partner shop.",
  bannerCta: "Open my pass",
  ecosystem: "Ecosystem Links",
  passColumn: "Privilege Pass",
  merchantColumn: "For Merchants",
  supportColumn: "Support",
} as const;

export const FAQ_PASS: { question: string; answer: string }[] = [
  { question: "What is the BSD Privilege Pass?", answer: "It is a free digital membership pass. Partner shops offer pass holders a discount." },
  { question: "How much does it cost?", answer: "Nothing. The pass is free to claim for people living in the Swansea Bay area." },
  { question: "How do I use my pass in a shop?", answer: "Open your pass on your phone and show the live QR code. The shop scans it and confirms your discount." },
  { question: "Can I use it without going into the shop?", answer: "Yes. Pick an offer on your pass and reveal a one time code. Quote it when you order by phone or online." },
  { question: "Can I use my pass on two phones?", answer: "Only one phone shows your pass at a time. You can move it to a new phone from the pass screen." },
];

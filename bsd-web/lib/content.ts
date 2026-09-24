import {
  ShoppingCart,
  UtensilsCrossed,
  Cookie,
  Shirt,
  Smartphone,
  CarFront,
  Wrench,
  Hammer,
  Zap,
  GraduationCap,
  Stethoscope,
  Dumbbell,
  Home,
  Sparkles,
  ChefHat,
  Briefcase,
  Building2,
  Scale,
  Landmark,
  Package,
  type LucideIcon,
} from "lucide-react";

// Verbatim copy and structured data pulled from the client's source docs. v2 docs win every
// conflict with v1. Do not paraphrase legal/privacy text. Every change to client legal or
// transparency wording is marked CLIENT-REVIEW and listed in BSD_Architecture_and_Build_Prompts.md
// section 7. New copy written here avoids em dashes.

export const SITE_NAME = "BSD – Bangladeshi Business & Service Directory";
export const SITE_TAGLINE = "Swansea Bay Edition";
export const SITE_URL = "https://bsd.wales";
export const SITE_DESCRIPTION =
  "Find trusted Bangladeshi businesses, services and professionals across Swansea, Neath Port Talbot and Carmarthenshire (SA1 to SA34). A free community directory powered by BayConnect.";

// The v2 mailbox set. info@, partnership@, urgent@ and privacy@ no longer exist.
export const EMAILS = {
  support: "support@bsd.wales",
  compliance: "compliance@bsd.wales",
  community: "community@bsd.wales",
  admin: "admin@bsd.wales",
} as const;

// ---------------------------------------------------------------------------
// Coverage: 3 zones covering SA1 to SA34, names and localities from the
// Regional Coverage Factsheet. SA21 to SA30 belong to no zone.
// ---------------------------------------------------------------------------

export type Zone = {
  slug: "zone-1" | "zone-2" | "zone-3";
  number: 1 | 2 | 3;
  name: string;
  /** Postcode range as the Factsheet writes it, e.g. "SA1–SA7". */
  postcodeLabel: string;
  districts: string[];
  /** Homepage card "Key Areas" (Homepage Full Body doc). */
  keyAreas: string;
  /** Full locality list (Factsheet "Key Coverage Areas"). */
  localities: string[];
};

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

export const ZONES: Zone[] = [
  {
    slug: "zone-1",
    number: 1,
    name: "Greater Swansea & Gower",
    postcodeLabel: "SA1–SA7",
    districts: range("SA", 1, 7),
    keyAreas: "Swansea City Centre, Uplands, Morriston, Sketty, Mumbles, Gorseinon, Pontarddulais.",
    localities: [
      "Swansea City Centre",
      "Uplands",
      "Sketty",
      "Brynmill",
      "Saint Thomas",
      "Maritime Quarter",
      "Morriston",
      "Manselton",
      "Hafod",
      "Plasmarl",
      "Winch Wen",
      "Enterprise Park",
      "Mumbles",
      "Gower",
      "Killay",
      "Dunvant",
      "Gorseinon",
      "Pontarddulais",
      "Loughor",
    ],
  },
  {
    slug: "zone-2",
    number: 2,
    name: "Neath Port Talbot & Swansea Valley",
    postcodeLabel: "SA8–SA13",
    districts: range("SA", 8, 13),
    keyAreas: "Neath Town, Port Talbot, Aberavon, Pontardawe, Ystalyfera, Ystradgynlais.",
    localities: [
      "Neath Town Centre",
      "Briton Ferry",
      "Skewen",
      "Port Talbot",
      "Aberavon",
      "Margam",
      "Pontardawe",
      "Alltwen",
      "Rhos",
      "Trebanos",
      "Ystalyfera",
      "Ystradgynlais",
      "Crynant",
      "Seven Sisters",
    ],
  },
  {
    slug: "zone-3",
    number: 3,
    name: "Carmarthenshire & West Wales",
    postcodeLabel: "SA14–SA20, SA31–SA34",
    districts: [...range("SA", 14, 20), ...range("SA", 31, 34)],
    keyAreas: "Llanelli, Carmarthen Town, Ammanford, Burry Port, Cross Hands, St Clears.",
    localities: [
      "Llanelli",
      "Burry Port",
      "Pembrey",
      "Kidwelly",
      "Ferryside",
      "Ammanford",
      "Cross Hands",
      "Tycroes",
      "Llandeilo",
      "Llandovery",
      "Carmarthen Town",
      "Saint Clears",
      "Laugharne",
      "Whitland",
    ],
  },
];

export const ALL_ZONES_LABEL = "All Zones (SA1 - SA34)";

export function zoneLabel(z: Zone): string {
  return `Zone ${z.number}: ${z.name} (${z.postcodeLabel})`;
}

export function findZone(slug: string | undefined): Zone | undefined {
  return ZONES.find((z) => z.slug === slug);
}

// ---------------------------------------------------------------------------
// Categories: the approved 20-category mapping. The first 14 are the v2 homepage tiles in
// the client's order. Old slugs redirect in next.config.ts.
// ---------------------------------------------------------------------------

export type Category = { name: string; slug: string; icon: LucideIcon; subcategories: string[] };

export const CATEGORIES: Category[] = [
  {
    name: "Restaurants & Takeaways",
    slug: "restaurants-and-takeaways",
    icon: UtensilsCrossed,
    subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali/Indian Takeaways"],
  },
  {
    name: "Legal & Financial",
    slug: "legal-and-financial",
    icon: Scale,
    subcategories: ["Accountants", "Legal Support", "Immigration Advisors", "Mortgage Advisors"],
  },
  {
    name: "Health & Care",
    slug: "health-and-care",
    icon: Stethoscope,
    subcategories: ["Physiotherapists", "Mental Wellbeing Support"],
  },
  {
    name: "Trades & Contractors",
    slug: "trades-and-contractors",
    icon: Hammer,
    subcategories: ["Handyman Services", "Home Maintenance"],
  },
  {
    name: "Groceries & Halal",
    slug: "groceries-and-halal",
    icon: ShoppingCart,
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Bangladeshi Spices & Essentials", "Cash & Carry Stores"],
  },
  {
    name: "Taxi & Private Hire",
    slug: "taxi-and-private-hire",
    icon: CarFront,
    subcategories: ["Private Hire Drivers", "Taxi Companies", "Airport Transfer Services"],
  },
  {
    name: "Beauty & Lifestyle",
    slug: "beauty-and-lifestyle",
    icon: Sparkles,
    subcategories: ["Makeup Artists", "Henna Artists", "Bridal Services", "Beauty Consultants"],
  },
  {
    name: "Community & Faith",
    slug: "community-and-faith",
    icon: Landmark,
    subcategories: ["Mosques", "Community Groups", "Cultural Organisations"],
  },
  {
    // CLIENT-REVIEW: no subcategories supplied for this v2 homepage label.
    name: "Business Consultants",
    slug: "business-consultants",
    icon: Building2,
    subcategories: [],
  },
  {
    name: "Mobile & Tech Repair",
    slug: "mobile-and-tech-repair",
    icon: Smartphone,
    subcategories: ["Mobile Repair", "Laptop Repair", "Accessories Shops", "Tech Support Services"],
  },
  {
    name: "Clothing & Cultural Shops",
    slug: "clothing-and-cultural-shops",
    icon: Shirt,
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding Outfits", "Cultural Accessories"],
  },
  {
    name: "Home-Based Food Services",
    slug: "home-based-food-services",
    icon: ChefHat,
    subcategories: ["Home Chefs", "Catering Services", "Tiffin Services", "Event Food Supply"],
  },
  {
    name: "Electrician / Plumber",
    slug: "electrician-plumber",
    icon: Zap,
    subcategories: ["Electricians", "Plumbers"],
  },
  {
    name: "Independent Professionals",
    slug: "independent-professionals",
    icon: Briefcase,
    subcategories: [
      "Freelance Electricians",
      "Freelance Plumbers",
      "Home-based Beauticians",
      "Home-based Barbers",
      "Freelance Photographers",
      "Event Decorators",
      "Driving Instructors",
      "Immigration Helpers",
      "Translators",
      "Community Advisors",
      "Car Mechanics (home-based)",
      "Tailors (home-based)",
      "Freelance IT Support",
      "Freelance Tutors",
      "Freelance Designers",
      "Any skilled individual without a physical office",
    ],
  },
  {
    name: "Sweet Shops & Bakeries",
    slug: "sweet-shops-and-bakeries",
    icon: Cookie,
    subcategories: ["Bangladeshi Sweets", "Cakes & Bakery Items", "Event Sweets & Catering", "Sweet Shops & Dessert Places"],
  },
  {
    name: "Car Services",
    slug: "car-services",
    icon: Wrench,
    subcategories: ["Car Repair", "MOT Centres", "Car Wash", "Tyre Shops"],
  },
  {
    name: "Tutors & Education",
    slug: "tutors-and-education",
    icon: GraduationCap,
    subcategories: ["Private Tutors", "Academic Coaching", "Quran/Arabic Teachers", "Language Classes"],
  },
  {
    name: "Property & Housing Services",
    slug: "property-and-housing-services",
    icon: Home,
    subcategories: ["Estate Agents", "Letting Services", "Housing Support"],
  },
  {
    // CLIENT-REVIEW: this category is our own split of Health & Wellbeing, needed to reach 20 categories.
    name: "Fitness & Wellbeing",
    slug: "fitness-and-wellbeing",
    icon: Dumbbell,
    subcategories: ["Massage Therapists", "Fitness Trainers"],
  },
  {
    name: "Others / Miscellaneous",
    slug: "others-miscellaneous",
    icon: Package,
    subcategories: ["Any service not listed above"],
  },
];

/** The 14 tiles on the v2 homepage "Popular Categories" grid. */
export const POPULAR_CATEGORIES = CATEGORIES.slice(0, 14);

export function findCategory(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export const CONTACT_CHANNELS: {
  title: string;
  email: string;
  description: string;
  points?: string[];
  response?: string;
}[] = [
  {
    title: "Support and General Enquiries",
    email: EMAILS.support,
    description:
      "For general questions about the directory, categories, coverage area, or community initiative. Also for help adding or updating a listing, and for any listing that contains incorrect or sensitive information that needs urgent correction.",
    points: [
      "General enquiries are answered within 3–5 working days",
      "Urgent corrections are handled within 24 hours",
      "Print edition sponsorship enquiries get details and rate cards by email",
    ],
  },
  {
    title: "Privacy and GDPR",
    email: EMAILS.compliance,
    description:
      "For privacy-related questions or requests, including how your data is used and your rights under UK data protection law.",
  },
  {
    title: "Community Outreach and Feedback",
    email: EMAILS.community,
    description:
      "For feedback, suggestions, corrections, or community collaboration. Also if you want to volunteer as a field representative, help with data verification, or support outreach events.",
    points: [
      "Suggest new categories",
      "Report incorrect information",
      "Provide community recommendations",
      "Request removal of a listing",
    ],
  },
  {
    title: "Partnerships and Governance",
    email: EMAILS.admin,
    description:
      // CLIENT-REVIEW (L3): "sponsorships" became "website sponsorships" so this stays consistent with print edition sponsorship being allowed.
      "BSD does not accept website sponsorships or advertisements, but community organisations may collaborate for non-commercial purposes such as community events, cultural programmes, student support initiatives, and welfare projects. Also for corporate partnerships, institutional inquiries, or governance questions.",
  },
];

export const OPERATING_HOURS = [
  { day: "Monday – Friday", hours: "10:00 AM – 6:00 PM" },
  { day: "Saturday", hours: "11:00 AM – 4:00 PM" },
  { day: "Sunday", hours: "Closed" },
];

// ---------------------------------------------------------------------------
// FAQ page (v1 doc, with the v2 edits noted inline)
// ---------------------------------------------------------------------------

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "What is BSD?",
    answer:
      "BSD (Bangladeshi Business & Service Directory – Swansea Bay Edition) is a free community directory that lists Bangladeshi businesses, service providers, and independent professionals across the Swansea Bay region.",
  },
  {
    question: "Is BSD free?",
    answer:
      // CLIENT-REVIEW (L3): "no sponsorships" became "no website sponsorships".
      "Yes. BSD is completely free until 30 June 2027. There are no listing fees, no website sponsorships, and no advertisements during this period.",
  },
  {
    question: "What happens after 30 June 2027?",
    answer:
      "BSD will continue operating, but may introduce optional premium features such as featured listings, sponsored categories, enhanced visibility, digital tools, and mobile app features. Basic listings will remain free, and any future changes will be announced publicly on bsd.wales.",
  },
  {
    question: "Who operates BSD?",
    answer: "BSD is operated under BayConnect, a community ecosystem serving the Bangladeshi community in Swansea Bay.",
  },
  {
    question: "Does BSD have volunteers?",
    answer:
      "Yes. BSD is supported by community volunteers who help with data collection, listing updates, category management, community communication, and print directory preparation. If you want to volunteer, contact us through the BSD Contact Page.",
  },
  {
    question: "What areas does BSD cover?",
    // v2 coverage wording (Regional Coverage Factsheet). The closing sentence is the v1 wording.
    answer:
      "BSD covers the Swansea Bay region and South West Wales across postcodes SA1 to SA34, organised into three zones. Zone 1 is Greater Swansea & Gower (SA1–SA7), Zone 2 is Neath Port Talbot & Swansea Valley (SA8–SA13), and Zone 3 is Carmarthenshire & West Wales (SA14–SA20 and SA31–SA34). Nearby areas may be added as the directory expands.",
  },
  {
    question: "How can I submit my business or service?",
    answer: "You can submit your listing through the official submission form.",
  },
  {
    question: "Can I update my listing later?",
    answer: "Yes. You can request updates anytime. Updates are usually processed within 3–7 working days.",
  },
  {
    question: "Can I remove my listing?",
    answer:
      "Yes. You may request removal at any time. Emergency removals (incorrect or sensitive information) are handled within 24 hours.",
  },
  {
    question: "Does BSD verify businesses?",
    answer:
      // CLIENT-REVIEW (L1): v1 answer was "No. BSD does not verify or guarantee the accuracy of any business
      // information. All listings are voluntarily submitted by business owners or service providers."
      // Reworded minimally to fit the v2 Community Verified badge.
      "Community Verified confirms contact and operating details only; it is not an endorsement or guarantee of service quality. BSD does not otherwise verify or guarantee the accuracy of business information. All listings are voluntarily submitted by business owners or service providers.",
  },
  {
    question: "Does BSD endorse listed businesses?",
    answer: "No. Inclusion in BSD does not imply endorsement, recommendation, or partnership.",
  },
  {
    question: "What types of businesses and services are included?",
    answer:
      "Shops, restaurants, takeaways, home-based services, professional services, and independent skilled individuals (electricians, plumbers, tutors, beauticians, etc.).",
  },
  {
    question: "What are Independent Professionals?",
    answer:
      "Independent Professionals are skilled individuals who provide services without a physical office. BSD includes a dedicated category for them to ensure equal visibility.",
  },
  {
    question: "How is my data used?",
    answer:
      "Your submitted information is used only for directory publication. BSD does not sell, share, or trade your data. You may request updates or removal at any time.",
  },
  {
    question: "Will BSD introduce premium services?",
    answer:
      "Possibly — but not before 30 June 2027. Premium listings, featured businesses, and sponsored categories may be introduced after essential preparations and formalities.",
  },
  {
    question: "What is the official BSD website?",
    answer: "The official website is: bsd.wales",
  },
];

// ---------------------------------------------------------------------------
// Homepage FAQ accordion (Homepage Full Body Section, answers verbatim)
// ---------------------------------------------------------------------------

export const HOME_FAQ: { question: string; answer: string }[] = [
  {
    question: "Is listing my business on bsd.wales completely free?",
    answer:
      "Yes, absolutely. Creating a standard business listing on bsd.wales is 100% free for all local businesses, self-employed professionals, and community services operating within SA postcodes (SA1–SA34). There are no mandatory fees, hidden maintenance charges, or subscription costs.",
  },
  {
    question: "What areas does the directory cover?",
    answer:
      // CLIENT-REVIEW (L5): the client's v2 copy says "Zone 3 (Carmarthenshire & Llanelli)". Changed to the
      // Factsheet zone name, per the decision that Factsheet zone names win.
      "BSD covers the entire Swansea Bay Region and South West Wales spanning postcodes SA1 to SA34. This includes Zone 1 (Greater Swansea & Gower), Zone 2 (Neath Port Talbot & Swansea Valley), and Zone 3 (Carmarthenshire & West Wales).",
  },
  {
    question: "How does the 'Community Verified' badge work?",
    answer:
      "The green Community Verified badge is awarded after our field volunteers cross-check a business's operational details, address, and phone number against official public records or direct contact. This ensures all contact info on our directory remains accurate and active.",
  },
  {
    question: "How can I update or claim an existing listing?",
    answer:
      'If your business is already listed and you wish to update contact details, upload a logo, or claim ownership, simply click the "Claim This Listing" button on the business profile page or email us at support@bsd.wales with proof of ownership.',
  },
];

// ---------------------------------------------------------------------------
// Verification (Regional Coverage Factsheet section 3)
// ---------------------------------------------------------------------------

export const VERIFICATION_INTRO =
  "To maintain public trust and prevent outdated information, all directory entries undergo a structured 3-tier verification check:";

export const VERIFICATION_TIERS = [
  {
    tier: "Tier 1",
    title: "Public Submission",
    description: "Business details submitted online or via field capture.",
  },
  {
    tier: "Tier 2",
    title: "Field Volunteer Audit",
    description: "Field representative cross-checks address, phone, & active status.",
  },
  {
    tier: "Tier 3",
    title: "Verified Status",
    description: 'Entry awarded green "Community Verified" badge.',
  },
];

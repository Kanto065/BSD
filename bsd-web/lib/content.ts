import {
  ShoppingCart,
  UtensilsCrossed,
  Cookie,
  Shirt,
  Smartphone,
  Wrench,
  Hammer,
  GraduationCap,
  Stethoscope,
  Home,
  Sparkles,
  ChefHat,
  Briefcase,
  BookOpen,
  Camera,
  Computer,
  HeartPulse,
  Key,
  Plane,
  Shield,
  Ticket,
  Truck,
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

// The "Creative Partner" credit in the footer, on /bayconnect and in the Factsheet PDF.
// studioUrl stays empty until the studio site is known, so the name renders as plain text (never a dead link).
export const CREATIVE_PARTNER = {
  name: "CREOVA Studio",
  studioUrl: "",
};

// Returns the studio URL only when it parses as https, else null.
export function creativePartnerHref(url: string = CREATIVE_PARTNER.studioUrl): string | null {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// The one public email address. The client revision of 2026-10-07 supersedes the four mailbox model.
export const SUPPORT_EMAIL = "support@bsd.wales";

// Shown wherever a page used to give another address. Needs client sign-off (the Contact page has no form).
export const CONTACT_FOOTER_NOTE = "Please contact us using the email address shown in the footer.";

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

export const ALL_ZONES_LABEL = "All Zones";

export function zoneShortLabel(z: Zone): string {
  return `Zone ${z.number}`;
}

export function zoneLabel(z: Zone): string {
  return `Zone ${z.number}: ${z.name} (${z.postcodeLabel})`;
}

export function findZone(slug: string | undefined): Zone | undefined {
  return ZONES.find((z) => z.slug === slug);
}

// ---------------------------------------------------------------------------
// Categories: the client's Master Category Directory (24 categories plus Others). Mirrors bsd-api/prisma/seed-data.ts,
// a test checks the two agree. This list is the fallback used when the API cannot be reached, so pages always render.
// The first 14 are the homepage tiles. Categories 18 to 24 are staged (hidden until an admin unlocks them), the
// fallback shows the visible ones only. Old category addresses redirect in next.config.ts.
// ---------------------------------------------------------------------------

export type Category = { name: string; slug: string; icon: LucideIcon; subcategories: string[]; serviceTags: string[]; staged?: boolean };

export const CATEGORIES: Category[] = [
  {
    name: "Grocery, Halal Meat & Cash Carry",
    slug: "groceries-and-halal",
    icon: ShoppingCart,
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Cash & Carry Stores", "Specialty Spices & Essentials"],
    serviceTags: ["FreshHalalMeat", "AsianSpices", "FrozenFish", "BangladeshiGrocery", "HomeDelivery", "BulkBuy"],
  },
  {
    name: "Restaurants, Takeaways & Street Food",
    slug: "restaurants-and-takeaways",
    icon: UtensilsCrossed,
    subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali & Indian Takeaways", "Street Food Vendors"],
    serviceTags: ["DineIn", "Takeaway", "TraditionalCurry", "KacchiBiriyani", "HalalCertified", "PartyOrders", "FreeDelivery"],
  },
  {
    name: "Sweet Shops, Desserts & Bakeries",
    slug: "sweet-shops-and-bakeries",
    icon: Cookie,
    subcategories: ["Bangladeshi Sweets (মিষ্টি)", "Cakes & Pastries", "Dessert Parlours", "Event Sweet Supplies"],
    serviceTags: ["Rosogolla", "MishtiDahi", "CustomCakes", "WeddingSweets", "SnacksAndSingara", "BakeryItems"],
  },
  {
    name: "Home-Based Food & Tiffin Services",
    slug: "home-based-food-services",
    icon: ChefHat,
    subcategories: ["Home Chefs", "Daily Tiffin Services", "Event Catering (Home-cooked)", "Custom Biriyani Cooks"],
    serviceTags: ["HomeCookedFood", "DailyTiffin", "StudentMealPlans", "BiriyaniSpecialist", "DessertMaker", "FrozenSnacks", "HomeCatering"],
  },
  {
    name: "Clothing, Cultural & Bridal Shops",
    slug: "clothing-and-cultural-shops",
    icon: Shirt,
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding & Festive Outfits", "Cultural Accessories"],
    serviceTags: ["BespokeSaree", "PanjabiCollection", "BridalWear", "KatanSaree", "TailoringAlterations", "CulturalJewellery"],
  },
  {
    name: "Hair, Beauty & Grooming Services",
    slug: "beauty-and-lifestyle",
    icon: Sparkles,
    subcategories: ["Men’s Barbers", "Ladies Salons & Parlours", "Makeup & Henna Artists", "Home-based Beauticians"],
    serviceTags: ["HairCutGrooming", "BridalMakeup", "HennaDesign", "FacialSkinCare", "HomeServiceBeautician", "BeardTrim"],
  },
  {
    name: "Mobile, Tech & Laptop Repairs",
    slug: "mobile-and-tech-repair",
    icon: Smartphone,
    subcategories: ["Mobile Repair Shops", "Laptop & Computer Repair", "Tech Support & Accessories", "Unlocking Services"],
    serviceTags: ["ScreenReplacement", "LaptopServicing", "DataRecovery", "MobileUnlocking", "TechAccessories", "HomeTechSupport"],
  },
  {
    name: "Automotive, Garages & Transport",
    slug: "car-services",
    icon: Wrench,
    subcategories: ["Car Repair Garages", "MOT Centres", "Car Wash & Valeting", "Tyre Shops", "Taxi & Airport Transfers"],
    serviceTags: ["MOTTesting", "CarServicing", "EngineDiagnostics", "TyreReplacement", "AirportTransfer", "PrivateHire", "HomeMechanic"],
  },
  {
    name: "Trades, Repairs & Home Maintenance",
    slug: "trades-and-contractors",
    icon: Hammer,
    subcategories: ["Electricians", "Plumbers", "Handyman & Painting", "Building & Construction"],
    serviceTags: ["BoilerRepair", "HouseRewiring", "LeakingTap", "PaintingDecorating", "FurnitureAssembly", "EmergencyPlumbing", "PropertyMaintenance"],
  },
  {
    name: "Professional, Financial & Remittance - Registered Firms",
    slug: "legal-and-financial",
    icon: Scale,
    subcategories: ["Accountants & Tax Advisors", "Money Transfer Agents", "Legal & Immigration Helpers", "Business Consultants"],
    serviceTags: ["TaxReturn", "SelfAssessment", "MoneyTransferBD", "VisaImmigrationSupport", "CompanyRegistration", "LegalAdvice"],
  },
  {
    name: "Travel, Umrah & Cargo Services",
    slug: "travel-umrah-and-cargo-services",
    icon: Plane,
    subcategories: ["Travel Agencies", "Umrah & Hajj Packages", "Cargo & Courier to BD", "Parcel Services"],
    serviceTags: ["FlightBooking", "UmrahPackages", "BDCargoParcel", "DoorToDoorCargo", "TravelInsurance"],
  },
  {
    name: "Property, Housing & Mortgages",
    slug: "property-and-housing-services",
    icon: Home,
    subcategories: ["Estate & Letting Agents", "Mortgage Advisors", "Property Management", "Housing Assistance"],
    serviceTags: ["StudentAccommodation", "PropertyRentals", "FirstTimeBuyer", "MortgageAdvice", "HouseWanted", "RoomAvailable"],
  },
  {
    name: "Education, Tutors & Language Classes",
    slug: "tutors-and-education",
    icon: GraduationCap,
    subcategories: ["Private Tutors (GCSE/A-Level)", "Quran & Arabic Teachers", "Language Classes", "Academic Coaching"],
    serviceTags: ["MathsTutor", "ScienceTutor", "QuranTutor", "BanglaLanguageClass", "ESOLLearning", "OnlineTuition"],
  },
  {
    name: "Health, Fitness & Care Services",
    slug: "health-and-care",
    icon: Stethoscope,
    subcategories: ["Physiotherapy & Massage", "Nutrition & Fitness Trainers", "Mental Wellbeing", "Childminders & Care Workers"],
    serviceTags: ["Physiotherapy", "PersonalTrainer", "MentalHealthSupport", "Childminding", "ElderlyCare", "HomeCareWorker"],
  },
  {
    name: "Media, Events & Creative Services",
    slug: "media-events-and-creative-services",
    icon: Camera,
    subcategories: ["Photographers & Videographers", "Event Decorators", "Graphic & Web Designers", "Signage & Printing"],
    serviceTags: ["WeddingPhotography", "EventDecoration", "LogoDesign", "BannerPrinting", "VideoEditing", "WebDevelopment"],
  },
  {
    name: "Community, Religious & Voluntary",
    slug: "community-and-faith",
    icon: Landmark,
    subcategories: ["Mosques & Islamic Centres", "Community Associations & CICs", "Cultural Organisations", "Youth Hubs"],
    serviceTags: ["PrayerServices", "CommunityAdvice", "YouthActivities", "CulturalEvents", "Volunteering", "DropInSupport"],
  },
  {
    name: "Independent Professionals (Office-less Hub)- Individual Freelancers",
    slug: "independent-professionals",
    icon: Briefcase,
    subcategories: ["Freelance Tradespeople", "Driving Instructors", "Translators & Interpreters", "Home Cleaners & Delivery"],
    serviceTags: ["DrivingLessons", "BanglaTranslation", "HouseCleaning", "DeliveryDriver", "FreelanceSkill", "NoPhysicalOffice"],
  },
  {
    name: "Digital Services & IT Solutions",
    slug: "digital-services-and-it-solutions",
    icon: Computer,
    staged: true,
    subcategories: ["Web & App Development", "Digital Marketing & SEO", "Hardware & IT Support", "AI & Cloud Services", "Graphic & Brand Design"],
    serviceTags: ["WebsiteDesign", "ECommerceWebsite", "SEO", "SEOStrategy", "SocialMediaMarketing", "SocialMediaManagement", "AppDevelopment", "MobileAppDev", "PCBuildAndRepair", "CloudHosting", "AIAssistantSetup", "LogoAndBranding", "ITConsulting", "CyberSecurity", "GoogleAdsManagement", "GraphicDesign", "DigitalMarketing"],
  },
  {
    name: "Insurance & Financial Protection",
    slug: "insurance-and-financial-protection",
    icon: Shield,
    staged: true,
    subcategories: ["Personal Insurance", "Commercial/Business Insurance", "Life & Health Protection", "Mortgage & Protection Advisory", "Insurance Brokers"],
    serviceTags: ["LifeInsurance", "BusinessLiability", "HomeInsurance", "VehicleInsurance", "MortgageProtection", "IncomeProtection", "CommercialProperty", "PublicLiability", "KeymanInsurance", "CritialIllnessCover", "FuneralInsurance", "LandlordInsurance"],
  },
  {
    name: "Health & Medical Professionals",
    slug: "health-and-medical-professionals",
    icon: HeartPulse,
    staged: true,
    subcategories: ["Private GP & Clinics", "Dental Care", "Pharmacy & Prescription", "Opticians & Eye Care", "Allied Health (Physio, Hijama, Nutrition)"],
    serviceTags: ["PrivateGP", "NHSPharmacy", "DentalCheckup", "TeethWhitening", "EyeTestAndGlasses", "Physiotherapy", "CuppingTherapyHijama", "NutritionAndDiet", "MentalHealthCounseling", "PrescriptionDelivery", "HearingTest", "PodiatryCare"],
  },
  {
    name: "Faith, Education & Cultural Schools",
    slug: "faith-education-and-cultural-schools",
    icon: BookOpen,
    staged: true,
    subcategories: ["Islamic & Quranic Studies", "Heritage & Bangla Language Schools", "Academic Tuition (GCSE/A-Level)", "Cultural & Performing Arts"],
    serviceTags: ["WeekendMadrasa", "QuranHifzClass", "TajweedTraining", "BanglaLanguageClass", "GCSEMathsTuition", "PrimarySchoolTuition", "CulturalArts", "IslamicCalligraphy", "AdultQuranLearning", "ScienceTuition", "ArabicLanguage", "IslamicHistory"],
  },
  {
    name: "Event Management, Decor & Media",
    slug: "event-management-decor-and-media",
    icon: Ticket,
    staged: true,
    subcategories: ["Wedding & Event Planning", "Venue Decor & Stage Styling", "Event Catering & Food Setup", "Photography, Videography & Media", "Sound, Lighting & Entertainment Services"],
    serviceTags: ["WeddingPlanner", "StageDecoration", "EventCatering", "SoundAndLighting", "Videography", "PhotoboothRental"],
  },
  {
    name: "Automobile, Transport & Logistics",
    slug: "automobile-transport-and-logistics",
    icon: Truck,
    staged: true,
    subcategories: ["Vehicle Repair, MOT & Servicing", "Private Hire & Executive Taxi", "Logistics, Removal & Freight (Man & Van)", "Breakdown & Vehicle Recovery", "Used Car Sales & Dealerships"],
    serviceTags: ["MOTAndServicing", "CarRepairs", "UsedCarSales", "TaxiAndPrivateHire", "ManAndVan", "BreakdownRecovery"],
  },
  {
    name: "Legal, Visa & Family Advisory",
    slug: "legal-visa-and-family-advisory",
    icon: Key,
    staged: true,
    subcategories: ["Immigration & Visa Advisory", "Conveyancing & Property Law", "Family & Matrimonial Advisory", "Wills, Estate Planning & Probate", "Civil & Commercial Legal Support"],
    serviceTags: ["ImmigrationLawyer", "SpouseVisa", "StudentVisaSupport", "WillWriting", "PowerOfAttorney", "Attestation"],
  },
  {
    name: "Others / Miscellaneous",
    slug: "others-miscellaneous",
    icon: Package,
    subcategories: ["Any service not listed above"],
    serviceTags: [],
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
  description: string;
  points?: string[];
  response?: string;
}[] = [
  {
    title: "Support and General Enquiries",
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
    description:
      "For privacy-related questions or requests, including how your data is used and your rights under UK data protection law.",
  },
  {
    title: "Community Outreach and Feedback",
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
// FAQ page (v1 doc, with the v2 edits noted inline). Answers keep the document's own structure: a string is a
// paragraph, { list } a bulleted list, { links } the document's linked lines.
// ---------------------------------------------------------------------------

export type FaqBlock = string | { list: string[] } | { links: { label: string; href: string }[] };

export const FAQ_ITEMS: { question: string; answer: FaqBlock[] }[] = [
  {
    question: "What is BSD?",
    answer: [
      "BSD (Bangladeshi Business & Service Directory – Swansea Bay Edition) is a free community directory that lists Bangladeshi businesses, service providers, and independent professionals across the Swansea Bay region.",
    ],
  },
  {
    question: "Is BSD free?",
    answer: [
      // CLIENT-REVIEW (L3): "no sponsorships" became "no website sponsorships".
      "Yes. BSD is completely free until 30 June 2027. There are no listing fees, no website sponsorships, and no advertisements during this period.",
    ],
  },
  {
    question: "What happens after 30 June 2027?",
    answer: [
      "BSD will continue operating, but may introduce optional premium features such as:",
      { list: ["Featured listings", "Sponsored categories", "Enhanced visibility", "Digital tools", "Mobile app features"] },
      "Basic listings will remain free, and any future changes will be announced publicly on bsd.wales.",
    ],
  },
  {
    question: "Who operates BSD?",
    answer: ["BSD is operated under BayConnect, a community ecosystem serving the Bangladeshi community in Swansea Bay."],
  },
  {
    question: "Does BSD have volunteers?",
    answer: [
      "Yes. BSD is supported by community volunteers who help with:",
      {
        list: [
          "Data collection",
          "Listing updates",
          "Category management",
          "Community communication",
          "Print directory preparation",
        ],
      },
      "If you want to volunteer, contact us through the BSD Contact Page.",
    ],
  },
  {
    question: "What areas does BSD cover?",
    // v2 coverage wording (Regional Coverage Factsheet) in place of the v1 town list. The closing sentence is the v1 wording.
    answer: [
      "BSD covers the Swansea Bay region and South West Wales across postcodes SA1 to SA34, organised into three zones:",
      {
        list: [
          "Zone 1: Greater Swansea & Gower (SA1–SA7)",
          "Zone 2: Neath Port Talbot & Swansea Valley (SA8–SA13)",
          "Zone 3: Carmarthenshire & West Wales (SA14–SA20, SA31–SA34)",
        ],
      },
      "Nearby areas may be added as the directory expands.",
    ],
  },
  {
    question: "How can I submit my business or service?",
    answer: [
      "You can submit your listing through the official submission form:",
      { links: [{ label: "Submit Your Listing", href: "/submit" }] },
    ],
  },
  {
    question: "Can I update my listing later?",
    answer: [
      "Yes. You can request updates anytime:",
      // Update requests are made from the listing's own page (the "Request an update" form) or through support@, both
      // explained on the Contact page.
      { links: [{ label: "Request Listing Update", href: "/contact#submit-or-update" }] },
      "Updates are usually processed within 3–7 working days.",
    ],
  },
  {
    question: "Can I remove my listing?",
    answer: [
      "Yes. You may request removal at any time. Emergency removals (incorrect or sensitive information) are handled within 24 hours.",
    ],
  },
  {
    question: "Does BSD verify businesses?",
    answer: [
      // CLIENT-REVIEW (L1): v1 answer was "No. BSD does not verify or guarantee the accuracy of any business
      // information. All listings are voluntarily submitted by business owners or service providers."
      // Reworded minimally to fit the v2 Community Verified badge.
      "Community Verified confirms contact and operating details only; it is not an endorsement or guarantee of service quality. BSD does not otherwise verify or guarantee the accuracy of business information. All listings are voluntarily submitted by business owners or service providers.",
    ],
  },
  {
    question: "Does BSD endorse listed businesses?",
    answer: ["No. Inclusion in BSD does not imply endorsement, recommendation, or partnership."],
  },
  {
    question: "What types of businesses and services are included?",
    answer: [
      "BSD includes:",
      {
        list: [
          "Shops",
          "Restaurants",
          "Takeaways",
          "Home-based services",
          "Professional services",
          "Independent skilled individuals (electricians, plumbers, tutors, beauticians, etc.)",
        ],
      },
    ],
  },
  {
    question: "What are Independent Professionals?",
    answer: [
      "Independent Professionals are skilled individuals who provide services without a physical office. BSD includes a dedicated category for them to ensure equal visibility.",
    ],
  },
  {
    question: "How is my data used?",
    answer: [
      "Your submitted information is used only for directory publication. BSD does not sell, share, or trade your data. You may request updates or removal at any time.",
    ],
  },
  {
    question: "Will BSD introduce premium services?",
    answer: [
      "Possibly, but not before 30 June 2027. Premium listings, featured businesses, and sponsored categories may be introduced after essential preparations and formalities.",
    ],
  },
  {
    question: "What is the official BSD website?",
    answer: ["The official website is: bsd.wales"],
  },
  {
    question: "How can I contact BSD?",
    answer: ["Visit the contact page:", { links: [{ label: "BSD Contact Page", href: "/contact" }] }],
  },
  {
    question: "Where can I read the Legal Disclaimer and Privacy Policy?",
    answer: [
      {
        links: [
          { label: "Legal Disclaimer", href: "/legal" },
          { label: "Privacy Policy", href: "/privacy" },
        ],
      },
    ],
  },
];

/** The answer as plain text, for the FAQPage structured data. */
export function faqAnswerText(answer: FaqBlock[]): string {
  return answer
    .map((b) => (typeof b === "string" ? b : "list" in b ? b.list.join("; ") + "." : b.links.map((l) => l.label).join(", ")))
    .join(" ");
}

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
      'If your business is already listed and you wish to update contact details, upload a logo, or claim ownership, simply click the "Claim This Listing" button on the business profile page or contact us with proof of ownership using the email address shown in the footer.',
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

// Seed data for the v2 taxonomy and coverage. Kept free of any Prisma import so unit tests can load it.
//
// Sources: the approved 20-category mapping (BSD_Architecture_and_Build_Prompts.md section 2) and the
// client's Regional Coverage Factsheet (zones, postcode districts and localities). The web app has a copy
// of this data in bsd-web/lib/content.ts until the API-backed pages replace it in the public browsing
// milestone, so change both together.

export type SeedCategory = { name: string; subcategories: string[]; requiresOwnerName?: boolean };

export const CATEGORIES: SeedCategory[] = [
  { name: "Restaurants & Takeaways", subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali/Indian Takeaways"] },
  { name: "Legal & Financial", subcategories: ["Accountants", "Legal Support", "Immigration Advisors", "Mortgage Advisors"] },
  { name: "Health & Care", subcategories: ["Physiotherapists", "Mental Wellbeing Support"] },
  { name: "Trades & Contractors", subcategories: ["Handyman Services", "Home Maintenance"] },
  {
    name: "Groceries & Halal",
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Bangladeshi Spices & Essentials", "Cash & Carry Stores"],
  },
  { name: "Taxi & Private Hire", subcategories: ["Private Hire Drivers", "Taxi Companies", "Airport Transfer Services"] },
  { name: "Beauty & Lifestyle", subcategories: ["Makeup Artists", "Henna Artists", "Bridal Services", "Beauty Consultants"] },
  { name: "Community & Faith", subcategories: ["Mosques", "Community Groups", "Cultural Organisations"] },
  { name: "Business Consultants", subcategories: [] },
  {
    name: "Mobile & Tech Repair",
    subcategories: ["Mobile Repair", "Laptop Repair", "Accessories Shops", "Tech Support Services"],
  },
  {
    name: "Clothing & Cultural Shops",
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding Outfits", "Cultural Accessories"],
  },
  { name: "Home-Based Food Services", subcategories: ["Home Chefs", "Catering Services", "Tiffin Services", "Event Food Supply"] },
  { name: "Electrician / Plumber", subcategories: ["Electricians", "Plumbers"] },
  {
    name: "Independent Professionals",
    requiresOwnerName: true,
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
    subcategories: ["Bangladeshi Sweets", "Cakes & Bakery Items", "Event Sweets & Catering", "Sweet Shops & Dessert Places"],
  },
  { name: "Car Services", subcategories: ["Car Repair", "MOT Centres", "Car Wash", "Tyre Shops"] },
  { name: "Tutors & Education", subcategories: ["Private Tutors", "Academic Coaching", "Quran/Arabic Teachers", "Language Classes"] },
  { name: "Property & Housing Services", subcategories: ["Estate Agents", "Letting Services", "Housing Support"] },
  { name: "Fitness & Wellbeing", subcategories: ["Massage Therapists", "Fitness Trainers"] },
  { name: "Others / Miscellaneous", subcategories: ["Any service not listed above"] },
];

// Categories that were only renamed in v2. The seed renames the existing row in place, so any listings
// attached to it keep their link. Categories that were split (Professional Services,
// Electrician/Plumber/Handyman, Health & Wellbeing) are not listed here on purpose: if a split category
// has listings the seed stops and asks for a human decision.
export const CATEGORY_RENAMES: Record<string, string> = {
  "Grocery & Cash & Carry": "Groceries & Halal",
  "Beauty & Henna Services": "Beauty & Lifestyle",
  "Community & Religious Services": "Community & Faith",
  "Others/Miscellaneous": "Others / Miscellaneous",
};

export type SeedZone = {
  slug: string;
  name: string;
  postcodeDistricts: string[];
  localities: string[];
};

const districts = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `SA${from + i}`);

// SA21 to SA30 belong to no zone in the Factsheet, so they are deliberately not listed.
export const ZONES: SeedZone[] = [
  {
    slug: "zone-1",
    name: "Greater Swansea & Gower",
    postcodeDistricts: districts(1, 7),
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
    name: "Neath Port Talbot & Swansea Valley",
    postcodeDistricts: districts(8, 13),
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
    name: "Carmarthenshire & West Wales",
    postcodeDistricts: [...districts(14, 20), ...districts(31, 34)],
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

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const categorySlug = (name: string) => slugify(name);
export const subcategorySlug = (categoryName: string, name: string) => slugify(`${categoryName}-${name}`);
export const localitySlug = (name: string) => slugify(name);

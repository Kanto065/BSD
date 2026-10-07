// Seed data for the v2 taxonomy and coverage. Kept free of any Prisma import so unit tests can load it.
//
// Sources: the approved 20-category mapping (BSD_Architecture_and_Build_Prompts.md section 2) and the
// client's Regional Coverage Factsheet (zones, postcode districts and localities). The web app has a copy
// of this data in bsd-web/lib/content.ts until the API-backed pages replace it in the public browsing
// milestone, so change both together.

import { slugify } from "../src/common/slug.js";

// Source: the client's "BSD Wales Master Category Directory" (decision D1: it replaces the older names). Names,
// sub-category order and tags follow the document word for word. The only edits are the ones storage needs: the
// leading # of a tag is removed (screens add it back), a stray comma after a tag and a full stop at the end of a
// sub-category list are dropped. The slug is fixed here, not derived from the name, so a renamed category keeps the
// web address it already has. Categories 18 to 24 are staged (hidden) until an admin unlocks them.
export type SeedCategory = {
  name: string;
  slug: string;
  icon?: string;
  subcategories: string[];
  serviceTags: string[];
  requiresOwnerName?: boolean;
  staged?: boolean;
};

export const CATEGORIES: SeedCategory[] = [
  {
    name: "Grocery, Halal Meat & Cash Carry",
    slug: "groceries-and-halal",
    icon: "shopping-cart",
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Cash & Carry Stores", "Specialty Spices & Essentials"],
    serviceTags: ["FreshHalalMeat", "AsianSpices", "FrozenFish", "BangladeshiGrocery", "HomeDelivery", "BulkBuy"],
  },
  {
    name: "Restaurants, Takeaways & Street Food",
    slug: "restaurants-and-takeaways",
    icon: "utensils-crossed",
    subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali & Indian Takeaways", "Street Food Vendors"],
    serviceTags: ["DineIn", "Takeaway", "TraditionalCurry", "KacchiBiriyani", "HalalCertified", "PartyOrders", "FreeDelivery"],
  },
  {
    name: "Sweet Shops, Desserts & Bakeries",
    slug: "sweet-shops-and-bakeries",
    icon: "cookie",
    subcategories: ["Bangladeshi Sweets (মিষ্টি)", "Cakes & Pastries", "Dessert Parlours", "Event Sweet Supplies"],
    serviceTags: ["Rosogolla", "MishtiDahi", "CustomCakes", "WeddingSweets", "SnacksAndSingara", "BakeryItems"],
  },
  {
    name: "Home-Based Food & Tiffin Services",
    slug: "home-based-food-services",
    icon: "chef-hat",
    subcategories: ["Home Chefs", "Daily Tiffin Services", "Event Catering (Home-cooked)", "Custom Biriyani Cooks"],
    serviceTags: ["HomeCookedFood", "DailyTiffin", "StudentMealPlans", "BiriyaniSpecialist", "DessertMaker", "FrozenSnacks", "HomeCatering"],
  },
  {
    name: "Clothing, Cultural & Bridal Shops",
    slug: "clothing-and-cultural-shops",
    icon: "shirt",
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding & Festive Outfits", "Cultural Accessories"],
    serviceTags: ["BespokeSaree", "PanjabiCollection", "BridalWear", "KatanSaree", "TailoringAlterations", "CulturalJewellery"],
  },
  {
    name: "Hair, Beauty & Grooming Services",
    slug: "beauty-and-lifestyle",
    icon: "sparkles",
    subcategories: ["Men’s Barbers", "Ladies Salons & Parlours", "Makeup & Henna Artists", "Home-based Beauticians"],
    serviceTags: ["HairCutGrooming", "BridalMakeup", "HennaDesign", "FacialSkinCare", "HomeServiceBeautician", "BeardTrim"],
  },
  {
    name: "Mobile, Tech & Laptop Repairs",
    slug: "mobile-and-tech-repair",
    icon: "smartphone",
    subcategories: ["Mobile Repair Shops", "Laptop & Computer Repair", "Tech Support & Accessories", "Unlocking Services"],
    serviceTags: ["ScreenReplacement", "LaptopServicing", "DataRecovery", "MobileUnlocking", "TechAccessories", "HomeTechSupport"],
  },
  {
    name: "Automotive, Garages & Transport",
    slug: "car-services",
    icon: "wrench",
    subcategories: ["Car Repair Garages", "MOT Centres", "Car Wash & Valeting", "Tyre Shops", "Taxi & Airport Transfers"],
    serviceTags: ["MOTTesting", "CarServicing", "EngineDiagnostics", "TyreReplacement", "AirportTransfer", "PrivateHire", "HomeMechanic"],
  },
  {
    name: "Trades, Repairs & Home Maintenance",
    slug: "trades-and-contractors",
    icon: "hammer",
    subcategories: ["Electricians", "Plumbers", "Handyman & Painting", "Building & Construction"],
    serviceTags: ["BoilerRepair", "HouseRewiring", "LeakingTap", "PaintingDecorating", "FurnitureAssembly", "EmergencyPlumbing", "PropertyMaintenance"],
  },
  {
    name: "Professional, Financial & Remittance - Registered Firms",
    slug: "legal-and-financial",
    icon: "scale",
    subcategories: ["Accountants & Tax Advisors", "Money Transfer Agents", "Legal & Immigration Helpers", "Business Consultants"],
    serviceTags: ["TaxReturn", "SelfAssessment", "MoneyTransferBD", "VisaImmigrationSupport", "CompanyRegistration", "LegalAdvice"],
  },
  {
    name: "Travel, Umrah & Cargo Services",
    slug: "travel-umrah-and-cargo-services",
    icon: "plane",
    subcategories: ["Travel Agencies", "Umrah & Hajj Packages", "Cargo & Courier to BD", "Parcel Services"],
    serviceTags: ["FlightBooking", "UmrahPackages", "BDCargoParcel", "DoorToDoorCargo", "TravelInsurance"],
  },
  {
    name: "Property, Housing & Mortgages",
    slug: "property-and-housing-services",
    icon: "house",
    subcategories: ["Estate & Letting Agents", "Mortgage Advisors", "Property Management", "Housing Assistance"],
    serviceTags: ["StudentAccommodation", "PropertyRentals", "FirstTimeBuyer", "MortgageAdvice", "HouseWanted", "RoomAvailable"],
  },
  {
    name: "Education, Tutors & Language Classes",
    slug: "tutors-and-education",
    icon: "graduation-cap",
    subcategories: ["Private Tutors (GCSE/A-Level)", "Quran & Arabic Teachers", "Language Classes", "Academic Coaching"],
    serviceTags: ["MathsTutor", "ScienceTutor", "QuranTutor", "BanglaLanguageClass", "ESOLLearning", "OnlineTuition"],
  },
  {
    name: "Health, Fitness & Care Services",
    slug: "health-and-care",
    icon: "stethoscope",
    subcategories: ["Physiotherapy & Massage", "Nutrition & Fitness Trainers", "Mental Wellbeing", "Childminders & Care Workers"],
    serviceTags: ["Physiotherapy", "PersonalTrainer", "MentalHealthSupport", "Childminding", "ElderlyCare", "HomeCareWorker"],
  },
  {
    name: "Media, Events & Creative Services",
    slug: "media-events-and-creative-services",
    icon: "camera",
    subcategories: ["Photographers & Videographers", "Event Decorators", "Graphic & Web Designers", "Signage & Printing"],
    serviceTags: ["WeddingPhotography", "EventDecoration", "LogoDesign", "BannerPrinting", "VideoEditing", "WebDevelopment"],
  },
  {
    name: "Community, Religious & Voluntary",
    slug: "community-and-faith",
    icon: "landmark",
    subcategories: ["Mosques & Islamic Centres", "Community Associations & CICs", "Cultural Organisations", "Youth Hubs"],
    serviceTags: ["PrayerServices", "CommunityAdvice", "YouthActivities", "CulturalEvents", "Volunteering", "DropInSupport"],
  },
  {
    name: "Independent Professionals (Office-less Hub)- Individual Freelancers",
    slug: "independent-professionals",
    icon: "briefcase",
    requiresOwnerName: true,
    subcategories: ["Freelance Tradespeople", "Driving Instructors", "Translators & Interpreters", "Home Cleaners & Delivery"],
    serviceTags: ["DrivingLessons", "BanglaTranslation", "HouseCleaning", "DeliveryDriver", "FreelanceSkill", "NoPhysicalOffice"],
  },
  // 18 to 24: ready in the backend, hidden until an admin unlocks them.
  {
    name: "Digital Services & IT Solutions",
    slug: "digital-services-and-it-solutions",
    icon: "computer",
    staged: true,
    subcategories: ["Web & App Development", "Digital Marketing & SEO", "Hardware & IT Support", "AI & Cloud Services", "Graphic & Brand Design"],
    serviceTags: [
      "WebsiteDesign", "ECommerceWebsite", "SEO", "SEOStrategy", "SocialMediaMarketing", "SocialMediaManagement", "AppDevelopment",
      "MobileAppDev", "PCBuildAndRepair", "CloudHosting", "AIAssistantSetup", "LogoAndBranding", "ITConsulting", "CyberSecurity",
      "GoogleAdsManagement", "GraphicDesign", "DigitalMarketing",
    ],
  },
  {
    name: "Insurance & Financial Protection",
    slug: "insurance-and-financial-protection",
    icon: "shield",
    staged: true,
    subcategories: ["Personal Insurance", "Commercial/Business Insurance", "Life & Health Protection", "Mortgage & Protection Advisory", "Insurance Brokers"],
    serviceTags: [
      "LifeInsurance", "BusinessLiability", "HomeInsurance", "VehicleInsurance", "MortgageProtection", "IncomeProtection",
      "CommercialProperty", "PublicLiability", "KeymanInsurance", "CritialIllnessCover", "FuneralInsurance", "LandlordInsurance",
    ],
  },
  {
    name: "Health & Medical Professionals",
    slug: "health-and-medical-professionals",
    icon: "heart-pulse",
    staged: true,
    subcategories: ["Private GP & Clinics", "Dental Care", "Pharmacy & Prescription", "Opticians & Eye Care", "Allied Health (Physio, Hijama, Nutrition)"],
    serviceTags: [
      "PrivateGP", "NHSPharmacy", "DentalCheckup", "TeethWhitening", "EyeTestAndGlasses", "Physiotherapy", "CuppingTherapyHijama",
      "NutritionAndDiet", "MentalHealthCounseling", "PrescriptionDelivery", "HearingTest", "PodiatryCare",
    ],
  },
  {
    name: "Faith, Education & Cultural Schools",
    slug: "faith-education-and-cultural-schools",
    icon: "book-open",
    staged: true,
    subcategories: ["Islamic & Quranic Studies", "Heritage & Bangla Language Schools", "Academic Tuition (GCSE/A-Level)", "Cultural & Performing Arts"],
    serviceTags: [
      "WeekendMadrasa", "QuranHifzClass", "TajweedTraining", "BanglaLanguageClass", "GCSEMathsTuition", "PrimarySchoolTuition",
      "CulturalArts", "IslamicCalligraphy", "AdultQuranLearning", "ScienceTuition", "ArabicLanguage", "IslamicHistory",
    ],
  },
  {
    name: "Event Management, Decor & Media",
    slug: "event-management-decor-and-media",
    icon: "ticket",
    staged: true,
    subcategories: [
      "Wedding & Event Planning",
      "Venue Decor & Stage Styling",
      "Event Catering & Food Setup",
      "Photography, Videography & Media",
      "Sound, Lighting & Entertainment Services",
    ],
    serviceTags: ["WeddingPlanner", "StageDecoration", "EventCatering", "SoundAndLighting", "Videography", "PhotoboothRental"],
  },
  {
    name: "Automobile, Transport & Logistics",
    slug: "automobile-transport-and-logistics",
    icon: "truck",
    staged: true,
    subcategories: [
      "Vehicle Repair, MOT & Servicing",
      "Private Hire & Executive Taxi",
      "Logistics, Removal & Freight (Man & Van)",
      "Breakdown & Vehicle Recovery",
      "Used Car Sales & Dealerships",
    ],
    serviceTags: ["MOTAndServicing", "CarRepairs", "UsedCarSales", "TaxiAndPrivateHire", "ManAndVan", "BreakdownRecovery"],
  },
  {
    name: "Legal, Visa & Family Advisory",
    slug: "legal-visa-and-family-advisory",
    icon: "key",
    staged: true,
    subcategories: [
      "Immigration & Visa Advisory",
      "Conveyancing & Property Law",
      "Family & Matrimonial Advisory",
      "Wills, Estate Planning & Probate",
      "Civil & Commercial Legal Support",
    ],
    serviceTags: ["ImmigrationLawyer", "SpouseVisa", "StudentVisaSupport", "WillWriting", "PowerOfAttorney", "Attestation"],
  },
  // Stays as it is. It feeds the admin taxonomy growth flow (the Others field on Submit).
  { name: "Others / Miscellaneous", slug: "others-miscellaneous", icon: "package", subcategories: ["Any service not listed above"], serviceTags: [] },
];

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

export { slugify };

export const categorySlug = (name: string) => slugify(name);
export const subcategorySlug = (categoryName: string, name: string) => slugify(`${categoryName}-${name}`);
export const localitySlug = (name: string) => slugify(name);

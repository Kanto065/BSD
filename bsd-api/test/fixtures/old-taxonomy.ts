// The 20 categories that were live before M9-B (the v2 taxonomy), copied from the old seed data. The migration test
// builds a production-like database from it, so it must not follow later changes to prisma/seed-data.ts.
import { slugify } from "../../src/common/slug.js";

export type OldCategory = { name: string; icon?: string; subcategories: string[]; requiresOwnerName?: boolean };

export const OLD_CATEGORIES: OldCategory[] = [
  { name: "Restaurants & Takeaways", icon: "utensils-crossed", subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali/Indian Takeaways"] },
  { name: "Legal & Financial", icon: "scale", subcategories: ["Accountants", "Legal Support", "Immigration Advisors", "Mortgage Advisors"] },
  { name: "Health & Care", icon: "stethoscope", subcategories: ["Physiotherapists", "Mental Wellbeing Support"] },
  { name: "Trades & Contractors", icon: "hammer", subcategories: ["Handyman Services", "Home Maintenance"] },
  {
    name: "Groceries & Halal",
    icon: "shopping-cart",
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Bangladeshi Spices & Essentials", "Cash & Carry Stores"],
  },
  { name: "Taxi & Private Hire", icon: "car-front", subcategories: ["Private Hire Drivers", "Taxi Companies", "Airport Transfer Services"] },
  { name: "Beauty & Lifestyle", icon: "sparkles", subcategories: ["Makeup Artists", "Henna Artists", "Bridal Services", "Beauty Consultants"] },
  { name: "Community & Faith", icon: "landmark", subcategories: ["Mosques", "Community Groups", "Cultural Organisations"] },
  { name: "Business Consultants", icon: "building-2", subcategories: [] },
  {
    name: "Mobile & Tech Repair",
    icon: "smartphone",
    subcategories: ["Mobile Repair", "Laptop Repair", "Accessories Shops", "Tech Support Services"],
  },
  {
    name: "Clothing & Cultural Shops",
    icon: "shirt",
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding Outfits", "Cultural Accessories"],
  },
  { name: "Home-Based Food Services", icon: "chef-hat", subcategories: ["Home Chefs", "Catering Services", "Tiffin Services", "Event Food Supply"] },
  { name: "Electrician / Plumber", icon: "zap", subcategories: ["Electricians", "Plumbers"] },
  {
    name: "Independent Professionals",
    icon: "briefcase",
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
    icon: "cookie",
    subcategories: ["Bangladeshi Sweets", "Cakes & Bakery Items", "Event Sweets & Catering", "Sweet Shops & Dessert Places"],
  },
  { name: "Car Services", icon: "wrench", subcategories: ["Car Repair", "MOT Centres", "Car Wash", "Tyre Shops"] },
  { name: "Tutors & Education", icon: "graduation-cap", subcategories: ["Private Tutors", "Academic Coaching", "Quran/Arabic Teachers", "Language Classes"] },
  { name: "Property & Housing Services", icon: "house", subcategories: ["Estate Agents", "Letting Services", "Housing Support"] },
  { name: "Fitness & Wellbeing", icon: "dumbbell", subcategories: ["Massage Therapists", "Fitness Trainers"] },
  { name: "Others / Miscellaneous", icon: "package", subcategories: ["Any service not listed above"] },
];


export const oldCategorySlug = (name: string) => slugify(name);
export const oldSubcategorySlug = (categoryName: string, name: string) => slugify(`${categoryName}-${name}`);

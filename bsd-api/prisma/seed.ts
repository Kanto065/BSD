import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// Full category + subcategory list from the client's Category Structure doc (BSD_Merged.docx).
const categories: { name: string; subcategories: string[]; requiresOwnerName?: boolean }[] = [
  {
    name: "Grocery & Cash & Carry",
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Bangladeshi Spices & Essentials", "Cash & Carry Stores"],
  },
  {
    name: "Restaurants & Takeaways",
    subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali/Indian Takeaways", "Sweet Shops & Dessert Places"],
  },
  {
    name: "Sweet Shops & Bakeries",
    subcategories: ["Bangladeshi Sweets", "Cakes & Bakery Items", "Event Sweets & Catering"],
  },
  {
    name: "Clothing & Cultural Shops",
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding Outfits", "Cultural Accessories"],
  },
  {
    name: "Mobile & Tech Repair",
    subcategories: ["Mobile Repair", "Laptop Repair", "Accessories Shops", "Tech Support Services"],
  },
  {
    name: "Taxi & Private Hire",
    subcategories: ["Private Hire Drivers", "Taxi Companies", "Airport Transfer Services"],
  },
  {
    name: "Car Services",
    subcategories: ["Car Repair", "MOT Centres", "Car Wash", "Tyre Shops"],
  },
  {
    name: "Electrician/Plumber/Handyman",
    subcategories: ["Electricians", "Plumbers", "Handyman Services", "Home Maintenance"],
  },
  {
    name: "Tutors & Education",
    subcategories: ["Private Tutors", "Academic Coaching", "Quran/Arabic Teachers", "Language Classes"],
  },
  {
    name: "Health & Wellbeing",
    subcategories: ["Physiotherapists", "Massage Therapists", "Fitness Trainers", "Mental Wellbeing Support"],
  },
  {
    name: "Property & Housing Services",
    subcategories: ["Estate Agents", "Letting Services", "Mortgage Advisors", "Housing Support"],
  },
  {
    name: "Beauty & Henna Services",
    subcategories: ["Makeup Artists", "Henna Artists", "Bridal Services", "Beauty Consultants"],
  },
  {
    name: "Home-Based Food Services",
    subcategories: ["Home Chefs", "Catering Services", "Tiffin Services", "Event Food Supply"],
  },
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
    name: "Professional Services",
    subcategories: ["Accountants", "Immigration Advisors", "Business Consultants", "Legal Support"],
  },
  {
    name: "Community & Religious Services",
    subcategories: ["Mosques", "Community Groups", "Cultural Organisations"],
  },
  {
    name: "Others/Miscellaneous",
    subcategories: ["Any service not listed above"],
  },
];

const coverageAreas = [
  "Swansea",
  "Neath Port Talbot",
  "Llanelli",
  "Gorseinon",
  "Mumbles",
  "Morriston",
  "Sketty",
  "Uplands",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  for (const [index, cat] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: { requiresOwnerName: cat.requiresOwnerName ?? false, sortOrder: index },
      create: {
        name: cat.name,
        slug: slugify(cat.name),
        sortOrder: index,
        requiresOwnerName: cat.requiresOwnerName ?? false,
      },
    });

    for (const sub of cat.subcategories) {
      await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: {},
        create: { name: sub, slug: slugify(`${cat.name}-${sub}`), categoryId: category.id },
      });
    }
  }

  for (const area of coverageAreas) {
    await prisma.coverageArea.upsert({
      where: { name: area },
      update: {},
      create: { name: area },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: "BSD Super Admin",
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
  } else {
    console.warn(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping initial admin user creation."
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

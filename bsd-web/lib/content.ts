// Verbatim copy and structured data pulled from the client's source doc (BSD_Merged.docx).
// Do not paraphrase legal/privacy text — see BSD_Architecture_and_Build_Prompts.md M4 notes.

export const SITE_NAME = "BSD – Bangladeshi Business & Service Directory";
export const SITE_TAGLINE = "Swansea Bay Edition";
export const SITE_URL = "https://bsd.wales";
export const SITE_DESCRIPTION =
  "Find trusted Bangladeshi businesses, services & professionals across Swansea Bay. Free community directory covering Swansea, Neath Port Talbot, Llanelli, Gorseinon, Mumbles, Morriston, Sketty and Uplands.";

export const COVERAGE_AREAS = [
  "Swansea",
  "Neath Port Talbot",
  "Llanelli",
  "Gorseinon",
  "Mumbles",
  "Morriston",
  "Sketty",
  "Uplands",
];

export const CATEGORIES: { name: string; slug: string; icon: string; subcategories: string[] }[] = [
  {
    name: "Grocery & Cash & Carry",
    slug: "grocery-and-cash-and-carry",
    icon: "🛒",
    subcategories: ["Asian Grocery", "Halal Meat Shops", "Bangladeshi Spices & Essentials", "Cash & Carry Stores"],
  },
  {
    name: "Restaurants & Takeaways",
    slug: "restaurants-and-takeaways",
    icon: "🍛",
    subcategories: ["Bangladeshi Restaurants", "Curry Houses", "Bengali/Indian Takeaways", "Sweet Shops & Dessert Places"],
  },
  {
    name: "Sweet Shops & Bakeries",
    slug: "sweet-shops-and-bakeries",
    icon: "🍰",
    subcategories: ["Bangladeshi Sweets", "Cakes & Bakery Items", "Event Sweets & Catering"],
  },
  {
    name: "Clothing & Cultural Shops",
    slug: "clothing-and-cultural-shops",
    icon: "🥻",
    subcategories: ["Asian Clothing", "Saree & Panjabi Stores", "Wedding Outfits", "Cultural Accessories"],
  },
  {
    name: "Mobile & Tech Repair",
    slug: "mobile-and-tech-repair",
    icon: "📱",
    subcategories: ["Mobile Repair", "Laptop Repair", "Accessories Shops", "Tech Support Services"],
  },
  {
    name: "Taxi & Private Hire",
    slug: "taxi-and-private-hire",
    icon: "🚕",
    subcategories: ["Private Hire Drivers", "Taxi Companies", "Airport Transfer Services"],
  },
  {
    name: "Car Services",
    slug: "car-services",
    icon: "🚗",
    subcategories: ["Car Repair", "MOT Centres", "Car Wash", "Tyre Shops"],
  },
  {
    name: "Electrician/Plumber/Handyman",
    slug: "electrician-plumber-handyman",
    icon: "🔧",
    subcategories: ["Electricians", "Plumbers", "Handyman Services", "Home Maintenance"],
  },
  {
    name: "Tutors & Education",
    slug: "tutors-and-education",
    icon: "📚",
    subcategories: ["Private Tutors", "Academic Coaching", "Quran/Arabic Teachers", "Language Classes"],
  },
  {
    name: "Health & Wellbeing",
    slug: "health-and-wellbeing",
    icon: "🩺",
    subcategories: ["Physiotherapists", "Massage Therapists", "Fitness Trainers", "Mental Wellbeing Support"],
  },
  {
    name: "Property & Housing Services",
    slug: "property-and-housing-services",
    icon: "🏠",
    subcategories: ["Estate Agents", "Letting Services", "Mortgage Advisors", "Housing Support"],
  },
  {
    name: "Beauty & Henna Services",
    slug: "beauty-and-henna-services",
    icon: "💄",
    subcategories: ["Makeup Artists", "Henna Artists", "Bridal Services", "Beauty Consultants"],
  },
  {
    name: "Home-Based Food Services",
    slug: "home-based-food-services",
    icon: "🍱",
    subcategories: ["Home Chefs", "Catering Services", "Tiffin Services", "Event Food Supply"],
  },
  {
    name: "Independent Professionals",
    slug: "independent-professionals",
    icon: "🧰",
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
    ],
  },
  {
    name: "Professional Services",
    slug: "professional-services",
    icon: "💼",
    subcategories: ["Accountants", "Immigration Advisors", "Business Consultants", "Legal Support"],
  },
  {
    name: "Community & Religious Services",
    slug: "community-and-religious-services",
    icon: "🕌",
    subcategories: ["Mosques", "Community Groups", "Cultural Organisations"],
  },
  {
    name: "Others/Miscellaneous",
    slug: "others-miscellaneous",
    icon: "✨",
    subcategories: ["Any service not listed above"],
  },
];

export const FEATURED_CATEGORY_SLUGS = [
  "grocery-and-cash-and-carry",
  "restaurants-and-takeaways",
  "mobile-and-tech-repair",
  "taxi-and-private-hire",
  "clothing-and-cultural-shops",
  "home-based-food-services",
  "electrician-plumber-handyman",
  "independent-professionals",
];

export const CONTACT_CHANNELS = [
  {
    title: "General Enquiries",
    email: "info@bsd.wales",
    response: "Within 3–5 working days",
    description:
      "For general questions about the directory, categories, coverage area, or community initiative.",
  },
  {
    title: "Community Support & Feedback",
    email: "community@bsd.wales",
    response: undefined,
    description:
      "Suggest new categories, report incorrect information, provide community recommendations, or request removal of a listing.",
  },
  {
    title: "Partnership & Collaboration (Non-Commercial)",
    email: "partnership@bsd.wales",
    response: undefined,
    description:
      "BSD does not accept sponsorships or advertisements, but community organisations may collaborate for non-commercial purposes such as community events, cultural programmes, student support initiatives, and welfare projects.",
  },
  {
    title: "Emergency Corrections",
    email: "urgent@bsd.wales",
    response: "Within 24 hours",
    description: "If any listing contains incorrect or sensitive information that needs urgent correction.",
  },
];

export const OPERATING_HOURS = [
  { day: "Monday – Friday", hours: "10:00 AM – 6:00 PM" },
  { day: "Saturday", hours: "11:00 AM – 4:00 PM" },
  { day: "Sunday", hours: "Closed" },
];

export const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "What is BSD?",
    answer:
      "BSD (Bangladeshi Business & Service Directory – Swansea Bay Edition) is a free community directory that lists Bangladeshi businesses, service providers, and independent professionals across the Swansea Bay region.",
  },
  {
    question: "Is BSD free?",
    answer:
      "Yes. BSD is completely free until 30 June 2027. There are no listing fees, no sponsorships, and no advertisements during this period.",
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
    answer:
      "BSD covers the wider Swansea Bay region, including Swansea, Neath Port Talbot, Llanelli, Gorseinon, Mumbles, Morriston, Sketty and Uplands. Nearby areas may be added as the directory expands.",
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
      "No. BSD does not verify or guarantee the accuracy of any business information. All listings are voluntarily submitted by business owners or service providers.",
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

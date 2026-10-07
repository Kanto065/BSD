import type { PrismaClient } from "@prisma/client";
import { normaliseTerm } from "../src/common/search.js";

// Starter list for the Bangla and English search synonyms (M10-A). It is a DRAFT drafted from the category names and
// service tags. A Bangla reader must review it. The admin edits it in the admin screen (Directory > Search synonyms),
// where these rows carry a "Starter" badge until someone edits them. Each row is [word, English words, category slug].

type Row = [string, string[], string?];

export const STARTER_SYNONYMS: Row[] = [
  // Food and groceries
  ["মুদি", ["grocery", "groceries"], "groceries-and-halal"],
  ["মুদি দোকান", ["grocery", "asian grocery"], "groceries-and-halal"],
  ["মুদিখানা", ["grocery", "asian grocery"], "groceries-and-halal"],
  ["mudi", ["grocery", "asian grocery"], "groceries-and-halal"],
  ["হালাল", ["halal"]],
  ["হালাল মাংস", ["halal meat", "FreshHalalMeat"], "groceries-and-halal"],
  ["মাংস", ["meat", "halal meat"]],
  ["মাছ", ["fish", "FrozenFish"]],
  ["mach", ["fish", "FrozenFish"]],
  ["মসলা", ["spices", "AsianSpices"], "groceries-and-halal"],
  ["moshla", ["spices", "AsianSpices"], "groceries-and-halal"],
  ["চাল", ["rice", "grocery"]],
  ["রেস্টুরেন্ট", ["restaurant", "restaurants"], "restaurants-and-takeaways"],
  ["restorent", ["restaurant"], "restaurants-and-takeaways"],
  ["হোটেল", ["restaurant", "restaurants"], "restaurants-and-takeaways"],
  ["খাবার", ["food", "restaurant", "takeaway"]],
  ["কারি", ["curry", "curry house"]],
  ["তরকারি", ["curry", "TraditionalCurry"]],
  ["বিরিয়ানি", ["biriyani", "biryani", "KacchiBiriyani"]],
  ["biryani", ["biriyani", "KacchiBiriyani"]],
  ["কাচ্চি", ["kacchi", "KacchiBiriyani"]],
  ["টেকওয়ে", ["takeaway", "takeaways"], "restaurants-and-takeaways"],
  ["ফুচকা", ["street food", "fuchka"], "restaurants-and-takeaways"],
  ["মিষ্টি", ["sweets", "sweet shop", "mishti"], "sweet-shops-and-bakeries"],
  ["mishti", ["sweets", "sweet shop"], "sweet-shops-and-bakeries"],
  ["মিষ্টির দোকান", ["sweets", "sweet shop"], "sweet-shops-and-bakeries"],
  ["রসগোল্লা", ["rosogolla", "sweets"], "sweet-shops-and-bakeries"],
  ["মিষ্টি দই", ["MishtiDahi", "sweets"], "sweet-shops-and-bakeries"],
  ["কেক", ["cake", "cakes", "CustomCakes"], "sweet-shops-and-bakeries"],
  ["বেকারি", ["bakery", "BakeryItems"], "sweet-shops-and-bakeries"],
  ["টিফিন", ["tiffin", "DailyTiffin"], "home-based-food-services"],
  ["tiffin", ["DailyTiffin", "home chef"], "home-based-food-services"],
  ["বাড়ির রান্না", ["home chef", "HomeCookedFood"], "home-based-food-services"],
  ["ক্যাটারিং", ["catering", "HomeCatering"]],
  // Clothing and beauty
  ["শাড়ি", ["saree", "sari"], "clothing-and-cultural-shops"],
  ["sharee", ["saree", "sari"], "clothing-and-cultural-shops"],
  ["পাঞ্জাবি", ["panjabi", "PanjabiCollection"], "clothing-and-cultural-shops"],
  ["panjabi", ["PanjabiCollection"], "clothing-and-cultural-shops"],
  ["কাপড়", ["clothing", "asian clothing"], "clothing-and-cultural-shops"],
  ["দর্জি", ["tailor", "TailoringAlterations"]],
  ["বিয়ের পোশাক", ["bridal", "BridalWear"], "clothing-and-cultural-shops"],
  ["পার্লার", ["beauty", "salon", "parlour"], "beauty-and-lifestyle"],
  ["parlour", ["beauty", "salon"], "beauty-and-lifestyle"],
  ["সেলুন", ["salon", "barber", "beauty"], "beauty-and-lifestyle"],
  ["নাপিত", ["barber", "HairCutGrooming"], "beauty-and-lifestyle"],
  ["চুল কাটা", ["haircut", "barber", "HairCutGrooming"], "beauty-and-lifestyle"],
  ["মেহেদি", ["henna", "HennaDesign"], "beauty-and-lifestyle"],
  ["mehedi", ["henna", "HennaDesign"], "beauty-and-lifestyle"],
  ["মেকআপ", ["makeup", "BridalMakeup"], "beauty-and-lifestyle"],
  // Tech and cars
  ["মোবাইল মেরামত", ["mobile repair", "ScreenReplacement"], "mobile-and-tech-repair"],
  ["ফোন মেরামত", ["phone repair", "mobile repair"], "mobile-and-tech-repair"],
  ["ল্যাপটপ", ["laptop", "LaptopServicing"], "mobile-and-tech-repair"],
  ["কম্পিউটার", ["computer", "laptop"]],
  ["গাড়ি", ["car", "automotive"]],
  ["গ্যারেজ", ["garage", "car repair"]],
  ["ট্যাক্সি", ["taxi", "private hire"]],
  ["taxi", ["private hire", "airport transfer"]],
  ["ড্রাইভিং স্কুল", ["driving school", "driving lessons"]],
  // Trades and property
  ["মিস্ত্রি", ["handyman", "builder", "tradesperson"], "trades-and-contractors"],
  ["ইলেকট্রিশিয়ান", ["electrician", "electricians"], "trades-and-contractors"],
  ["প্লাম্বার", ["plumber", "plumbing"], "trades-and-contractors"],
  ["রংমিস্ত্রি", ["painter", "decorator", "painting"], "trades-and-contractors"],
  ["বাড়ি", ["property", "housing"]],
  ["বাসা", ["property", "housing", "letting"]],
  ["বন্ধক", ["mortgage"]],
  // Legal, money, travel
  ["উকিল", ["solicitor", "lawyer", "legal"], "legal-and-financial"],
  ["আইনজীবী", ["solicitor", "lawyer", "legal"], "legal-and-financial"],
  ["হিসাবরক্ষক", ["accountant", "accountants", "tax"], "legal-and-financial"],
  ["ট্যাক্স", ["tax", "accountant"], "legal-and-financial"],
  ["ইমিগ্রেশন", ["immigration", "visa"]],
  ["ভিসা", ["visa", "immigration"]],
  ["বীমা", ["insurance"]],
  ["ওমরাহ", ["umrah", "hajj", "travel"]],
  ["হজ", ["hajj", "umrah", "travel"]],
  ["টিকিট", ["flights", "tickets", "travel"]],
  ["কার্গো", ["cargo", "parcel", "shipping"]],
  ["টাকা পাঠানো", ["money transfer", "remittance"]],
  // Health, education, faith, events
  ["ডাক্তার", ["doctor", "gp", "medical"], "health-and-care"],
  ["doctor", ["gp", "medical"], "health-and-care"],
  ["হিজামা", ["hijama", "cupping", "CuppingTherapy"]],
  ["hijama", ["cupping", "cupping therapy", "CuppingTherapy"]],
  ["কাপিং", ["cupping", "cupping therapy", "CuppingTherapy"]],
  ["কবিরাজ", ["herbal", "alternative medicine"], "health-and-care"],
  ["ফার্মেসি", ["pharmacy", "chemist"], "health-and-care"],
  ["দাঁতের ডাক্তার", ["dentist", "dental"], "health-and-care"],
  ["শিক্ষক", ["tutor", "teacher", "tuition"], "tutors-and-education"],
  ["টিউটর", ["tutor", "tuition"], "tutors-and-education"],
  ["tutor", ["tuition", "teacher"], "tutors-and-education"],
  ["বাংলা স্কুল", ["bangla school", "language school"], "faith-education-and-cultural-schools"],
  ["কুরআন", ["quran", "madrasa"]],
  ["মাদ্রাসা", ["madrasa", "quran", "islamic school"]],
  ["মসজিদ", ["mosque", "masjid", "community"], "community-and-faith"],
  ["masjid", ["mosque"], "community-and-faith"],
  ["বিয়ে", ["wedding", "event", "bridal"]],
  ["বিবাহ", ["wedding", "event", "bridal"]],
  ["ফটোগ্রাফার", ["photographer", "photography", "videography"]],
  ["ডেকোরেশন", ["decor", "decoration", "event"]],
  ["ওয়েবসাইট", ["website", "web design", "digital"]],
];

/**
 * Writes the starter list into an EMPTY table only, so it never overwrites or brings back what an admin changed.
 * Running it again changes nothing. A category slug that does not exist is simply left out of the row.
 */
export async function seedSynonyms(prisma: PrismaClient): Promise<number> {
  if ((await prisma.searchSynonym.count()) > 0) return 0;
  const cats = new Map((await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const seen = new Set<string>();
  const data = [];
  for (const [word, expansions, slug] of STARTER_SYNONYMS) {
    const term = normaliseTerm(word);
    if (seen.has(term)) continue;
    seen.add(term);
    data.push({ term, expansions, categoryId: (slug && cats.get(slug)) || null, starter: true });
  }
  await prisma.searchSynonym.createMany({ data, skipDuplicates: true });
  return data.length;
}

// Icons an admin can choose for a category. Names are lucide icon names. The website maps each name to the icon
// component (bsd-web/lib/category-icons.ts), and a test checks the two lists match.
export const CATEGORY_ICONS = [
  "utensils-crossed", "scale", "stethoscope", "hammer", "shopping-cart", "car-front", "sparkles", "landmark",
  "building-2", "smartphone", "shirt", "chef-hat", "zap", "briefcase", "cookie", "wrench", "graduation-cap", "house",
  "dumbbell", "package", "baby", "bike", "book-open", "brush", "camera", "church", "coffee", "computer", "flower-2",
  "gem", "gift", "hand-heart", "heart-pulse", "hotel", "key", "languages", "laptop", "mail", "map-pin", "music",
  "paint-bucket", "palette", "phone", "pill", "plane", "printer", "scissors", "shield", "ship", "shopping-bag",
  "sofa", "store", "tag", "ticket", "train", "truck", "tv", "users", "wallet",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
export const DEFAULT_CATEGORY_ICON: CategoryIcon = "package";

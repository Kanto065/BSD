import {
  Baby, Bike, BookOpen, Briefcase, Brush, Building2, Camera, CarFront, ChefHat, Church, Coffee, Computer, Cookie,
  Dumbbell, Flower2, Gem, Gift, GraduationCap, Hammer, HandHeart, HeartPulse, Hotel, House, Key, Landmark, Languages,
  Laptop, Mail, MapPin, Music, Package, PaintBucket, Palette, Phone, Pill, Plane, Printer, Scale, Scissors, Shield,
  Ship, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, Sparkles, Stethoscope, Store, Tag, Ticket, Train, Truck,
  Tv, Users, UtensilsCrossed, Wallet, Wrench, Zap, type LucideIcon,
} from "lucide-react";

// The icons an admin can choose for a category, by lucide name. Must match bsd-api/src/common/category-icons.ts
// (checked by a test in bsd-api).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "utensils-crossed": UtensilsCrossed, scale: Scale, stethoscope: Stethoscope, hammer: Hammer,
  "shopping-cart": ShoppingCart, "car-front": CarFront, sparkles: Sparkles, landmark: Landmark,
  "building-2": Building2, smartphone: Smartphone, shirt: Shirt, "chef-hat": ChefHat, zap: Zap, briefcase: Briefcase,
  cookie: Cookie, wrench: Wrench, "graduation-cap": GraduationCap, house: House, dumbbell: Dumbbell, package: Package,
  baby: Baby, bike: Bike, "book-open": BookOpen, brush: Brush, camera: Camera, church: Church, coffee: Coffee,
  computer: Computer, "flower-2": Flower2, gem: Gem, gift: Gift, "hand-heart": HandHeart, "heart-pulse": HeartPulse,
  hotel: Hotel, key: Key, languages: Languages, laptop: Laptop, mail: Mail, "map-pin": MapPin, music: Music,
  "paint-bucket": PaintBucket, palette: Palette, phone: Phone, pill: Pill, plane: Plane, printer: Printer,
  scissors: Scissors, shield: Shield, ship: Ship, "shopping-bag": ShoppingBag, sofa: Sofa, store: Store, tag: Tag,
  ticket: Ticket, train: Train, truck: Truck, tv: Tv, users: Users, wallet: Wallet,
};

export const iconFor = (name: string | null | undefined): LucideIcon => (name && CATEGORY_ICONS[name]) || Package;

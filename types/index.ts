// Tipe domain yang mencerminkan tabel di supabase/migrations/*.sql

export type Role = "customer" | "editor" | "admin";

export interface AppUser {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  show_on_home: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface Material {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_per_meter: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  material_id: string | null;
  description: string | null;
  finishing: string | null;
  colors: string[];
  dimensions: string | null;
  price_estimate: number | null;
  images: string[];
  video_url: string | null;
  status: "draft" | "published";
  is_featured: boolean;
  view_count: number;
  inquiry_count: number;
  created_at: string;
}

export interface ProductWithRelations extends Product {
  category: Pick<Category, "id" | "name" | "slug"> | null;
  material: Pick<Material, "id" | "name" | "slug"> | null;
}

export const HPL_CATEGORIES = ["Wood", "Solid", "Marble", "Stone", "Pattern", "Matte", "Glossy"] as const;
export type HplCategory = (typeof HPL_CATEGORIES)[number];

export interface HplColor {
  id: string;
  name: string;
  code: string;
  brand: string | null;
  category: HplCategory;
  hex: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export const DUCO_CATEGORIES = ["White", "Cream", "Grey", "Black", "Green", "Blue", "Brown", "Custom Color"] as const;
export type DucoCategory = (typeof DUCO_CATEGORIES)[number];
export const DUCO_FINISHES = ["Glossy", "Matte", "Satin"] as const;

export interface DucoColor {
  id: string;
  name: string;
  code: string;
  category: DucoCategory;
  finish: (typeof DUCO_FINISHES)[number];
  hex: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Hardware {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_unit: "per_meter" | "fixed";
  is_calculator_option: boolean;
  sort_order: number;
  is_active: boolean;
}

export type PriceGroup = "product_type" | "finishing" | "top_table" | "accessory" | "additional";
export type PriceUnit = "per_meter" | "fixed" | "percent" | "multiplier";

export interface PriceSetting {
  id: string;
  group: PriceGroup;
  name: string;
  price: number;
  unit: PriceUnit;
  description: string | null;
  meta: { standard_height?: number; [key: string]: unknown };
  sort_order: number;
  is_active: boolean;
}

export const PORTFOLIO_CATEGORIES = ["Kitchen Set", "Wardrobe", "Furniture", "Office", "Residential", "Commercial"] as const;

export interface PortfolioItem {
  id: string;
  title: string;
  slug: string;
  category: (typeof PORTFOLIO_CATEGORIES)[number];
  location: string | null;
  year: number | null;
  material: string | null;
  description: string | null;
  images: string[];
  video_url: string | null;
  source: "admin" | "customer";
  is_published: boolean;
  sort_order: number;
}

export interface Video {
  id: string;
  title: string;
  description: string | null;
  category: string;
  video_url: string;
  thumbnail_url: string | null;
  source: "youtube" | "vimeo" | "upload" | "customer";
  is_published: boolean;
  sort_order: number;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface CustomerSubmission {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  project_title: string | null;
  location: string | null;
  description: string | null;
  testimonial: string | null;
  rating: number;
  images: string[];
  status: SubmissionStatus;
  admin_note: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  content: string;
  review_date: string;
  source: "manual" | "customer" | "google_manual";
  is_published: boolean;
  sort_order: number;
}

export interface SurveyRequest {
  id: string;
  name: string;
  phone: string;
  address: string;
  preferred_date: string | null;
  furniture_type: string | null;
  approx_size: string | null;
  notes: string | null;
  estimate_total: number | null;
  status: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  furniture_type: string | null;
  size: string | null;
  material: string | null;
  estimate_total: number | null;
  message: string | null;
  reference_images: string[];
  status: string;
  created_at: string;
}

export interface SiteSettings {
  business_name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  whatsapp_number: string | null;
  email: string | null;
  notification_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  google_maps_url: string | null;
  google_maps_embed_query: string | null;
  google_place_id: string | null;
  opening_hours: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  hero_video_url: string | null;
  cta_primary_label: string | null;
  cta_secondary_label: string | null;
  footer_text: string | null;
  about_title: string | null;
  about_content: string | null;
  manual_rating: number | null;
  manual_review_count: number | null;
  whatsapp_default_message: string | null;
  announcement_text: string | null;
  announcement_url: string | null;
  hero_card_title: string | null;
  hero_card_text: string | null;
  cta_eyebrow: string | null;
  cta_title: string | null;
  cta_text: string | null;
  about_image_url: string | null;
  about_image_2_url: string | null;
}

export const HOME_SECTION_KEYS = [
  "categories",
  "featured_products",
  "calculator",
  "portfolio",
  "videos",
  "reviews",
  "advantages",
  "faq",
  "cta",
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/** Section homepage yang urutan, visibilitas, dan teksnya diatur dari admin. */
export interface HomeSection {
  id: string;
  key: HomeSectionKey;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  cta_label: string | null;
  cta_url: string | null;
  item_limit: number;
  sort_order: number;
  is_active: boolean;
}

export const FEATURE_SECTIONS = ["hero_stat", "process", "advantage", "about_value"] as const;
export type FeatureSection = (typeof FEATURE_SECTIONS)[number];

export interface Feature {
  id: string;
  section: FeatureSection;
  icon: string;
  title: string;
  description: string | null;
  value: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

/** Ulasan yang ditampilkan di website (dari Google live atau fallback manual). */
export interface DisplayReview {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string;
  date: string;
  relativeTime?: string;
}

export interface ReviewSummary {
  /** "google" = data live dari Google Places API, "manual" = fallback dari admin */
  source: "google" | "manual";
  rating: number;
  totalReviews: number;
  reviews: DisplayReview[];
  mapsUrl: string;
}

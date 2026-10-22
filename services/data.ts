import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";
import * as demo from "@/lib/demo-data";
import type {
  Category,
  DucoColor,
  Faq,
  Feature,
  FeatureSection,
  Hardware,
  HomeSection,
  HplColor,
  Material,
  PortfolioItem,
  PriceSetting,
  ProductWithRelations,
  Review,
  SiteSettings,
  Video,
} from "@/types";
import type { PricingConfig } from "@/lib/calculator";

/**
 * Lapisan data publik. Jika Supabase sudah dikonfigurasi, semua data dibaca dari
 * database (RLS: hanya baris aktif/terbit). Jika belum, memakai data demo agar
 * website tetap bisa dipreview.
 */
type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

async function fromDb<T>(
  run: (sb: ReturnType<typeof createPublicClient>) => Result<T>,
  demoValue: T,
  emptyValue: T,
): Promise<T> {
  if (!isSupabaseConfigured) return demoValue;
  try {
    const { data, error } = await run(createPublicClient());
    if (error) {
      console.error("[data]", error.message);
      return emptyValue;
    }
    return (data ?? emptyValue) as T;
  } catch (e) {
    console.error("[data]", e);
    return emptyValue;
  }
}

const numberify = <T extends object>(rows: T[], keys: (keyof T)[]): T[] =>
  rows.map((r) => {
    const copy = { ...r };
    for (const k of keys) if (copy[k] !== null && copy[k] !== undefined) (copy as Record<keyof T, unknown>)[k] = Number(copy[k]);
    return copy;
  });

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const row = await fromDb<SiteSettings | null>(
    (sb) => sb.from("settings").select("*").eq("id", true).maybeSingle(),
    demo.demoSettings,
    null,
  );
  // Nilai demo hanya menjadi default untuk kolom yang belum ada.
  const merged = { ...demo.demoSettings, ...(row ?? {}) };
  // Nomor WhatsApp: Admin → Pengaturan, fallback ke env WHATSAPP_NUMBER.
  if (!row?.whatsapp_number && process.env.WHATSAPP_NUMBER) merged.whatsapp_number = process.env.WHATSAPP_NUMBER;
  return merged;
});

export const getCategories = cache(async (): Promise<Category[]> =>
  fromDb((sb) => sb.from("categories").select("*").eq("is_active", true).order("sort_order"), demo.demoCategories, []),
);

export const getMaterials = cache(async (): Promise<Material[]> =>
  numberify(
    await fromDb((sb) => sb.from("materials").select("*").eq("is_active", true).order("sort_order"), demo.demoMaterials, []),
    ["price_per_meter"],
  ),
);

function attachRelations(
  products: Omit<ProductWithRelations, "category" | "material">[],
  categories: Category[],
  materials: Material[],
): ProductWithRelations[] {
  return products.map((p) => {
    const c = categories.find((x) => x.id === p.category_id);
    const m = materials.find((x) => x.id === p.material_id);
    return {
      ...p,
      price_estimate: p.price_estimate === null ? null : Number(p.price_estimate),
      category: c ? { id: c.id, name: c.name, slug: c.slug } : null,
      material: m ? { id: m.id, name: m.name, slug: m.slug } : null,
    };
  });
}

export const getProducts = cache(async (): Promise<ProductWithRelations[]> => {
  const [rows, categories, materials] = await Promise.all([
    fromDb(
      (sb) => sb.from("products").select("*").eq("status", "published").order("is_featured", { ascending: false }).order("created_at", { ascending: false }),
      demo.demoProducts,
      [],
    ),
    getCategories(),
    getMaterials(),
  ]);
  return attachRelations(rows, categories, materials);
});

export interface ProductFilter {
  q?: string;
  category?: string;
  material?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}

export async function filterProducts(filter: ProductFilter): Promise<ProductWithRelations[]> {
  let items = await getProducts();
  if (filter.category) items = items.filter((p) => p.category?.slug === filter.category);
  if (filter.material) items = items.filter((p) => p.material?.slug === filter.material);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    items = items.filter((p) =>
      [p.name, p.description, p.category?.name, p.material?.name, p.finishing].some((v) => v?.toLowerCase().includes(q)),
    );
  }
  const price = (p: ProductWithRelations) => p.price_estimate ?? Number.MAX_SAFE_INTEGER;
  if (filter.sort === "price_asc") items = [...items].sort((a, b) => price(a) - price(b));
  if (filter.sort === "price_desc") items = [...items].sort((a, b) => (b.price_estimate ?? 0) - (a.price_estimate ?? 0));
  if (filter.sort === "popular") items = [...items].sort((a, b) => b.view_count - a.view_count);
  return items;
}

export const getProductBySlug = cache(async (slug: string) => (await getProducts()).find((p) => p.slug === slug) ?? null);

export async function getRelatedProducts(product: ProductWithRelations, limit = 4) {
  return (await getProducts()).filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, limit);
}

export const getHplColors = cache(async (): Promise<HplColor[]> =>
  fromDb((sb) => sb.from("hpl_colors").select("*").eq("is_active", true).order("sort_order"), demo.demoHplColors, []),
);

export const getDucoColors = cache(async (): Promise<DucoColor[]> =>
  fromDb((sb) => sb.from("duco_colors").select("*").eq("is_active", true).order("sort_order"), demo.demoDucoColors, []),
);

export const getPortfolio = cache(async (): Promise<PortfolioItem[]> =>
  fromDb(
    (sb) => sb.from("portfolio").select("*").eq("is_published", true).order("sort_order").order("created_at", { ascending: false }),
    demo.demoPortfolio,
    [],
  ),
);

export const getVideos = cache(async (): Promise<Video[]> =>
  fromDb((sb) => sb.from("videos").select("*").eq("is_published", true).order("sort_order"), demo.demoVideos, []),
);

export const getManualReviews = cache(async (): Promise<Review[]> =>
  fromDb(
    (sb) => sb.from("reviews").select("*").eq("is_published", true).order("sort_order").order("review_date", { ascending: false }),
    demo.demoReviews,
    [],
  ),
);

/** Konfigurasi harga kalkulator — 100% dari database (materials, hardware, price_settings). */
export const getPricingConfig = cache(async (): Promise<PricingConfig> => {
  const [materials, hardware, prices] = await Promise.all([
    getMaterials(),
    fromDb<Hardware[]>(
      (sb) => sb.from("hardware").select("*").eq("is_active", true).eq("is_calculator_option", true).order("sort_order"),
      demo.demoHardware.filter((h) => h.is_calculator_option),
      [],
    ),
    fromDb<PriceSetting[]>(
      (sb) => sb.from("price_settings").select("*").eq("is_active", true).order("sort_order"),
      demo.demoPriceSettings,
      [],
    ),
  ]);
  const p = numberify(prices, ["price"]);
  const byGroup = (g: PriceSetting["group"]) => p.filter((x) => x.group === g);
  return {
    materials,
    hardware: numberify(hardware, ["price"]),
    productTypes: byGroup("product_type"),
    finishings: byGroup("finishing"),
    topTables: byGroup("top_table"),
    accessories: byGroup("accessory"),
    additional: byGroup("additional"),
  };
});

/**
 * Section homepage aktif, sudah terurut. Jika tabel belum dimigrasi (query error),
 * memakai susunan default agar homepage tidak kosong.
 */
export const getHomeSections = cache(async (): Promise<HomeSection[]> =>
  fromDb(
    (sb) => sb.from("home_sections").select("*").eq("is_active", true).order("sort_order"),
    demo.demoHomeSections,
    demo.demoHomeSections,
  ),
);

const getAllFeatures = cache(async (): Promise<Feature[]> =>
  fromDb((sb) => sb.from("features").select("*").eq("is_active", true).order("sort_order"), demo.demoFeatures, demo.demoFeatures),
);

export async function getFeatures(section: FeatureSection): Promise<Feature[]> {
  return (await getAllFeatures()).filter((f) => f.section === section);
}

export const getFaqs = cache(async (): Promise<Faq[]> =>
  fromDb((sb) => sb.from("faqs").select("*").eq("is_active", true).order("sort_order"), demo.demoFaqs, []),
);

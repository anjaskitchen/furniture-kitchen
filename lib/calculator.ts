/**
 * KALKULATOR ENGINE — terpisah dari UI.
 *
 * Tidak ada harga di file ini. Semua harga datang dari database
 * (tabel materials, hardware, price_settings) lewat `PricingConfig`
 * yang disusun di services/pricing.ts.
 *
 * Rumus:
 *   heightFactor    = max(1, tinggi / tinggi standar jenis produk)
 *   materialCost    = hargaMaterial/m × panjang × pengaliProduk × heightFactor
 *   finishingCost   = materialCost × persenFinishing / 100
 *   hardwareCost    = hargaHardware/m × panjang   (atau fixed)
 *   topTableCost    = hargaTopTable/m × panjang
 *   accessoriesCost = Σ hargaAksesoris × qty
 *   additionalCost  = Σ biaya tambahan aktif
 *   totalEstimate   = jumlah semua komponen (dibulatkan ke ribuan)
 */
import type { Hardware, Material, PriceSetting } from "../types/index.ts";

export interface PricingConfig {
  productTypes: PriceSetting[];
  materials: Material[];
  finishings: PriceSetting[];
  hardware: Hardware[];
  topTables: PriceSetting[];
  accessories: PriceSetting[];
  additional: PriceSetting[];
}

export interface EstimateInput {
  productType: string; // id price_settings (group product_type)
  material: string; // id materials
  length: number; // meter
  height?: number; // meter (opsional)
  finishing?: string; // id price_settings (group finishing)
  hardware?: string; // id hardware
  topTable?: string; // id price_settings (group top_table)
  accessories?: { id: string; qty: number }[];
}

export interface EstimateLine {
  key: "material" | "finishing" | "hardware" | "topTable" | "accessories" | "additional";
  label: string;
  detail: string;
  amount: number;
}

export interface EstimateResult {
  basePrice: number; // harga material per meter
  materialCost: number;
  finishingCost: number;
  hardwareCost: number;
  topTableCost: number;
  accessoriesCost: number;
  additionalCost: number;
  totalEstimate: number;
  heightFactor: number;
  lines: EstimateLine[];
  labels: {
    productType: string;
    material: string;
    finishing: string | null;
    hardware: string | null;
    topTable: string | null;
    accessories: string[];
  };
  /** Ada opsi "Custom" yang harganya dikonfirmasi saat konsultasi. */
  hasCustomItems: boolean;
}

export class EstimateError extends Error {}

export const MAX_LENGTH_METER = 50;
export const MAX_HEIGHT_METER = 5;

const roundTo = (value: number, step = 1000) => Math.round(value / step) * step;

export function formatNumberID(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

export function calculateEstimate(input: EstimateInput, config: PricingConfig): EstimateResult {
  const productType = config.productTypes.find((p) => p.id === input.productType && p.is_active);
  if (!productType) throw new EstimateError("Jenis produk tidak valid");

  const material = config.materials.find((m) => m.id === input.material && m.is_active);
  if (!material) throw new EstimateError("Material tidak valid");

  const length = Number(input.length);
  if (!Number.isFinite(length) || length <= 0 || length > MAX_LENGTH_METER) {
    throw new EstimateError(`Panjang harus antara 0 dan ${MAX_LENGTH_METER} meter`);
  }
  const height = input.height === undefined || input.height === null ? 0 : Number(input.height);
  if (!Number.isFinite(height) || height < 0 || height > MAX_HEIGHT_METER) {
    throw new EstimateError(`Tinggi harus antara 0 dan ${MAX_HEIGHT_METER} meter`);
  }

  const multiplier = Number(productType.price) > 0 ? Number(productType.price) : 1;
  const standardHeight = Number(productType.meta?.standard_height) || 0;
  const heightFactor = standardHeight > 0 && height > standardHeight ? height / standardHeight : 1;

  const basePrice = Number(material.price_per_meter);
  const materialCost = basePrice * length * multiplier * heightFactor;

  const finishing = input.finishing
    ? config.finishings.find((f) => f.id === input.finishing && f.is_active)
    : undefined;
  const finishingCost = finishing ? (materialCost * Number(finishing.price)) / 100 : 0;

  const hardware = input.hardware ? config.hardware.find((h) => h.id === input.hardware && h.is_active) : undefined;
  const hardwareCost = hardware
    ? hardware.price_unit === "per_meter"
      ? Number(hardware.price) * length
      : Number(hardware.price)
    : 0;

  const topTable = input.topTable ? config.topTables.find((t) => t.id === input.topTable && t.is_active) : undefined;
  const topTableCost = topTable
    ? topTable.unit === "per_meter"
      ? Number(topTable.price) * length
      : Number(topTable.price)
    : 0;

  const chosenAccessories = (input.accessories ?? [])
    .map(({ id, qty }) => ({ item: config.accessories.find((a) => a.id === id && a.is_active), qty }))
    .filter((a): a is { item: PriceSetting; qty: number } => Boolean(a.item))
    .map(({ item, qty }) => ({ item, qty: Math.min(Math.max(Math.floor(Number(qty) || 1), 1), 20) }));
  const accessoriesCost = chosenAccessories.reduce((sum, { item, qty }) => sum + Number(item.price) * qty, 0);

  const additionalItems = config.additional.filter((a) => a.is_active);
  const additionalCost = additionalItems.reduce(
    (sum, a) => sum + (a.unit === "per_meter" ? Number(a.price) * length : Number(a.price)),
    0,
  );

  const rupiahPerMeter = (n: number) => `Rp ${formatNumberID(n)}/m`;
  const lines: EstimateLine[] = [
    {
      key: "material",
      label: `Material ${material.name}`,
      detail: `${rupiahPerMeter(basePrice)} × ${formatNumberID(length)} m${multiplier !== 1 ? ` × ${formatNumberID(multiplier)}` : ""}${
        heightFactor !== 1 ? ` × faktor tinggi ${formatNumberID(Number(heightFactor.toFixed(2)))}` : ""
      }`,
      amount: materialCost,
    },
  ];
  if (finishing) {
    lines.push({
      key: "finishing",
      label: `Finishing ${finishing.name}`,
      detail: `${formatNumberID(Number(finishing.price))}% dari material`,
      amount: finishingCost,
    });
  }
  if (hardware) {
    lines.push({
      key: "hardware",
      label: `Hardware ${hardware.name}`,
      detail:
        hardware.price_unit === "per_meter"
          ? `${rupiahPerMeter(Number(hardware.price))} × ${formatNumberID(length)} m`
          : "Harga paket",
      amount: hardwareCost,
    });
  }
  if (topTable) {
    lines.push({
      key: "topTable",
      label: `Top Table ${topTable.name}`,
      detail: topTable.unit === "per_meter" ? `${rupiahPerMeter(Number(topTable.price))} × ${formatNumberID(length)} m` : "Harga paket",
      amount: topTableCost,
    });
  }
  if (chosenAccessories.length) {
    lines.push({
      key: "accessories",
      label: "Aksesoris & tambahan",
      detail: chosenAccessories.map(({ item, qty }) => (qty > 1 ? `${item.name} ×${qty}` : item.name)).join(", "),
      amount: accessoriesCost,
    });
  }
  if (additionalItems.length) {
    lines.push({
      key: "additional",
      label: "Biaya tambahan",
      detail: additionalItems.map((a) => a.name).join(", "),
      amount: additionalCost,
    });
  }

  const total = materialCost + finishingCost + hardwareCost + topTableCost + accessoriesCost + additionalCost;
  const isCustom = (name?: string) => Boolean(name && /custom/i.test(name));

  return {
    basePrice,
    materialCost: roundTo(materialCost),
    finishingCost: roundTo(finishingCost),
    hardwareCost: roundTo(hardwareCost),
    topTableCost: roundTo(topTableCost),
    accessoriesCost: roundTo(accessoriesCost),
    additionalCost: roundTo(additionalCost),
    totalEstimate: roundTo(total),
    heightFactor,
    lines: lines.map((l) => ({ ...l, amount: roundTo(l.amount) })),
    labels: {
      productType: productType.name,
      material: material.name,
      finishing: finishing?.name ?? null,
      hardware: hardware?.name ?? null,
      topTable: topTable && Number(topTable.price) > 0 ? topTable.name : topTable && isCustom(topTable.name) ? topTable.name : null,
      accessories: chosenAccessories.map(({ item, qty }) => (qty > 1 ? `${item.name} ×${qty}` : item.name)),
    },
    hasCustomItems:
      isCustom(finishing?.name) ||
      isCustom(topTable?.name) ||
      chosenAccessories.some(({ item }) => isCustom(item.name) && Number(item.price) === 0),
  };
}

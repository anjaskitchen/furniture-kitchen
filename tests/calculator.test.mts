import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateEstimate, EstimateError, type PricingConfig } from "../lib/calculator.ts";
import { demoHardware, demoMaterials, demoPriceSettings } from "../lib/demo-data.ts";

const group = (g: string) => demoPriceSettings.filter((p) => p.group === g);
const config: PricingConfig = {
  materials: demoMaterials,
  hardware: demoHardware.filter((h) => h.is_calculator_option),
  productTypes: group("product_type"),
  finishings: group("finishing"),
  topTables: group("top_table"),
  accessories: group("accessory"),
  additional: group("additional"),
};
const id = (list: { id: string; name: string }[], name: string) => list.find((x) => x.name === name)!.id;
const base = {
  productType: id(config.productTypes, "Kitchen Set"),
  material: id(config.materials, "HPL"),
  length: 3,
};

test("contoh brief: HPL 3 meter = Rp 6.600.000", () => {
  const r = calculateEstimate(base, config);
  assert.equal(r.basePrice, 2_200_000);
  assert.equal(r.materialCost, 6_600_000);
  assert.equal(r.totalEstimate, 6_600_000);
});

test("Cat Duco 3 meter = Rp 8.400.000", () => {
  const r = calculateEstimate({ ...base, material: id(config.materials, "Cat Duco") }, config);
  assert.equal(r.totalEstimate, 8_400_000);
});

test("breakdown finishing, hardware, top table, aksesoris", () => {
  const r = calculateEstimate(
    {
      ...base,
      finishing: id(config.finishings, "Premium"), // 15% x 6.6jt = 990rb
      hardware: id(config.hardware, "Soft Closing"), // 350rb x 3 = 1.05jt
      topTable: id(config.topTables, "Granit"), // 1.5jt x 3 = 4.5jt
      accessories: [
        { id: id(config.accessories, "Lampu LED"), qty: 1 }, // 650rb
        { id: id(config.accessories, "Laci tambahan"), qty: 2 }, // 900rb
      ],
    },
    config,
  );
  assert.equal(r.finishingCost, 990_000);
  assert.equal(r.hardwareCost, 1_050_000);
  assert.equal(r.topTableCost, 4_500_000);
  assert.equal(r.accessoriesCost, 1_550_000);
  assert.equal(r.totalEstimate, 6_600_000 + 990_000 + 1_050_000 + 4_500_000 + 1_550_000);
  assert.deepEqual(r.lines.map((l) => l.key), ["material", "finishing", "hardware", "topTable", "accessories", "additional"]);
});

test("tinggi di atas standar dihitung proporsional", () => {
  const r = calculateEstimate({ ...base, productType: id(config.productTypes, "Lemari"), length: 2, height: 2.5 }, config);
  // 2.2jt x 2 m x 1 x (2.5/2)
  assert.equal(r.materialCost, 5_500_000);
});

test("harga mengikuti konfigurasi (bukan hard-code)", () => {
  const custom = { ...config, materials: config.materials.map((m) => (m.name === "HPL" ? { ...m, price_per_meter: 2_500_000 } : m)) };
  assert.equal(calculateEstimate(base, custom).totalEstimate, 7_500_000);
});

test("material nonaktif ditolak", () => {
  const off = { ...config, materials: config.materials.map((m) => ({ ...m, is_active: false })) };
  assert.throws(() => calculateEstimate(base, off), EstimateError);
});

test("validasi panjang", () => {
  assert.throws(() => calculateEstimate({ ...base, length: 0 }, config), EstimateError);
  assert.throws(() => calculateEstimate({ ...base, length: 999 }, config), EstimateError);
});

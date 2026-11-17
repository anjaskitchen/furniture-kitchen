import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtPct, hppCategoryLabel, hppLevel, pct, priceForTarget } from "../lib/erp/hpp-shared.ts";

test("pct menghitung persentase dan menangani pembagi nol", () => {
  assert.equal(pct(6_000_000, 10_000_000), 60);
  assert.equal(pct(0, 10_000_000), 0);
  assert.equal(pct(5_000_000, 0), null);
});

test("hppLevel mengklasifikasikan status HPP terhadap target dan batas maksimal", () => {
  assert.equal(hppLevel(null, 60, 75), "none");
  assert.equal(hppLevel(55, 60, 75), "good");
  assert.equal(hppLevel(60, 60, 75), "good");
  assert.equal(hppLevel(65, 60, 75), "warn");
  assert.equal(hppLevel(75, 60, 75), "warn");
  assert.equal(hppLevel(75.1, 60, 75), "bad");
});

test("priceForTarget menghitung harga jual minimum dibulatkan ke ribuan atas", () => {
  // HPP 6.000.000 dengan target 60% → 10.000.000
  assert.equal(priceForTarget(6_000_000, 60), 10_000_000);
  // HPP 5.000.000 dengan target 60% → 8.333.333,33 → dibulatkan ke 8.334.000
  assert.equal(priceForTarget(5_000_000, 60), 8_334_000);
  assert.equal(priceForTarget(5_000_000, 0), 0);
});

test("fmtPct dan hppCategoryLabel memformat tampilan HPP", () => {
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtPct(60), "60%");
  assert.equal(hppCategoryLabel("material"), "Bahan baku");
  assert.equal(hppCategoryLabel("labor"), "Tenaga kerja");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, daysBetween, deltaPct, presetRange, resolvePeriod, targetForPeriod } from "../lib/orders.ts";

test("presetRange menghitung batas periode dengan benar", () => {
  assert.deepEqual(presetRange("this_month", "2026-10-22"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(presetRange("last_month", "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(presetRange("last_month", "2026-01-10"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(presetRange("7d", "2026-10-22"), { from: "2026-10-16", to: "2026-10-22" });
  assert.deepEqual(presetRange("this_quarter", "2026-11-05"), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(presetRange("last_year", "2026-06-01"), { from: "2025-01-01", to: "2025-12-31" });
});

test("daysBetween inklusif & addDays melewati akhir bulan", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-31"), 31);
  assert.equal(daysBetween("2026-10-22", "2026-10-22"), 1);
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
});

test("targetForPeriod pro-rata per hari dalam bulan", () => {
  assert.equal(targetForPeriod(100_000_000, "2026-10-01", "2026-10-31"), 100_000_000);
  assert.equal(targetForPeriod(100_000_000, "2026-10-01", "2026-10-15"), Math.round((100_000_000 * 15) / 31));
  // Lintas bulan: 16-31 Okt (16/31) + 1-15 Nov (15/30)
  assert.equal(targetForPeriod(100_000_000, "2026-10-16", "2026-11-15"), Math.round(100_000_000 * (16 / 31) + 100_000_000 * (15 / 30)));
  assert.equal(targetForPeriod(30_000_000, "2026-01-01", "2026-12-31"), 360_000_000);
  assert.equal(targetForPeriod(0, "2026-10-01", "2026-10-31"), 0);
});

test("deltaPct menangani periode pembanding nol", () => {
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(50, 100), -50);
  assert.equal(deltaPct(0, 0), 0);
  assert.equal(deltaPct(10, 0), null);
});

test("resolvePeriod menolak tanggal tidak valid & memakai default", () => {
  assert.equal(resolvePeriod({ from: "2026-10-05", to: "2026-10-01" }).preset, "this_month");
  assert.equal(resolvePeriod({ from: "abc", to: "2026-10-01" }).preset, "this_month");
  const custom = resolvePeriod({ from: "2026-10-01", to: "2026-10-10" });
  assert.equal(custom.preset, "custom");
  assert.equal(custom.from, "2026-10-01");
  assert.equal(resolvePeriod({ preset: "last_year" }).preset, "last_year");
});

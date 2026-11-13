import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateFormula, materialQty } from "../lib/erp/formula.ts";

const vars = { panjang: 3, tinggi: 2.4, kedalaman: 0.6, kabinet_atas: 2, kabinet_bawah: 3, laci: 4, pintu: 6 };

test("evaluateFormula menghitung aritmetika, kurung, pangkat, dan fungsi", () => {
  assert.equal(evaluateFormula("panjang * 2.2", vars), 3 * 2.2);
  assert.equal(evaluateFormula("(panjang + 1) * 2", vars), 8);
  assert.equal(evaluateFormula("pintu * 2 + laci", vars), 16);
  assert.equal(evaluateFormula("max(1, panjang / 3)", vars), 1);
  assert.equal(evaluateFormula("ceil(panjang * tinggi)", vars), 8);
  assert.equal(evaluateFormula("2 ^ 3", vars), 8);
  assert.equal(evaluateFormula("-laci + 10", vars), 6);
  assert.equal(evaluateFormula("round(1.256, 2)", vars), 1.26);
});

test("evaluateFormula menolak formula berbahaya / salah", () => {
  assert.throws(() => evaluateFormula("panjang * x", vars), /Variabel tidak dikenal/);
  assert.throws(() => evaluateFormula("alert(1)", vars), /Fungsi tidak dikenal/);
  assert.throws(() => evaluateFormula("panjang * (2", vars), /Diharapkan/);
  assert.throws(() => evaluateFormula("panjang / 0", vars), /nol/);
  assert.throws(() => evaluateFormula("process.exit()", vars), /tidak/);
  assert.throws(() => evaluateFormula("panjang; laci", vars), /Karakter tidak dikenal/);
});

test("materialQty menambah sisa potong lalu membulatkan ke atas", () => {
  assert.equal(materialQty("panjang * 2.2", vars, 10, true), 8); // 6.6 × 1.1 = 7.26 → 8
  assert.equal(materialQty("panjang * 2", vars, 0, true), 6); // tepat 6, tidak jadi 7
  assert.equal(materialQty("panjang * 0.8", vars, 0, false), 2.4);
  assert.equal(materialQty("laci - 10", vars, 0, true), 0); // tidak pernah negatif
});

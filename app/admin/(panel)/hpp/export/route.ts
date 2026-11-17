import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/admin/auth";
import { getHppSettings, listItemHpp, listOrderHpp, type OrderHpp } from "@/lib/erp/hpp";
import { HPP_LEVEL_META, hppLevel, pct } from "@/lib/erp/hpp-shared";
import { resolvePeriod, statusMeta } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAVY = "FF17263C";
const CREAM = "FFE8DDC8";
const MONEY = '"Rp" #,##0;[Red]-"Rp" #,##0';
const PCT = '0.0"%"';

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width: number; money?: boolean; pct?: boolean }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.money ? { numFmt: MONEY } : c.pct ? { numFmt: PCT } : {},
  }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: CREAM } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  return ws;
}

const r1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

/** GET /admin/hpp/export?preset=... | ?from=&to=&basis=estimasi|aktual → Excel laporan HPP & Margin. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(sp, "this_year");
  const basis = sp.basis === "aktual" ? "aktual" : "estimasi";

  const [orders, settings] = await Promise.all([listOrderHpp(period.from, period.to), getHppSettings()]);
  const { targetPct: target, maxPct: max } = settings;

  const hppOf = (o: OrderHpp) => (basis === "aktual" ? o.hpp_actual : o.hpp_estimate);
  const counted = orders.filter((o) => hppOf(o) > 0 && o.total > 0);
  const missing = orders.filter((o) => !(hppOf(o) > 0) && o.total > 0);
  const revenue = counted.reduce((a, o) => a + o.total, 0);
  const hpp = counted.reduce((a, o) => a + hppOf(o), 0);
  const hppPct = pct(hpp, revenue);
  const profit = revenue - hpp;
  const marginPct = pct(profit, revenue);
  const overMax = counted.filter((o) => (pct(hppOf(o), o.total) ?? 0) > max);

  const items = await listItemHpp(orders.filter((o) => o.has_detail).map((o) => o.order_id));
  const orderMap = new Map(orders.map((o) => [o.order_id, o]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mandiri Furniture";
  wb.created = new Date();

  // 1. Ringkasan
  const sum = sheet(wb, "Ringkasan", [
    { header: "Keterangan", key: "k", width: 46 },
    { header: "Nilai", key: "v", width: 24, money: true },
    { header: "Persentase / Info", key: "p", width: 24 },
  ]);

  const detailOrders = counted.filter((o) => (basis === "aktual" ? o.hpp_actual > 0 : o.has_detail));
  const matTotal = detailOrders.reduce((a, o) => a + (basis === "aktual" ? o.actual_material : o.material), 0);
  const labTotal = detailOrders.reduce((a, o) => a + (basis === "aktual" ? o.actual_labor : o.labor), 0);
  const ovhTotal = basis === "aktual" ? 0 : detailOrders.reduce((a, o) => a + o.overhead, 0);
  const othTotal = detailOrders.reduce((a, o) => a + (basis === "aktual" ? o.actual_other : o.other), 0);

  sum.addRows([
    { k: `Periode: ${period.label}`, p: `Dasar: ${basis === "aktual" ? "Aktual (biaya proyek)" : "Estimasi (rincian per item)"}` },
    { k: "Target HPP maksimal (sehat)", p: `${target}%` },
    { k: "Batas HPP maksimal (waspada)", p: `${max}%` },
    { k: "Total nilai order (yang sudah dihitung HPP)", v: revenue, p: `${counted.length} order` },
    { k: "Total HPP", v: hpp, p: hppPct !== null ? `${hppPct.toFixed(1)}% (${HPP_LEVEL_META[hppLevel(hppPct, target, max)].label})` : "-" },
    { k: "Laba kotor", v: profit, p: marginPct !== null ? `Margin ${marginPct.toFixed(1)}%` : "-" },
    { k: "Order belum dihitung HPP", v: missing.reduce((a, o) => a + o.total, 0), p: `${missing.length} order` },
    { k: `Order melebihi batas HPP (> ${max}%)`, v: overMax.reduce((a, o) => a + hppOf(o), 0), p: `${overMax.length} order` },
    { k: "" },
    { k: "Komposisi HPP (dari order dengan rincian)" },
    { k: "  • Bahan baku", v: matTotal },
    { k: "  • Tenaga kerja", v: labTotal },
    ...(basis === "estimasi" ? [{ k: "  • Overhead", v: ovhTotal }] : []),
    { k: basis === "aktual" ? "  • Biaya proyek lain" : "  • Lainnya", v: othTotal },
  ]);
  sum.getRow(2).font = { italic: true };
  for (const r of [6, 7, 11]) sum.getRow(r).font = { bold: true };

  // 2. Tren Bulanan
  const tr = sheet(wb, "Tren Bulanan", [
    { header: "Bulan", key: "m", width: 14 },
    { header: "Penjualan", key: "rev", width: 20, money: true },
    { header: "Total HPP", key: "hpp", width: 20, money: true },
    { header: "Laba Kotor", key: "prf", width: 20, money: true },
    { header: "HPP %", key: "pct", width: 12, pct: true },
  ]);
  const months = new Map<string, { revenue: number; hpp: number }>();
  {
    const [fy, fm] = period.from.slice(0, 7).split("-").map(Number);
    const [ty, tm] = period.to.slice(0, 7).split("-").map(Number);
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((m = 1), y++) : m++) {
      months.set(`${y}-${String(m).padStart(2, "0")}`, { revenue: 0, hpp: 0 });
    }
  }
  for (const o of counted) {
    const k = o.order_date.slice(0, 7);
    const m = months.get(k) ?? { revenue: 0, hpp: 0 };
    m.revenue += o.total;
    m.hpp += hppOf(o);
    months.set(k, m);
  }
  for (const [month, m] of [...months.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    tr.addRow({ m: month, rev: m.revenue, hpp: m.hpp, prf: m.revenue - m.hpp, pct: r1(pct(m.hpp, m.revenue)) });
  }

  // 3. HPP per Order
  const ord = sheet(wb, "HPP per Order", [
    { header: "No. Order", key: "no", width: 16 },
    { header: "Tanggal", key: "d", width: 12 },
    { header: "Konsumen", key: "c", width: 24 },
    { header: "Proyek", key: "t", width: 34 },
    { header: "Kategori", key: "cat", width: 18 },
    { header: "Status", key: "st", width: 14 },
    { header: "Nilai Order", key: "tot", width: 18, money: true },
    { header: "HPP Estimasi", key: "est", width: 18, money: true },
    { header: "% Estimasi", key: "pest", width: 12, pct: true },
    { header: "HPP Aktual", key: "act", width: 18, money: true },
    { header: "% Aktual", key: "pact", width: 12, pct: true },
    { header: "Laba Kotor", key: "prf", width: 18, money: true },
    { header: "Evaluasi HPP", key: "lvl", width: 16 },
  ]);
  for (const o of orders) {
    const pe = o.hpp_estimate > 0 ? pct(o.hpp_estimate, o.total) : null;
    const pa = o.hpp_actual > 0 ? pct(o.hpp_actual, o.total) : null;
    const base = hppOf(o);
    const pBase = base > 0 ? pct(base, o.total) : null;
    ord.addRow({
      no: o.order_number,
      d: o.order_date,
      c: o.customer_name,
      t: o.title,
      cat: o.category ?? "-",
      st: statusMeta(o.status).label,
      tot: o.total,
      est: o.hpp_estimate > 0 ? o.hpp_estimate : null,
      pest: r1(pe),
      act: o.hpp_actual > 0 ? o.hpp_actual : null,
      pact: r1(pa),
      prf: base > 0 ? o.total - base : null,
      lvl: HPP_LEVEL_META[hppLevel(pBase, target, max)].label,
    });
  }

  // 4. HPP per Item
  const itm = sheet(wb, "HPP per Item", [
    { header: "No. Order", key: "no", width: 16 },
    { header: "Konsumen", key: "c", width: 22 },
    { header: "Nama Item", key: "n", width: 32 },
    { header: "Ukuran (P×T)", key: "dim", width: 14 },
    { header: "Qty", key: "q", width: 10 },
    { header: "Satuan", key: "u", width: 10 },
    { header: "Harga Jual", key: "rev", width: 18, money: true },
    { header: "Bahan Baku", key: "mat", width: 16, money: true },
    { header: "Tenaga Kerja", key: "lab", width: 16, money: true },
    { header: "Overhead", key: "ovh", width: 16, money: true },
    { header: "Lainnya", key: "oth", width: 14, money: true },
    { header: "Total HPP", key: "hpp", width: 18, money: true },
    { header: "HPP / Satuan", key: "uhpp", width: 16, money: true },
    { header: "HPP %", key: "pct", width: 12, pct: true },
    { header: "Laba Item", key: "prf", width: 18, money: true },
  ]);
  for (const i of items) {
    const o = orderMap.get(i.order_id);
    itm.addRow({
      no: o?.order_number ?? "-",
      c: o?.customer_name ?? "-",
      n: i.name,
      dim: i.length_m && i.height_m ? `${i.length_m} × ${i.height_m} m` : "-",
      q: i.qty,
      u: i.unit,
      rev: i.line_total,
      mat: i.material,
      lab: i.labor,
      ovh: i.overhead_lines + i.auto_overhead,
      oth: i.other,
      hpp: i.hpp_total,
      uhpp: i.hpp_unit,
      pct: r1(i.hpp_pct),
      prf: i.line_total - i.hpp_total,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-HPP_${period.from}_sd_${period.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

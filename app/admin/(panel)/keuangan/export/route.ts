import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/admin/auth";
import { BUDGET_CATEGORIES, labelOf, LEDGER_CATEGORIES, LEDGER_SOURCES, PAYROLL_STATUSES, SCHEDULE_STATUSES, STOCK_STATUSES } from "@/lib/erp/constants";
import { getFinanceReport, getInventoryLots, getLedger, listPayroll, listProjects } from "@/lib/erp/data";
import { resolvePeriod, statusMeta } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAVY = "FF17263C";
const CREAM = "FFE8DDC8";
const MONEY = '"Rp" #,##0;[Red]-"Rp" #,##0';

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width: number; money?: boolean }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: MONEY } : {} }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: CREAM } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  return ws;
}

/** GET /admin/keuangan/export?preset=... | ?from=&to= → Excel laporan keuangan, proyek, stok & gaji. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Unauthorized", { status: 401 });
  const period = resolvePeriod(Object.fromEntries(new URL(request.url).searchParams));
  const sb = await createClient();
  const [report, ledger, projects, lots, payroll] = await Promise.all([
    getFinanceReport(period.from, period.to, sb),
    getLedger(period.from, period.to, sb),
    listProjects(sb),
    getInventoryLots(sb, { activeOnly: true }),
    listPayroll(period.from, period.to, sb),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Mandiri Furniture";
  wb.created = new Date();

  const sum = sheet(wb, "Ringkasan", [
    { header: "Keterangan", key: "k", width: 44 },
    { header: "Nilai", key: "v", width: 22, money: true },
  ]);
  const n = (v: unknown) => Number(v) || 0;
  if (report) {
    sum.addRows([
      { k: `Periode ${period.label}` },
      { k: "Total omzet (order deal)", v: n(report.revenue) },
      { k: "DP diterima", v: n(report.customer_payments.dp) },
      { k: "Termin diterima", v: n(report.customer_payments.termin) },
      { k: "Pelunasan diterima", v: n(report.customer_payments.pelunasan) },
      { k: "Total pembelian material", v: n(report.purchases) },
      { k: "Total upah pekerja", v: n(report.labor_total) },
      { k: "Total biaya operasional", v: n(report.operational) },
      { k: "Biaya langsung proyek", v: n(report.direct_cost) },
      { k: "Laba kotor proyek", v: n(report.gross_profit) },
      { k: "Biaya overhead", v: n(report.overhead) },
      { k: "Gaji tidak terbebankan ke proyek", v: n(report.payroll_unallocated) },
      { k: "Laba operasional", v: n(report.operating_profit) },
      { k: "Kas masuk", v: n(report.cash_in) },
      { k: "Kas keluar", v: n(report.cash_out) },
      { k: "Saldo kas akhir periode", v: n(report.cash_balance) },
      { k: "Piutang konsumen", v: n(report.receivables) },
      { k: "Utang supplier", v: n(report.payables) },
      { k: "Kasbon pegawai belum kembali", v: n(report.loans_outstanding) },
    ]);
    sum.getRow(2).font = { italic: true };
    for (const r of [11, 14]) sum.getRow(r).font = { bold: true };
  }

  const kas = sheet(wb, "Buku Kas", [
    { header: "Tanggal", key: "d", width: 12 },
    { header: "No. transaksi", key: "no", width: 18 },
    { header: "Akun", key: "acc", width: 22 },
    { header: "Kategori", key: "cat", width: 28 },
    { header: "Sumber", key: "src", width: 18 },
    { header: "Keterangan", key: "desc", width: 48 },
    { header: "Order", key: "ord", width: 16 },
    { header: "Masuk", key: "in", width: 16, money: true },
    { header: "Keluar", key: "out", width: 16, money: true },
  ]);
  for (const r of [...ledger].reverse()) {
    kas.addRow({ d: r.txn_date, no: r.txn_number, acc: r.account_name, cat: labelOf(LEDGER_CATEGORIES, r.category), src: LEDGER_SOURCES[r.source_type] ?? r.source_type, desc: r.description, ord: r.order_number, in: r.direction === "in" ? r.amount : null, out: r.direction === "out" ? r.amount : null });
  }

  const pr = sheet(wb, "Proyek", [
    { header: "No. order", key: "no", width: 16 },
    { header: "Proyek", key: "t", width: 36 },
    { header: "Konsumen", key: "c", width: 24 },
    { header: "Status", key: "s", width: 12 },
    { header: "Jadwal", key: "sch", width: 18 },
    { header: "Progres %", key: "p", width: 10 },
    { header: "Nilai kontrak", key: "v", width: 16, money: true },
    { header: "RAB material", key: "rab", width: 16, money: true },
    { header: "Anggaran biaya", key: "b", width: 16, money: true },
    { header: "Material aktual", key: "m", width: 16, money: true },
    { header: "Upah aktual", key: "l", width: 16, money: true },
    { header: "Biaya lain", key: "o", width: 16, money: true },
    { header: "Total biaya", key: "tc", width: 16, money: true },
    { header: "Estimasi laba", key: "ep", width: 16, money: true },
    { header: "Laba aktual", key: "ap", width: 16, money: true },
    { header: "Piutang", key: "bal", width: 16, money: true },
  ]);
  for (const p of projects.filter((x) => x.order_date <= period.to && (x.is_active || x.order_date >= period.from))) {
    pr.addRow({
      no: p.order_number,
      t: p.title,
      c: p.customer_name,
      s: statusMeta(p.order_status).label,
      sch: labelOf(SCHEDULE_STATUSES, p.schedule_status),
      p: Math.round(p.progress),
      v: p.contract_value,
      rab: p.rab_total,
      b: p.budget_cost_total,
      m: p.material_actual,
      l: p.labor_actual,
      o: p.other_actual,
      tc: p.actual_total_cost,
      ep: p.estimated_profit,
      ap: p.actual_profit,
      bal: p.balance,
    });
  }

  const st = sheet(wb, "Stok", [
    { header: "Kode stok", key: "code", width: 18 },
    { header: "Barang", key: "item", width: 32 },
    { header: "Kategori", key: "cat", width: 18 },
    { header: "Supplier", key: "sup", width: 22 },
    { header: "Tgl beli", key: "d", width: 12 },
    { header: "Stok fisik", key: "on", width: 11 },
    { header: "Dialokasikan", key: "al", width: 12 },
    { header: "Tersedia", key: "av", width: 11 },
    { header: "Satuan", key: "u", width: 9 },
    { header: "Harga/satuan", key: "uc", width: 15, money: true },
    { header: "Nilai stok", key: "val", width: 16, money: true },
    { header: "Lokasi", key: "loc", width: 16 },
    { header: "Status", key: "s", width: 18 },
  ]);
  for (const l of lots) {
    st.addRow({ code: l.stock_code, item: l.item_name, cat: l.category_name, sup: l.supplier_name, d: l.purchase_date, on: l.qty_on_hand, al: l.qty_allocated, av: l.qty_available, u: l.unit, uc: l.unit_cost, val: l.stock_value, loc: l.location, s: labelOf(STOCK_STATUSES, l.stock_status) });
  }

  const gj = sheet(wb, "Gaji", [
    { header: "No. slip", key: "no", width: 18 },
    { header: "Pegawai", key: "n", width: 26 },
    { header: "Periode", key: "per", width: 24 },
    { header: "Hari kerja", key: "d", width: 10 },
    { header: "Gaji kotor", key: "g", width: 16, money: true },
    { header: "Potongan", key: "p", width: 16, money: true },
    { header: "Gaji bersih", key: "net", width: 16, money: true },
    { header: "Status", key: "s", width: 12 },
    { header: "Tgl bayar", key: "pd", width: 12 },
  ]);
  for (const s of payroll) {
    gj.addRow({ no: s.slip_number, n: s.full_name, per: `${s.period_start} s/d ${s.period_end}`, d: s.days_worked, g: s.total_earnings, p: s.total_deductions, net: s.net_amount, s: labelOf(PAYROLL_STATUSES, s.status), pd: s.payment_date });
  }

  if (report?.fund_allocation.length) {
    const fa = sheet(wb, "Alokasi Dana", [
      { header: "Dana", key: "c", width: 28 },
      { header: "Anggaran", key: "b", width: 16, money: true },
      { header: "Dialokasikan", key: "a", width: 16, money: true },
      { header: "Dibelanjakan", key: "s", width: 16, money: true },
      { header: "Tersedia", key: "l", width: 16, money: true },
    ]);
    for (const f of report.fund_allocation) fa.addRow({ c: labelOf(BUDGET_CATEGORIES, f.category), b: n(f.budget), a: n(f.allocated), s: n(f.spent), l: n(f.allocated) - n(f.spent) });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-keuangan-${period.from}_${period.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

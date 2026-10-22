import "server-only";
import ExcelJS from "exceljs";
import {
  BOOKED_STATUSES,
  bucketLabel,
  daysBetween,
  jakartaToday,
  kindLabel,
  methodLabel,
  paymentMeta,
  periodLabel,
  sourceLabel,
  statusMeta,
  targetForPeriod,
  type OrderReport,
} from "@/lib/orders";
import { addNativeCharts, type ChartSpec } from "@/lib/xlsx-charts";
import type { OrderRow } from "./orders-data";

export interface ReportItemRow {
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  order: { order_number: string; order_date: string; customer_name: string; status: string };
}
export interface ReportPaymentRow {
  paid_at: string;
  amount: number;
  method: string;
  kind: string;
  reference: string | null;
  note: string | null;
  order: { order_number: string; customer_name: string; title: string };
}

export interface ReportWorkbookInput {
  businessName: string;
  generatedBy: string;
  periodName: string;
  report: OrderReport;
  monthlyTarget: number;
  orders: OrderRow[];
  items: ReportItemRow[];
  payments: ReportPaymentRow[];
  receivables: OrderRow[];
}

const C = {
  ink: "FF1C1C1C",
  wood: "FF9A6B43",
  bronze: "FFC8A46A",
  cream: "FFF8F4EC",
  cream2: "FFEFE8DA",
  line: "FFE3D8C3",
  muted: "FF6B6B6B",
  white: "FFFFFFFF",
  green: "FF15803D",
  red: "FFDC2626",
};
const RP = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" 0';
const PCT = "0.0%;[Red]-0.0%";
const INT = "#,##0";
const DATE = "dd mmm yyyy";

const toDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null);
const thin = { style: "thin" as const, color: { argb: C.line } };

function header(ws: ExcelJS.Worksheet, row: number, values: string[], startCol = 1) {
  const r = ws.getRow(row);
  values.forEach((v, i) => {
    const cell = r.getCell(startCol + i);
    cell.value = v;
    cell.font = { bold: true, color: { argb: C.white }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.ink } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
    cell.border = { bottom: thin };
  });
  r.height = 22;
}

function sectionTitle(ws: ExcelJS.Worksheet, row: number, text: string, col = 1) {
  const cell = ws.getCell(row, col);
  cell.value = text;
  cell.font = { bold: true, size: 12, color: { argb: C.wood } };
}

function zebra(ws: ExcelJS.Worksheet, from: number, to: number, cols: number, startCol = 1) {
  for (let r = from; r <= to; r++) {
    for (let c = startCol; c < startCol + cols; c++) {
      const cell = ws.getCell(r, c);
      cell.border = { bottom: thin };
      if ((r - from) % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.cream } };
    }
  }
}

function totalRow(ws: ExcelJS.Worksheet, row: number, cols: number, startCol = 1) {
  for (let c = startCol; c < startCol + cols; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.cream2 } };
    cell.border = { top: { style: "medium", color: { argb: C.wood } } };
  }
}

/** Kolom huruf dari indeks 1-based. */
const col = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export async function buildReportWorkbook(input: ReportWorkbookInput): Promise<Buffer> {
  const { report, businessName } = input;
  const cur = report.current;
  const prev = report.previous;
  const range = report.range;
  const wb = new ExcelJS.Workbook();
  wb.creator = `${businessName} — Admin Panel`;
  wb.created = new Date();
  wb.title = `Laporan Penjualan ${periodLabel(range.from, range.to)}`;

  // Urutan sheet = nomor file sheetN.xml (dipakai untuk grafik).
  const wsSum = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }], properties: { tabColor: { argb: C.wood } } });
  const wsTrend = wb.addWorksheet("Tren", { views: [{ state: "frozen", ySplit: 1 }] });
  const wsOrders = wb.addWorksheet("Order", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  const wsItems = wb.addWorksheet("Item", { views: [{ state: "frozen", ySplit: 1 }] });
  const wsPay = wb.addWorksheet("Pembayaran", { views: [{ state: "frozen", ySplit: 1 }] });
  const wsAr = wb.addWorksheet("Piutang", { views: [{ state: "frozen", ySplit: 1 }] });
  for (const ws of [wsSum, wsTrend, wsOrders, wsItems, wsPay, wsAr]) {
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
    ws.headerFooter = { oddFooter: `&L${businessName} — Laporan Penjualan&R&P / &N` };
  }

  // ------------------------------------------------------------------ Tren
  header(wsTrend, 1, [range.grain === "month" ? "Bulan" : range.grain === "week" ? "Minggu mulai" : "Tanggal", "Omset", "Kas masuk", "Jumlah order"]);
  report.series.forEach((s, i) => {
    const r = wsTrend.getRow(i + 2);
    r.getCell(1).value = bucketLabel(s.bucket, range.grain);
    r.getCell(2).value = Number(s.revenue);
    r.getCell(3).value = Number(s.cash_in);
    r.getCell(4).value = Number(s.orders);
  });
  const trendLast = report.series.length + 1;
  zebra(wsTrend, 2, trendLast, 4);
  const trendTotal = trendLast + 1;
  wsTrend.getCell(trendTotal, 1).value = "Total";
  wsTrend.getCell(trendTotal, 2).value = { formula: `SUM(B2:B${trendLast})` };
  wsTrend.getCell(trendTotal, 3).value = { formula: `SUM(C2:C${trendLast})` };
  wsTrend.getCell(trendTotal, 4).value = { formula: `SUM(D2:D${trendLast})` };
  totalRow(wsTrend, trendTotal, 4);
  wsTrend.columns = [{ width: 16 }, { width: 18, style: { numFmt: RP } }, { width: 18, style: { numFmt: RP } }, { width: 14, style: { numFmt: INT } }];

  // --------------------------------------------------------------- Ringkasan
  wsSum.columns = [{ width: 34 }, { width: 20 }, { width: 20 }, { width: 13 }, { width: 46 }, { width: 3 }];
  wsSum.mergeCells("A1:E1");
  const t = wsSum.getCell("A1");
  t.value = `Laporan Penjualan — ${businessName}`;
  t.font = { bold: true, size: 18, color: { argb: C.ink } };
  wsSum.getRow(1).height = 30;
  wsSum.getCell("A2").value = `Periode: ${input.periodName} (${periodLabel(range.from, range.to)}, ${range.days} hari)`;
  wsSum.getCell("A3").value = `Pembanding: ${periodLabel(range.prev_from, range.prev_to)}`;
  wsSum.getCell("A4").value = `Dibuat: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" })} WIB oleh ${input.generatedBy}`;
  for (const a of ["A2", "A3", "A4"]) wsSum.getCell(a).font = { size: 10, color: { argb: C.muted } };

  sectionTitle(wsSum, 6, "Indikator utama (KPI)");
  header(wsSum, 7, ["Metrik", "Periode ini", "Periode sebelumnya", "Perubahan", "Keterangan"]);
  const target = targetForPeriod(input.monthlyTarget, range.from, range.to);
  type Kpi = [string, number | { formula: string }, number | { formula: string } | null, string, string, boolean?];
  const kpis: Kpi[] = [
    ["Omset", cur.revenue, prev.revenue, RP, "Nilai order terkonfirmasi (Deal s.d. Selesai) berdasarkan tanggal order"],
    ["Kas masuk", cur.cash_in, prev.cash_in, RP, "Pembayaran diterima berdasarkan tanggal bayar"],
    ["Jumlah order", cur.orders, prev.orders, INT, "Order terkonfirmasi"],
    ["Rata-rata nilai order", { formula: "IFERROR(B8/B10,0)" }, { formula: "IFERROR(C8/C10,0)" }, RP, "Omset ÷ jumlah order"],
    ["Laba kotor (estimasi)", cur.gross_profit, prev.gross_profit, RP, "Omset − HPP yang diisi di order"],
    ["Margin kotor", { formula: "IFERROR(B12/B8,0)" }, { formula: "IFERROR(C12/C8,0)" }, PCT, "Laba kotor ÷ omset"],
    ["Order selesai", cur.completed, prev.completed, INT, "Berdasarkan tanggal selesai"],
    ["Order batal", cur.cancelled, prev.cancelled, INT, "Berdasarkan tanggal order", true],
    ["Penawaran", cur.quotations, prev.quotations, INT, "Status Penawaran (belum deal)"],
    ["Leads masuk", cur.leads, prev.leads, INT, "Request survey + pesan kontak dari website"],
    ["Rasio order / leads", { formula: "IFERROR(B10/B17,0)" }, { formula: "IFERROR(C10/C17,0)" }, PCT, "Order terkonfirmasi ÷ leads (order dari WA/IG juga dihitung)"],
    ["Target omset", target, null, RP, input.monthlyTarget ? "Target bulanan × porsi hari periode" : "Belum diatur — atur di Admin → Laporan"],
    ["Pencapaian target", { formula: "IFERROR(B8/B19,0)" }, null, PCT, "Omset ÷ target"],
  ];
  kpis.forEach(([label, a, b, fmt, note, invert], i) => {
    const r = 8 + i;
    wsSum.getCell(r, 1).value = label;
    wsSum.getCell(r, 1).font = { bold: true };
    wsSum.getCell(r, 2).value = a;
    wsSum.getCell(r, 2).numFmt = fmt;
    if (b !== null) {
      wsSum.getCell(r, 3).value = b;
      wsSum.getCell(r, 3).numFmt = fmt;
      // Baris persentase: selisih dalam poin persen; lainnya: perubahan relatif.
      wsSum.getCell(r, 4).value = fmt === PCT ? { formula: `(B${r}-C${r})*100` } : { formula: `IF(C${r}=0,"",(B${r}-C${r})/ABS(C${r}))` };
      wsSum.getCell(r, 4).numFmt = fmt === PCT ? '+0.0" pt";[Red]-0.0" pt"' : PCT;
    }
    wsSum.getCell(r, 5).value = note + (invert ? " (turun = lebih baik)" : "");
    wsSum.getCell(r, 5).font = { size: 9, color: { argb: C.muted } };
    wsSum.getCell(r, 5).alignment = { wrapText: true, vertical: "middle" };
  });
  zebra(wsSum, 8, 20, 5);
  for (const c of ["A8", "B8"]) wsSum.getCell(c).font = { bold: true, size: 12, color: { argb: C.wood } };

  // Piutang & pipeline
  let row = 22;
  sectionTitle(wsSum, row, "Piutang per hari ini");
  header(wsSum, row + 1, ["Keterangan", "Nilai", "Jumlah order"]);
  const ar = report.receivables;
  [
    ["Total piutang (order terkonfirmasi)", ar.amount, ar.orders],
    ["Lewat jatuh tempo", ar.overdue_amount, ar.overdue_orders],
  ].forEach(([label, v, n], i) => {
    const r = row + 2 + i;
    wsSum.getCell(r, 1).value = label as string;
    wsSum.getCell(r, 2).value = v as number;
    wsSum.getCell(r, 2).numFmt = RP;
    wsSum.getCell(r, 3).value = n as number;
  });
  zebra(wsSum, row + 2, row + 3, 3);
  wsSum.getCell(row + 3, 2).font = { bold: true, color: { argb: C.red } };

  row += 6;
  sectionTitle(wsSum, row, "Order berjalan (pipeline) per hari ini");
  header(wsSum, row + 1, ["Status", "Nilai", "Jumlah order"]);
  const pipeStart = row + 2;
  if (report.pipeline.length) {
    report.pipeline.forEach((p, i) => {
      wsSum.getCell(pipeStart + i, 1).value = statusMeta(p.status).label;
      wsSum.getCell(pipeStart + i, 2).value = Number(p.value);
      wsSum.getCell(pipeStart + i, 2).numFmt = RP;
      wsSum.getCell(pipeStart + i, 3).value = Number(p.orders);
    });
    zebra(wsSum, pipeStart, pipeStart + report.pipeline.length - 1, 3);
  } else wsSum.getCell(pipeStart, 1).value = "Tidak ada order berjalan";
  row = pipeStart + Math.max(1, report.pipeline.length) + 2;

  // Rincian (tabel juga menjadi sumber grafik)
  const breakdown = (titleText: string, firstCol: string, rows: { label: string; revenue: number; orders: number }[]) => {
    sectionTitle(wsSum, row, titleText);
    header(wsSum, row + 1, [firstCol, "Omset", "Order", "Kontribusi"]);
    const start = row + 2;
    const end = start + Math.max(rows.length, 1) - 1;
    if (rows.length) {
      rows.forEach((x, i) => {
        const r = start + i;
        wsSum.getCell(r, 1).value = x.label;
        wsSum.getCell(r, 2).value = Number(x.revenue);
        wsSum.getCell(r, 2).numFmt = RP;
        wsSum.getCell(r, 3).value = Number(x.orders);
        wsSum.getCell(r, 4).value = { formula: `IFERROR(B${r}/SUM($B$${start}:$B$${end}),0)` };
        wsSum.getCell(r, 4).numFmt = PCT;
      });
      zebra(wsSum, start, end, 4);
    } else wsSum.getCell(start, 1).value = "Belum ada data";
    row = end + 3;
    return { start, end, has: rows.length > 0 };
  };
  const cat = breakdown("Omset per kategori", "Kategori", report.by_category);
  const src = breakdown(
    "Omset per sumber order",
    "Sumber",
    report.by_source.map((s) => ({ ...s, label: sourceLabel(s.label) })),
  );

  sectionTitle(wsSum, row, "Top customer");
  header(wsSum, row + 1, ["Customer", "Omset", "Order", "No. HP"]);
  const topStart = row + 2;
  if (report.top_customers.length) {
    report.top_customers.forEach((c, i) => {
      const r = topStart + i;
      wsSum.getCell(r, 1).value = c.name;
      wsSum.getCell(r, 2).value = Number(c.revenue);
      wsSum.getCell(r, 2).numFmt = RP;
      wsSum.getCell(r, 3).value = Number(c.orders);
      wsSum.getCell(r, 4).value = c.phone ?? "-";
    });
    zebra(wsSum, topStart, topStart + report.top_customers.length - 1, 4);
  } else wsSum.getCell(topStart, 1).value = "Belum ada data";

  // ------------------------------------------------------------------ Order
  const orderCols: { h: string; w: number; fmt?: string; v: (o: OrderRow) => ExcelJS.CellValue }[] = [
    { h: "No. Order", w: 16, v: (o) => o.order_number },
    { h: "Tanggal", w: 12, fmt: DATE, v: (o) => toDate(o.order_date) },
    { h: "Customer", w: 22, v: (o) => o.customer_name },
    { h: "No. HP", w: 15, v: (o) => o.customer_phone ?? "" },
    { h: "Project", w: 28, v: (o) => o.title },
    { h: "Kategori", w: 16, v: (o) => o.category ?? "" },
    { h: "Sumber", w: 14, v: (o) => sourceLabel(o.source) },
    { h: "Status", w: 12, v: (o) => statusMeta(o.status).label },
    { h: "Dihitung omset", w: 10, v: (o) => (BOOKED_STATUSES.includes(o.status) ? "Ya" : "Tidak") },
    { h: "Subtotal", w: 15, fmt: RP, v: (o) => o.subtotal },
    { h: "Diskon", w: 13, fmt: RP, v: (o) => o.discount },
    { h: "Biaya tambahan", w: 13, fmt: RP, v: (o) => o.additional_fee },
    { h: "Total", w: 16, fmt: RP, v: (o) => o.total },
    { h: "HPP", w: 15, fmt: RP, v: (o) => o.cost_estimate },
    { h: "Laba kotor", w: 15, fmt: RP, v: (o) => o.gross_profit },
    { h: "Dibayar", w: 15, fmt: RP, v: (o) => o.paid_amount },
    { h: "Sisa tagihan", w: 15, fmt: RP, v: (o) => o.balance },
    { h: "Status bayar", w: 12, v: (o) => paymentMeta(o.payment_status).label },
    { h: "Jatuh tempo", w: 12, fmt: DATE, v: (o) => toDate(o.due_date) },
    { h: "Tgl selesai", w: 12, fmt: DATE, v: (o) => toDate(o.completed_at) },
    { h: "Catatan", w: 30, v: (o) => o.notes ?? "" },
  ];
  header(wsOrders, 1, orderCols.map((c) => c.h));
  input.orders.forEach((o, i) => {
    const r = wsOrders.getRow(i + 2);
    orderCols.forEach((c, j) => (r.getCell(j + 1).value = c.v(o)));
    if (o.status === "cancelled") r.font = { color: { argb: C.muted }, strike: true };
  });
  orderCols.forEach((c, j) => {
    wsOrders.getColumn(j + 1).width = c.w;
    if (c.fmt) wsOrders.getColumn(j + 1).numFmt = c.fmt;
  });
  const oLast = input.orders.length + 1;
  zebra(wsOrders, 2, oLast, orderCols.length);
  wsOrders.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(oLast, 1), column: orderCols.length } };
  const oTot = oLast + 1;
  wsOrders.getCell(oTot, 1).value = "Total (sesuai filter)";
  // SUBTOTAL(109) = jumlah baris yang terlihat → ikut berubah saat autofilter dipakai.
  for (const h of ["Subtotal", "Diskon", "Biaya tambahan", "Total", "HPP", "Laba kotor", "Dibayar", "Sisa tagihan"]) {
    const j = orderCols.findIndex((c) => c.h === h) + 1;
    wsOrders.getCell(oTot, j).value = { formula: `SUBTOTAL(109,${col(j)}2:${col(j)}${Math.max(oLast, 2)})` };
  }
  totalRow(wsOrders, oTot, orderCols.length);

  // ------------------------------------------------------------------- Item
  header(wsItems, 1, ["No. Order", "Tanggal", "Customer", "Status order", "Item", "Keterangan", "Qty", "Satuan", "Harga satuan", "Jumlah"]);
  input.items.forEach((it, i) => {
    const r = wsItems.getRow(i + 2);
    r.values = [
      it.order.order_number,
      toDate(it.order.order_date),
      it.order.customer_name,
      statusMeta(it.order.status).label,
      it.name,
      it.description ?? "",
      Number(it.qty),
      it.unit,
      Number(it.unit_price),
      Number(it.line_total),
    ];
  });
  [16, 12, 22, 12, 30, 30, 8, 9, 15, 16].forEach((w, j) => (wsItems.getColumn(j + 1).width = w));
  wsItems.getColumn(2).numFmt = DATE;
  wsItems.getColumn(7).numFmt = "#,##0.##";
  wsItems.getColumn(9).numFmt = RP;
  wsItems.getColumn(10).numFmt = RP;
  const iLast = input.items.length + 1;
  zebra(wsItems, 2, iLast, 10);
  wsItems.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(iLast, 1), column: 10 } };
  wsItems.getCell(iLast + 1, 1).value = "Total";
  wsItems.getCell(iLast + 1, 10).value = { formula: `SUBTOTAL(109,J2:J${Math.max(iLast, 2)})` };
  totalRow(wsItems, iLast + 1, 10);

  // ------------------------------------------------------------- Pembayaran
  header(wsPay, 1, ["Tanggal bayar", "No. Order", "Customer", "Project", "Jenis", "Metode", "Referensi", "Catatan", "Jumlah"]);
  input.payments.forEach((p, i) => {
    wsPay.getRow(i + 2).values = [
      toDate(p.paid_at),
      p.order.order_number,
      p.order.customer_name,
      p.order.title,
      kindLabel(p.kind),
      methodLabel(p.method),
      p.reference ?? "",
      p.note ?? "",
      Number(p.amount),
    ];
  });
  [13, 16, 22, 28, 11, 14, 16, 26, 16].forEach((w, j) => (wsPay.getColumn(j + 1).width = w));
  wsPay.getColumn(1).numFmt = DATE;
  wsPay.getColumn(9).numFmt = RP;
  const pLast = input.payments.length + 1;
  zebra(wsPay, 2, pLast, 9);
  wsPay.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(pLast, 1), column: 9 } };
  wsPay.getCell(pLast + 1, 1).value = "Total kas masuk";
  wsPay.getCell(pLast + 1, 9).value = { formula: `SUBTOTAL(109,I2:I${Math.max(pLast, 2)})` };
  totalRow(wsPay, pLast + 1, 9);

  // ---------------------------------------------------------------- Piutang
  const today = jakartaToday();
  header(wsAr, 1, ["No. Order", "Tanggal", "Customer", "No. HP", "Project", "Status", "Total", "Dibayar", "Sisa tagihan", "Jatuh tempo", "Hari terlambat"]);
  input.receivables.forEach((o, i) => {
    const late = o.due_date && o.due_date < today ? daysBetween(o.due_date, today) - 1 : 0;
    const r = wsAr.getRow(i + 2);
    r.values = [o.order_number, toDate(o.order_date), o.customer_name, o.customer_phone ?? "", o.title, statusMeta(o.status).label, o.total, o.paid_amount, o.balance, toDate(o.due_date), late];
    if (late > 0) r.getCell(11).font = { bold: true, color: { argb: C.red } };
  });
  [16, 12, 22, 15, 28, 12, 15, 15, 16, 12, 12].forEach((w, j) => (wsAr.getColumn(j + 1).width = w));
  wsAr.getColumn(2).numFmt = DATE;
  wsAr.getColumn(10).numFmt = DATE;
  for (const j of [7, 8, 9]) wsAr.getColumn(j).numFmt = RP;
  const aLast = input.receivables.length + 1;
  zebra(wsAr, 2, aLast, 11);
  wsAr.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(aLast, 1), column: 11 } };
  wsAr.getCell(aLast + 1, 1).value = "Total piutang";
  wsAr.getCell(aLast + 1, 9).value = { formula: `SUBTOTAL(109,I2:I${Math.max(aLast, 2)})` };
  totalRow(wsAr, aLast + 1, 11);

  // ----------------------------------------------------------------- Grafik
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const charts: ChartSpec[] = [];
  if (report.series.length) {
    charts.push({
      sheet: 1,
      type: "column",
      title: "Tren omset & kas masuk",
      categoriesRef: `'Tren'!$A$2:$A$${trendLast}`,
      series: [
        { nameRef: `'Tren'!$B$1`, valuesRef: `'Tren'!$B$2:$B$${trendLast}`, color: "#9A6B43" },
        { nameRef: `'Tren'!$C$1`, valuesRef: `'Tren'!$C$2:$C$${trendLast}`, color: "#C8A46A", asLine: true },
      ],
      from: { col: 6, row: 5 },
      to: { col: 16, row: 24 },
      numberFormat: '#,##0',
    });
    charts.push({
      sheet: 2,
      type: "column",
      title: "Omset & kas masuk",
      categoriesRef: `'Tren'!$A$2:$A$${trendLast}`,
      series: [
        { nameRef: `'Tren'!$B$1`, valuesRef: `'Tren'!$B$2:$B$${trendLast}`, color: "#9A6B43" },
        { nameRef: `'Tren'!$C$1`, valuesRef: `'Tren'!$C$2:$C$${trendLast}`, color: "#C8A46A", asLine: true },
      ],
      from: { col: 5, row: 1 },
      to: { col: 15, row: 20 },
    });
  }
  if (cat.has) {
    charts.push({
      sheet: 1,
      type: "doughnut",
      title: "Kontribusi omset per kategori",
      categoriesRef: `'Ringkasan'!$A$${cat.start}:$A$${cat.end}`,
      series: [{ nameRef: `'Ringkasan'!$B$${cat.start - 1}`, valuesRef: `'Ringkasan'!$B$${cat.start}:$B$${cat.end}`, color: "#9A6B43" }],
      pointColors: ["#7C5433", "#9A6B43", "#B4875F", "#C8A46A", "#D9BE8C", "#3A3A3A", "#6B6B6B", "#A3A3A3", "#E3D8C3", "#5E3F27"],
      from: { col: 6, row: 25 },
      to: { col: 11, row: 42 },
    });
  }
  if (src.has) {
    charts.push({
      sheet: 1,
      type: "bar",
      title: "Omset per sumber order",
      categoriesRef: `'Ringkasan'!$A$${src.start}:$A$${src.end}`,
      series: [{ nameRef: `'Ringkasan'!$B$${src.start - 1}`, valuesRef: `'Ringkasan'!$B$${src.start}:$B$${src.end}`, color: "#9A6B43" }],
      from: { col: 11, row: 25 },
      to: { col: 16, row: 42 },
    });
  }
  return addNativeCharts(buffer, charts);
}


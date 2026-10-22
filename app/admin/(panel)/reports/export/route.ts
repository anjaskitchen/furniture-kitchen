import { accountLabel } from "@/lib/admin/accounts";
import { getCurrentUser } from "@/lib/admin/auth";
import { getMonthlyTarget, getOrderReport, listOrders, type OrderRow } from "@/lib/admin/orders-data";
import { buildReportWorkbook, type ReportItemRow, type ReportPaymentRow } from "@/lib/admin/report-xlsx";
import { resolvePeriod } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/services/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /admin/reports/export?preset=this_month | ?from=YYYY-MM-DD&to=YYYY-MM-DD → file Excel laporan lengkap. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["admin", "editor"].includes(user.role)) return new Response("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(sp);
  const sb = await createClient();

  const [settings, report, monthlyTarget, orders, items, payments, receivables] = await Promise.all([
    getSettings(),
    getOrderReport(period.from, period.to),
    getMonthlyTarget(),
    listOrders({ from: period.from, to: period.to, sort: "oldest" }, { all: true }),
    sb
      .from("order_items")
      .select("name,description,qty,unit,unit_price,line_total,sort_order,order:orders!inner(order_number,order_date,customer_name,status)")
      .gte("order.order_date", period.from)
      .lte("order.order_date", period.to)
      .order("sort_order")
      .limit(20000),
    sb
      .from("order_payments")
      .select("paid_at,amount,method,kind,reference,note,order:orders!inner(order_number,customer_name,title)")
      .gte("paid_at", period.from)
      .lte("paid_at", period.to)
      .order("paid_at")
      .limit(20000),
    sb.from("orders_view").select("*").eq("is_booked", true).gt("balance", 0).order("due_date", { ascending: true, nullsFirst: false }).limit(5000),
  ]);
  if (!report) return new Response("Gagal membuat laporan", { status: 500 });
  for (const r of [items, payments, receivables]) if (r.error) return new Response(r.error.message, { status: 500 });

  const num = <T,>(rows: unknown[], keys: string[]) =>
    rows.map((r) => {
      const o = { ...(r as Record<string, unknown>) };
      for (const k of keys) if (o[k] != null) o[k] = Number(o[k]);
      return o as T;
    });

  // Urutkan item mengikuti nomor order agar mudah dibaca.
  const itemRows = num<ReportItemRow>(items.data ?? [], ["qty", "unit_price", "line_total"]).sort(
    (a, b) => a.order.order_date.localeCompare(b.order.order_date) || a.order.order_number.localeCompare(b.order.order_number),
  );

  const file = await buildReportWorkbook({
    businessName: settings.business_name,
    generatedBy: accountLabel(user),
    periodName: period.label,
    report,
    monthlyTarget,
    orders: orders.rows,
    items: itemRows,
    payments: num<ReportPaymentRow>(payments.data ?? [], ["amount"]),
    receivables: num<OrderRow>(receivables.data ?? [], ["subtotal", "discount", "additional_fee", "total", "cost_estimate", "paid_amount", "balance", "gross_profit"]),
  });

  const name = `Laporan-Penjualan_${period.from}_sd_${period.to}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

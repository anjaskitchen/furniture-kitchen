import { ArrowLeft, Hammer, Receipt } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { OwnerOnly } from "@/components/admin/erp/OwnerOnly";
import { HppEditor } from "@/components/admin/erp/hpp/HppEditor";
import { getCurrentUser } from "@/lib/admin/auth";
import { getOrderHppDetail, hppMaterialOptions } from "@/lib/erp/hpp";
import { fmtPct, HPP_LEVEL_META, hppLevel, pct } from "@/lib/erp/hpp-shared";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "HPP" };
  const sb = await createClient();
  const { data } = await sb.from("orders").select("order_number").eq("id", id).maybeSingle();
  return { title: data ? `HPP · ${data.order_number}` : "HPP" };
}

export default async function OrderHppPage({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return <OwnerOnly title="HPP & Margin" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const [detail, materials, templates] = await Promise.all([
    getOrderHppDetail(id),
    hppMaterialOptions(sb),
    sb.from("material_templates").select("id, name").eq("is_active", true).order("sort_order").order("name"),
  ]);
  if (!detail) notFound();
  const { order, items, lines, settings } = detail;
  let hasRab = false;
  if (order.project_id) {
    const { count } = await sb.from("project_material_requirements").select("id", { count: "exact", head: true }).eq("project_id", order.project_id);
    hasRab = (count ?? 0) > 0;
  }

  const estPct = order.has_detail ? pct(order.hpp_estimate, order.total) : null;
  const actPct = order.hpp_actual > 0 ? pct(order.hpp_actual, order.total) : null;
  const estLevel = hppLevel(estPct, settings.targetPct, settings.maxPct);
  const actLevel = hppLevel(actPct, settings.targetPct, settings.maxPct);
  const profit = order.total - order.hpp_estimate;
  // Diskon / biaya tambahan order ikut memengaruhi HPP% order (bukan per item).
  const adjust = order.additional_fee - order.discount;

  return (
    <>
      <AdminHeader
        title={`HPP · ${order.order_number}`}
        description={`${order.title} — ${order.customer_name}. Rincian biaya per item: bahan baku, tenaga kerja, overhead, dan lainnya.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/hpp" className="btn-outline btn-sm bg-white !py-2.5">
              <ArrowLeft className="h-4 w-4" /> Dashboard HPP
            </Link>
            <Link href={`/admin/orders/${order.order_id}`} className="btn-outline btn-sm bg-white !py-2.5">
              <Receipt className="h-4 w-4" /> Order
            </Link>
            {order.project_id && (
              <Link href={`/admin/proyek/${order.project_id}`} className="btn-outline btn-sm bg-white !py-2.5">
                <Hammer className="h-4 w-4" /> Proyek & RAB
              </Link>
            )}
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card label="Nilai order" value={formatRupiah(order.total)} sub={adjust ? `Item ${formatRupiah(order.subtotal)} ${adjust < 0 ? "−" : "+"} ${formatRupiah(Math.abs(adjust))}` : `${order.items_count} item`} />
        <Card
          label="HPP estimasi"
          value={order.has_detail ? formatRupiah(order.hpp_estimate) : "—"}
          sub={order.has_detail ? `${order.items_with_hpp}/${order.items_count} item dihitung` : "Belum ada rincian"}
        />
        <Card
          label="HPP % estimasi"
          value={<span className={HPP_LEVEL_META[estLevel].text}>{fmtPct(estPct)}</span>}
          sub={`${HPP_LEVEL_META[estLevel].label} · target ≤ ${settings.targetPct}%`}
          ring={estLevel}
        />
        <Card
          label="Laba kotor estimasi"
          value={order.has_detail ? <span className={profit < 0 ? "text-red-600" : "text-green-700"}>{formatRupiah(profit)}</span> : "—"}
          sub={order.has_detail && order.total > 0 ? `Margin ${fmtPct((profit / order.total) * 100)}` : undefined}
        />
        <Card
          label="HPP aktual (proyek)"
          value={actPct !== null ? <span className={HPP_LEVEL_META[actLevel].text}>{fmtPct(actPct)}</span> : "—"}
          sub={order.hpp_actual > 0 ? formatRupiah(order.hpp_actual) : "Dari pemakaian stok, upah, biaya proyek"}
          ring={actPct !== null ? actLevel : undefined}
        />
      </section>

      {order.items_with_hpp > 0 && order.items_with_hpp < order.items_count && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/20">
          {order.items_count - order.items_with_hpp} item belum punya rincian HPP. HPP order dihitung dari item yang sudah diisi saja.
        </p>
      )}

      <HppEditor items={items} lines={lines} materials={materials} templates={(templates.data ?? []) as { id: string; name: string }[]} hasRab={hasRab} settings={settings} />
    </>
  );
}

function Card({ label, value, sub, ring }: { label: string; value: React.ReactNode; sub?: string; ring?: "good" | "warn" | "bad" | "none" }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5",
        ring === "good" && "ring-green-600/30",
        ring === "warn" && "ring-amber-500/40",
        ring === "bad" && "ring-red-600/40",
      )}
    >
      <p className="text-xs font-medium text-charcoal-700">{label}</p>
      <p className="mt-1 font-display text-lg font-bold tabular-nums sm:text-xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-charcoal-700/70">{sub}</p>}
    </div>
  );
}

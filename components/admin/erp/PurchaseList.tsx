"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PO_STATUSES } from "@/lib/erp/constants";
import type { PurchaseOrder } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { DataTable, SearchBox, StatusPill } from "./kit";

export function PurchaseList({ rows }: { rows: PurchaseOrder[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [unpaid, setUnpaid] = useState(false);
  const today = jakartaToday();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (unpaid && !(["ordered", "received"].includes(r.status) && r.total - r.paid_amount > 0)) return false;
      if (!s) return true;
      return [r.po_number, r.supplier_name, r.invoice_number, r.project_label, r.notes].join(" ").toLowerCase().includes(s);
    });
  }, [rows, q, status, unpaid]);

  const debt = list.filter((r) => ["ordered", "received"].includes(r.status)).reduce((a, r) => a + Math.max(r.total - r.paid_amount, 0), 0);
  const total = list.filter((r) => r.status !== "cancelled").reduce((a, r) => a + r.total, 0);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari no. PO, supplier, nota, atau proyek..." />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {[{ value: "", label: "Semua" }, ...PO_STATUSES].map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm", status === s.value ? "bg-charcoal-900 font-semibold text-cream-50" : "bg-white ring-1 ring-charcoal-900/10")}
            >
              {s.label}
            </button>
          ))}
          <button onClick={() => setUnpaid((u) => !u)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm", unpaid ? "bg-red-600 font-semibold text-white" : "bg-white ring-1 ring-charcoal-900/10")}>
            Belum lunas
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">
        {list.length} PO · total {formatRupiah(total)} · utang supplier {formatRupiah(debt)}
      </p>
      <DataTable
        rows={list}
        onRowClick={(r) => router.push(`/admin/pembelian/${r.id}`)}
        empty="Belum ada pembelian."
        columns={[
          {
            key: "po_number",
            label: "No. PO",
            render: (r) => (
              <div>
                <p className="font-semibold">{r.po_number}</p>
                <p className="text-xs text-charcoal-700/70">{formatDateShort(r.order_date)}{r.invoice_number ? ` · Nota ${r.invoice_number}` : ""}</p>
              </div>
            ),
          },
          { key: "supplier_name", label: "Supplier" },
          { key: "project_label", label: "Proyek", render: (r) => <span className="line-clamp-1 max-w-[220px]">{r.project_label ?? "Stok umum"}</span> },
          { key: "status", label: "Status", render: (r) => <StatusPill list={PO_STATUSES} value={r.status} /> },
          { key: "total", label: "Total", align: "right", render: (r) => formatRupiah(r.total) },
          {
            key: "debt",
            label: "Sisa bayar",
            align: "right",
            render: (r) => {
              const d = ["ordered", "received"].includes(r.status) ? Math.max(r.total - r.paid_amount, 0) : 0;
              const overdue = d > 0 && r.due_date && r.due_date < today;
              return d > 0 ? (
                <span className={cn("font-medium", overdue ? "text-red-600" : "text-amber-700")}>
                  {formatRupiah(d)}
                  {r.due_date && <span className="block text-xs font-normal">jatuh tempo {formatDateShort(r.due_date)}</span>}
                </span>
              ) : (
                <span className="text-green-700">{r.status === "cancelled" || r.status === "draft" ? "-" : "Lunas"}</span>
              );
            },
          },
        ]}
      />
    </div>
  );
}

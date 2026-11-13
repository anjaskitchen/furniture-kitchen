"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/admin/orders/ui";
import { INDICATORS, SCHEDULE_STATUSES } from "@/lib/erp/constants";
import type { ProjectRow } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { DataTable, ProgressBar, SearchBox, StatusPill } from "../kit";

const FILTERS = [
  { value: "active", label: "Sedang berjalan" },
  { value: "attention", label: "Perlu perhatian" },
  { value: "quotation", label: "Penawaran" },
  { value: "completed", label: "Selesai" },
  { value: "all", label: "Semua" },
];

export function Indicator({ value, withLabel }: { value: string; withLabel?: boolean }) {
  const m = INDICATORS[value] ?? INDICATORS.gray;
  return (
    <span className="inline-flex items-center gap-1.5" title={m.label}>
      <span className={cn("h-3 w-3 shrink-0 rounded-full ring-4", m.dot, m.ring)} aria-hidden />
      {withLabel ? <span className="text-xs">{m.label}</span> : <span className="sr-only">{m.label}</span>}
    </span>
  );
}

export function ProjectList({ rows, showMoney }: { rows: ProjectRow[]; showMoney: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("active");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (filter === "active" && !p.is_active) return false;
      if (filter === "attention" && !(p.is_active && (p.indicator === "red" || p.indicator === "yellow"))) return false;
      if (filter === "quotation" && p.order_status !== "quotation") return false;
      if (filter === "completed" && p.order_status !== "completed") return false;
      return !s || [p.order_number, p.title, p.customer_name, p.customer_address, p.manager_name, p.work_type].join(" ").toLowerCase().includes(s);
    });
  }, [rows, q, filter]);

  const counts = useMemo(
    () => ({
      active: rows.filter((p) => p.is_active).length,
      attention: rows.filter((p) => p.is_active && (p.indicator === "red" || p.indicator === "yellow")).length,
      quotation: rows.filter((p) => p.order_status === "quotation").length,
      completed: rows.filter((p) => p.order_status === "completed").length,
      all: rows.length,
    }),
    [rows],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari no. order, nama proyek, konsumen, alamat, penanggung jawab..." />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm", filter === f.value ? "bg-charcoal-900 font-semibold text-cream-50" : "bg-white ring-1 ring-charcoal-900/10")}
            >
              {f.label} <span className="tabular-nums opacity-70">{counts[f.value as keyof typeof counts]}</span>
            </button>
          ))}
        </div>
      </div>
      <DataTable
        rows={list}
        onRowClick={(p) => router.push(`/admin/proyek/${p.id}`)}
        empty="Belum ada proyek. Proyek dibuat otomatis setiap kali Anda menyimpan order baru."
        columns={[
          {
            key: "title",
            label: "Proyek",
            render: (p) => (
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5">
                  <Indicator value={p.indicator} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{p.title}</p>
                  <p className="text-xs text-charcoal-700/70">
                    {p.order_number} · {p.customer_name}
                  </p>
                </div>
              </div>
            ),
          },
          { key: "order_status", label: "Status", render: (p) => <StatusBadge status={p.order_status} /> },
          {
            key: "schedule",
            label: "Jadwal",
            render: (p) => (
              <div className="text-xs">
                <StatusPill list={SCHEDULE_STATUSES} value={p.schedule_status} />
                {p.target_end_date && <p className="mt-1 text-charcoal-700/70">Target {formatDateShort(p.target_end_date)}</p>}
              </div>
            ),
          },
          {
            key: "progress",
            label: "Progres",
            render: (p) => (
              <div className="w-28">
                <div className="mb-1 flex justify-between text-xs tabular-nums">
                  <span>{Math.round(p.progress)}%</span>
                  {p.expected_progress > 0 && p.is_active && <span className="text-charcoal-700/50">target {Math.round(p.expected_progress)}%</span>}
                </div>
                <ProgressBar value={p.progress} tone={p.indicator === "red" ? "bg-red-500" : p.indicator === "yellow" ? "bg-amber-400" : "bg-[#4B5138]"} />
              </div>
            ),
          },
          ...(showMoney
            ? [
                { key: "contract_value", label: "Kontrak", align: "right" as const, render: (p: ProjectRow) => formatRupiah(p.contract_value) },
                {
                  key: "cost",
                  label: "Biaya / anggaran",
                  align: "right" as const,
                  render: (p: ProjectRow) => (
                    <span className={cn(p.budget_status === "over" && "font-semibold text-red-600", p.budget_status === "near" && "text-amber-700")}>
                      {formatRupiah(p.actual_total_cost)}
                      <span className="block text-xs text-charcoal-700/60">{p.budget_cost_total ? `dari ${formatRupiah(p.budget_cost_total)}` : "belum ada anggaran"}</span>
                    </span>
                  ),
                },
              ]
            : []),
          { key: "manager_name", label: "Penanggung jawab", render: (p) => p.manager_name ?? "-", hideMobile: true },
        ]}
      />
    </div>
  );
}

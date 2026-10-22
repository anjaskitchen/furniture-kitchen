"use client";
import { Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { ColumnDef } from "@/lib/admin/resources";
import { formatDateID, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "../EmptyState";

type Row = Record<string, unknown> & { id: string };

function Cell({ col, row }: { col: ColumnDef; row: Row }) {
  const v = row[col.name];
  switch (col.type) {
    case "money":
      return <span className="tabular-nums">{v === null || v === undefined ? "-" : formatRupiah(Number(v))}</span>;
    case "percent_or_money": {
      const unit = row.unit as string;
      if (unit === "percent") return <span>{Number(v)}%</span>;
      if (unit === "multiplier") return <span>× {Number(v)}</span>;
      return <span className="tabular-nums">{formatRupiah(Number(v))}</span>;
    }
    case "boolean":
      return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", v ? "bg-green-500" : "bg-charcoal-900/20")} aria-label={v ? "Ya" : "Tidak"} />;
    case "image": {
      const src = Array.isArray(v) ? (v[0] as string) : (v as string);
      return src ? (
        <div className="relative h-11 w-14 overflow-hidden rounded-md bg-cream-200">
          <Image src={src} alt="" fill sizes="56px" unoptimized className="object-cover" />
        </div>
      ) : (
        <div className="h-11 w-14 rounded-md bg-cream-200" />
      );
    }
    case "color":
      return <span className="inline-block h-8 w-8 rounded-md ring-1 ring-black/10" style={{ backgroundColor: (v as string) || "#eee" }} />;
    case "badge":
      return v ? (
        <span className="whitespace-nowrap rounded-full bg-cream-200 px-2.5 py-1 text-xs font-medium text-charcoal-800">{col.labels?.[String(v)] ?? String(v)}</span>
      ) : (
        <span>-</span>
      );
    case "date":
      return <span className="whitespace-nowrap">{formatDateID(v as string)}</span>;
    case "rating":
      return <span className="text-bronze-500">{"★".repeat(Number(v) || 0)}</span>;
    default:
      return <span className="line-clamp-2 max-w-xs">{v === null || v === undefined || v === "" ? "-" : String(v)}</span>;
  }
}

export function AdminTable({
  columns,
  rows,
  onEdit,
  onDelete,
  extra,
}: {
  columns: ColumnDef[];
  rows: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
  extra?: (row: Row) => ReactNode;
}) {
  if (!rows.length) return <EmptyState title="Belum ada data" description="Data yang ditambahkan akan muncul di sini." />;
  const imageCol = columns.find((c) => c.type === "image" || c.type === "color");
  const [primary, ...rest] = columns.filter((c) => c !== imageCol);
  const actions = (row: Row) => (
    <>
      {extra?.(row)}
      {onEdit && (
        <button onClick={() => onEdit(row)} className="rounded-lg p-2 text-charcoal-700 transition hover:bg-cream-200" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button onClick={() => onDelete(row)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50" aria-label="Hapus">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </>
  );
  return (
    <>
      {/* Mobile: kartu */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5">
            <div className="flex items-start gap-3" onClick={() => onEdit?.(row)} role={onEdit ? "button" : undefined}>
              {imageCol && <Cell col={imageCol} row={row} />}
              <div className="min-w-0 flex-1">
                {primary && (
                  <p className="font-semibold leading-snug">
                    <Cell col={{ ...primary, type: primary.type === "badge" ? "text" : primary.type }} row={row} />
                  </p>
                )}
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {rest.map((c) => (
                    <div key={c.name} className="min-w-0">
                      <dt className="text-charcoal-700/60">{c.label}</dt>
                      <dd className="truncate text-charcoal-900">
                        <Cell col={c} row={row} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-charcoal-900/5 pt-2">{actions(row)}</div>
          </li>
        ))}
      </ul>

      {/* Tablet & desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-charcoal-900/5 bg-cream-50 text-xs uppercase tracking-wider text-charcoal-700">
            <tr>
              {columns.map((c) => (
                <th key={c.name} scope="col" className="px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-900/5">
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-cream-50/60">
                {columns.map((c) => (
                  <td key={c.name} className="px-4 py-3 align-middle">
                    <Cell col={c} row={row} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

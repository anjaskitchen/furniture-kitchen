"use client";
import { FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { quickUpdateOrder } from "@/app/admin/orders-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { Field, FormActions, MoneyInput, useAction } from "@/components/admin/erp/kit";
import { formatRupiah } from "@/lib/format";
import { jakartaToday, ORDER_STATUSES, PAYMENT_METHODS } from "@/lib/orders";
import { cn } from "@/lib/utils";

type Kind = { code: string; label: string; is_active: boolean };
type CashAccount = { id: string; name: string; kind: string; is_default: boolean };

/** Tombol "Update" di daftar order: ubah proses/status & catat pembayaran baru dengan cepat. */
export function OrderQuickUpdate({
  order,
  kinds,
  cashAccounts,
  compact,
}: {
  order: { id: string; order_number: string; customer_name: string; title: string; status: string; total: number; paid_amount: number; balance: number; completed_at: string | null };
  kinds: Kind[];
  cashAccounts?: CashAccount[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(order.status);
  const [completedAt, setCompletedAt] = useState(order.completed_at ?? jakartaToday());
  const [withPay, setWithPay] = useState(false);
  const [pay, setPay] = useState({ paid_at: jakartaToday(), amount: order.balance, kind: "pelunasan", method: "transfer", reference: "", note: "", account_id: "" });
  const { run, pending, errors } = useAction();
  const active = kinds.filter((k) => k.is_active);
  const accounts = cashAccounts ?? [];

  const start = () => {
    setStatus(order.status);
    setCompletedAt(order.completed_at ?? jakartaToday());
    setWithPay(false);
    const firstKind = order.paid_amount <= 0 ? "dp" : "pelunasan";
    setPay({ paid_at: jakartaToday(), amount: order.balance, kind: active.some((k) => k.code === firstKind) ? firstKind : (active[0]?.code ?? "other"), method: "transfer", reference: "", note: "", account_id: "" });
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start();
        }}
        className={cn("relative z-10 inline-flex items-center gap-1.5 rounded-full border border-charcoal-900/15 bg-white font-semibold text-charcoal-900 transition hover:bg-charcoal-900 hover:text-cream-50", compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-1.5 text-xs")}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Update
      </button>

      <AdminModal open={open} onClose={() => setOpen(false)} title={`Update ${order.order_number}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => quickUpdateOrder({ id: order.id, status, completed_at: status === "completed" ? completedAt : null, payment: withPay ? pay : null }), { onOk: () => setOpen(false) });
          }}
          className="grid gap-5"
        >
          <div className="rounded-xl bg-cream-100 p-3 text-sm">
            <p className="font-semibold">{order.customer_name}</p>
            <p className="text-charcoal-700">{order.title}</p>
            <p className="mt-1 text-xs text-charcoal-700">
              Total {formatRupiah(order.total)} · dibayar {formatRupiah(order.paid_amount)} · <strong className={order.balance > 0 ? "text-red-600" : "text-green-700"}>sisa {formatRupiah(order.balance)}</strong>
            </p>
          </div>

          <div>
            <span className="label">Proses / status order</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status order">
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={status === s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm ring-1 ring-inset transition",
                    status === s.value ? cn(s.tone, "font-semibold ring-2") : "bg-white text-charcoal-700 ring-charcoal-900/10 hover:bg-cream-50",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
                  {s.label}
                </button>
              ))}
            </div>
            {status === "completed" && (
              <div className="mt-3 max-w-xs">
                <Field label="Tanggal selesai" error={errors.completed_at}>
                  <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
                </Field>
                <p className="mt-1 text-xs text-charcoal-700/70">Invoice order Selesai otomatis memuat keterangan aktivasi garansi & ulasan Google.</p>
              </div>
            )}
          </div>

          {order.balance > 0 && (
            <div className="rounded-xl border border-charcoal-900/10 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={withPay} onChange={(e) => setWithPay(e.target.checked)} className="h-5 w-5 accent-wood-500" />
                <span className="text-sm font-semibold">Catat pembayaran baru</span>
              </label>
              {withPay && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Jenis pembayaran" required>
                    <select className="input" value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })}>
                      {active.map((k) => (
                        <option key={k.code} value={k.code}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Jumlah" required error={errors["payment.amount"]}>
                    <MoneyInput value={pay.amount} onChange={(n) => setPay({ ...pay, amount: n })} />
                  </Field>
                  <Field label="Tanggal bayar" required error={errors["payment.paid_at"]}>
                    <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={pay.paid_at} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} />
                  </Field>
                  <Field label="Metode">
                    <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {accounts.length > 0 && (
                    <Field label="Masuk ke akun kas" className="sm:col-span-2">
                      <select className="input" value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })}>
                        <option value="">Otomatis (sesuai metode bayar)</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="No. referensi / bukti" className="sm:col-span-2">
                    <input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
                  </Field>
                  {pay.amount > 0 && pay.amount < order.balance && <p className="text-xs text-charcoal-700 sm:col-span-2">Sisa setelah pembayaran ini: {formatRupiah(order.balance - pay.amount)}</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link href={`/admin/orders/${order.id}`} className="underline">
              Buka form lengkap
            </Link>
            <Link href={`/admin/invoice/${order.id}`} target="_blank" className="inline-flex items-center gap-1 underline">
              <FileText className="h-4 w-4" /> Invoice
            </Link>
          </div>
          <FormActions onCancel={() => setOpen(false)} pending={pending} label="Simpan update" />
        </form>
      </AdminModal>
    </>
  );
}

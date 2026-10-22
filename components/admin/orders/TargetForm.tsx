"use client";
import { Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveRevenueTarget } from "@/app/admin/orders-actions";
import { useToast } from "@/components/Toast";

/** Ubah target omset bulanan (khusus role admin). */
export function TargetForm({ value }: { value: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(value);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-wood-600 hover:underline">
        <Pencil className="h-3 w-3" /> {value ? "Ubah target" : "Atur target"}
      </button>
    );

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveRevenueTarget(amount);
          toast(res.ok ? (res.message ?? "Tersimpan") : res.error, res.ok ? "success" : "error");
          if (res.ok) {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-700/60">Rp</span>
        <input
          autoFocus
          aria-label="Target omset per bulan"
          inputMode="numeric"
          className="input !py-2 !pl-9 text-right tabular-nums"
          value={amount ? amount.toLocaleString("id-ID") : ""}
          placeholder="Target per bulan"
          onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "").slice(0, 13)) || 0)}
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary btn-sm !py-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-cream-100" aria-label="Batal">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

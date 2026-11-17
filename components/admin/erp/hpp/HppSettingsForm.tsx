"use client";
import { useState } from "react";
import { saveHppSettings } from "@/app/admin/erp/hpp-actions";
import { Field, SubmitButton, useAction } from "../kit";

export function HppSettingsForm({ initial }: { initial: { overheadPct: number; targetPct: number; maxPct: number } }) {
  const { run, pending, errors } = useAction();
  const [v, setV] = useState({ hpp_overhead_pct: String(initial.overheadPct), hpp_target_pct: String(initial.targetPct), hpp_max_pct: String(initial.maxPct) });
  const input = (k: keyof typeof v) => (
    <div className="relative">
      <input className="input !pr-8 text-right tabular-nums" inputMode="decimal" value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-700/60">%</span>
    </div>
  );
  return (
    <form
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHppSettings(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.replace(",", ".")]))));
      }}
    >
      <Field label="Overhead default" error={errors.hpp_overhead_pct} hint="Ditambahkan otomatis: % × (bahan baku + tenaga kerja). Bisa diubah per item.">
        {input("hpp_overhead_pct")}
      </Field>
      <Field label="Target HPP (sehat)" error={errors.hpp_target_pct} hint="HPP% di bawah angka ini berwarna hijau. Dipakai untuk saran harga jual.">
        {input("hpp_target_pct")}
      </Field>
      <Field label="Batas HPP (bahaya)" error={errors.hpp_max_pct} hint="Di atas angka ini berwarna merah; di antara target dan batas berwarna kuning.">
        {input("hpp_max_pct")}
      </Field>
      <div className="flex justify-end sm:col-span-3">
        <SubmitButton pending={pending}>Simpan pengaturan</SubmitButton>
      </div>
    </form>
  );
}

import { Lock } from "lucide-react";

/** Tampilan untuk akun editor yang membuka halaman khusus admin utama. */
export function OwnerOnly({ title }: { title: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center ring-1 ring-charcoal-900/5">
      <Lock className="mx-auto h-8 w-8 text-wood-600" />
      <h1 className="mt-3 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-charcoal-700">Halaman ini berisi data keuangan / gaji dan hanya bisa dibuka oleh akun admin utama.</p>
    </div>
  );
}

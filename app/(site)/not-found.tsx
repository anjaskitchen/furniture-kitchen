import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl font-bold">Halaman tidak ditemukan</h1>
      <p className="mt-3 text-charcoal-700 dark:text-cream-200/70">Halaman yang Anda cari mungkin sudah dipindahkan.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">Ke Beranda</Link>
        <Link href="/katalog" className="btn-outline">Lihat Katalog</Link>
      </div>
    </section>
  );
}

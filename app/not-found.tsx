import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl font-bold">Halaman tidak ditemukan</h1>
      <Link href="/" className="btn-primary mt-8">Ke Beranda</Link>
    </main>
  );
}

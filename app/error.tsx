"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold">Terjadi kesalahan</h1>
      <p className="mt-3 text-charcoal-700">Silakan coba lagi.</p>
      <button onClick={reset} className="btn-primary mt-8">Coba lagi</button>
    </main>
  );
}

/** Skeleton saat pindah halaman admin — tampil instan sementara data dimuat. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Memuat">
      <div className="h-8 w-48 rounded-lg bg-charcoal-900/10" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-charcoal-900/5" />
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="h-11 flex-1 rounded-xl bg-white" />
        <div className="h-11 w-40 rounded-full bg-charcoal-900/10" />
      </div>
      <div className="mt-6 space-y-3 rounded-2xl bg-white p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-11 w-14 shrink-0 rounded-md bg-cream-200" />
            <div className="h-4 flex-1 rounded bg-cream-200" />
            <div className="hidden h-4 w-24 rounded bg-cream-200 sm:block" />
            <div className="h-8 w-16 rounded-lg bg-cream-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

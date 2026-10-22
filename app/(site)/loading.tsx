import { SkeletonGrid } from "@/components/LoadingState";

/** Skeleton halaman publik (katalog/kontak yang dirender dinamis). */
export default function Loading() {
  return (
    <div className="container pb-16 pt-8 sm:pt-12" aria-busy="true" aria-label="Memuat">
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-cream-200 dark:bg-charcoal-800" />
        <div className="mt-4 h-10 w-2/3 max-w-lg rounded-lg bg-cream-200 dark:bg-charcoal-800" />
        <div className="mt-3 h-4 w-1/2 max-w-md rounded bg-cream-200 dark:bg-charcoal-800" />
      </div>
      <div className="mt-10">
        <SkeletonGrid count={6} />
      </div>
    </div>
  );
}

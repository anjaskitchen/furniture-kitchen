import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-charcoal-700 dark:text-cream-200" role="status">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-[4/3] bg-cream-200 dark:bg-charcoal-800" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-2/3 rounded bg-cream-200 dark:bg-charcoal-800" />
            <div className="h-3 w-1/2 rounded bg-cream-200 dark:bg-charcoal-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

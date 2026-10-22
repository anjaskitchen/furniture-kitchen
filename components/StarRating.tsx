import { Star } from "lucide-react";

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(value) ? "fill-bronze-400 text-bronze-400" : "fill-transparent text-charcoal-900/20 dark:text-white/20"}
        />
      ))}
    </div>
  );
}

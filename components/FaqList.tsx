import { Plus } from "lucide-react";
import type { Faq } from "@/types";

/** Accordion FAQ memakai <details> native: aksesibel, tanpa JavaScript. */
export function FaqList({ items }: { items: Pick<Faq, "id" | "question" | "answer">[] }) {
  return (
    <div className="divide-y divide-charcoal-900/10 border-y border-charcoal-900/10 dark:divide-white/10 dark:border-white/10">
      {items.map((f, i) => (
        <details key={f.id} className="group" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left font-display text-base font-semibold transition hover:text-wood-600 dark:hover:text-bronze-300 sm:text-lg [&::-webkit-details-marker]:hidden">
            {f.question}
            <Plus className="mt-1 h-5 w-5 shrink-0 text-wood-500 transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <div className="pb-6 pr-10 text-sm leading-relaxed text-charcoal-700 dark:text-cream-200/75 sm:text-base">
            {f.answer.split(/\n\n+/).map((p, j) => (
              <p key={j} className={j ? "mt-3" : undefined}>
                {p}
              </p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

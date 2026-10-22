import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal-900/15 px-6 py-16 text-center dark:border-white/15">
      <Inbox className="mb-4 h-10 w-10 text-wood-400" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-charcoal-700 dark:text-cream-200/70">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

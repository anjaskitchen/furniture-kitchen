import type { ReactNode } from "react";

export function AdminHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="mb-3 block h-1 w-10 rounded-full bg-gradient-to-r from-bronze-400 to-wood-500" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-charcoal-700">{description}</p>}
      </div>
      {action}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  action?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-4 sm:mb-14", align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between")}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <Tag className={Tag === "h1" ? "text-4xl font-bold sm:text-5xl" : "section-title"}>{title}</Tag>
        {description && <p className="mt-4 text-base leading-relaxed text-charcoal-700 dark:text-cream-200/80">{description}</p>}
      </div>
      {action}
    </div>
  );
}

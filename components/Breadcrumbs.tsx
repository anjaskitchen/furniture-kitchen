import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { JsonLd } from "./JsonLd";

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const all = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-charcoal-700 dark:text-cream-200/70">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
              {i === all.length - 1 ? (
                <span aria-current="page" className="font-medium text-charcoal-900 dark:text-cream-100">
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-wood-600">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: `${publicEnv.siteUrl}${item.href === "/" ? "" : item.href}`,
          })),
        }}
      />
    </>
  );
}

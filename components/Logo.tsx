import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo + tulisan 2 baris di sampingnya (diatur di Admin → Pengaturan Website).
 * `compactAtLg`: di layar lg (1024–1279px) tulisan disembunyikan agar menu navbar tidak sesak.
 */
export function Logo({
  name,
  logoUrl,
  light = false,
  title,
  subtitle,
  compactAtLg = false,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  light?: boolean;
  title?: string | null;
  subtitle?: string | null;
  compactAtLg?: boolean;
  /** lg: logo & tulisan lebih besar (footer). */
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  const [first, ...rest] = name.split(" ");
  const top = title?.trim();
  const bottom = subtitle?.trim();
  const hasText = Boolean(top || bottom);
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${name} — Beranda`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={140} height={40} className={cn("w-auto shrink-0 object-contain", lg ? "h-14" : "h-9 lg:h-10")} priority />
      ) : (
        <>
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-lg font-bold ${light ? "bg-cream-50 text-charcoal-900" : "bg-charcoal-900 text-cream-50 dark:bg-cream-100 dark:text-charcoal-900"}`}>
            {first.charAt(0)}
          </span>
          {!hasText && (
            <span className="font-display text-lg font-bold leading-none tracking-tight">
              {first}
              {rest.length > 0 && <span className="font-medium text-wood-500 dark:text-bronze-300"> {rest.join(" ")}</span>}
            </span>
          )}
        </>
      )}
      {hasText && (
        <span className={cn("flex min-w-0 flex-col justify-center border-l leading-none", lg ? "pl-3.5" : "pl-2.5", light ? "border-white/20" : "border-charcoal-900/15 dark:border-white/15", compactAtLg && "lg:hidden xl:flex")}>
          {top && (
            <span className={cn("truncate font-display font-bold tracking-tight", lg ? "text-xl" : "text-[15px] sm:text-base", light ? "text-white" : "text-charcoal-900 dark:text-cream-50")}>{top}</span>
          )}
          {bottom && (
            <span className={cn("truncate font-semibold uppercase", lg ? "mt-1.5 text-xs tracking-[0.35em]" : "mt-1 text-[10px] tracking-[0.28em] sm:text-[11px]", light ? "text-white/85" : "text-wood-500 dark:text-bronze-300")}>{bottom}</span>
          )}
        </span>
      )}
    </Link>
  );
}

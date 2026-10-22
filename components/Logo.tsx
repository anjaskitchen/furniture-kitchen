import Image from "next/image";
import Link from "next/link";

export function Logo({ name, logoUrl, light = false }: { name: string; logoUrl?: string | null; light?: boolean }) {
  const [first, ...rest] = name.split(" ");
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${name} — Beranda`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={140} height={40} className="h-9 w-auto object-contain" priority />
      ) : (
        <>
          <span className={`grid h-9 w-9 place-items-center rounded-lg font-display text-lg font-bold ${light ? "bg-cream-50 text-charcoal-900" : "bg-charcoal-900 text-cream-50 dark:bg-cream-100 dark:text-charcoal-900"}`}>
            {first.charAt(0)}
          </span>
          <span className="font-display text-lg font-bold leading-none tracking-tight">
            {first}
            {rest.length > 0 && <span className="font-medium text-wood-500 dark:text-bronze-300"> {rest.join(" ")}</span>}
          </span>
        </>
      )}
    </Link>
  );
}

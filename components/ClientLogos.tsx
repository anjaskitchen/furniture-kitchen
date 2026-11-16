import Image from "next/image";
import { cn, safeUrl } from "@/lib/utils";
import type { Client } from "@/types";

/** Inisial untuk klien yang belum punya logo (mis. "Pemerintah Provinsi Jawa Barat" → "PPJB"). */
function initials(name: string) {
  const SKIP = new Set(["dan", "dari", "untuk", "di", "ke", "the", "of", "and"]);
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()) && (w.length > 2 || /^[A-Z]{2,}$/.test(w)));
  return (words.length ? words : name.split(/\s+/))
    .slice(0, 4)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function LogoItem({ c }: { c: Client }) {
  const href = safeUrl(c.website_url);
  const body = c.logo_url ? (
    <span className="relative block h-14 w-36 sm:h-16 sm:w-40">
      <Image src={c.logo_url} alt={c.name} fill sizes="160px" unoptimized className="object-contain" />
    </span>
  ) : (
    <span className="flex h-14 w-44 items-center gap-2.5 sm:h-16 sm:w-52">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-charcoal-900 font-display text-xs font-bold tracking-wide text-cream-50 dark:bg-cream-100 dark:text-charcoal-900">
        {initials(c.name)}
      </span>
      <span className="line-clamp-2 text-left text-xs font-semibold leading-tight text-charcoal-800 dark:text-cream-100">{c.name}</span>
    </span>
  );
  const cls = "group flex shrink-0 items-center justify-center px-6 opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0 sm:px-8";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={c.name}>
      {body}
    </a>
  ) : (
    <span className={cls} title={c.name}>
      {body}
    </span>
  );
}

/**
 * Satu baris logo klien. Bila banyak, otomatis bergerak (marquee) dan berhenti saat disentuh/hover.
 * Pengguna yang mengaktifkan "kurangi animasi" mendapat baris yang bisa digeser manual.
 */
export function ClientLogos({ clients }: { clients: Client[] }) {
  if (!clients.length) return null;
  const moving = clients.length >= 5;
  if (!moving) {
    return (
      <div className="-mx-4 flex snap-x items-center overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:justify-center md:overflow-visible md:px-0">
        {clients.map((c) => (
          <LogoItem key={c.id} c={c} />
        ))}
      </div>
    );
  }
  const duration = Math.max(20, clients.length * 4);
  return (
    <div
      className="group/marquee relative overflow-hidden motion-reduce:overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
      aria-label="Logo klien"
    >
      <div
        className={cn("flex w-max animate-marquee items-center group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none")}
        style={{ animationDuration: `${duration}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
            {clients.map((c) => (
              <LogoItem key={`${copy}-${c.id}`} c={c} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

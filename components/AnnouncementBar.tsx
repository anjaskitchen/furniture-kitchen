import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { safeUrl } from "@/lib/utils";

/** Bar pengumuman di atas navbar — diatur di Admin → Pengaturan Website. */
export function AnnouncementBar({ text, url }: { text: string | null; url: string | null }) {
  if (!text) return null;
  const href = safeUrl(url);
  const content = (
    <>
      <span className="line-clamp-1">{text}</span>
      {href && <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  return (
    <div className="bg-charcoal-900 text-cream-50 dark:bg-wood-700">
      <div className="container flex min-h-9 items-center justify-center py-2 text-center text-xs font-medium sm:text-sm">
        {href ? (
          <Link href={href} className="group inline-flex items-center gap-2 hover:text-bronze-300">
            {content}
          </Link>
        ) : (
          <p className="inline-flex items-center gap-2">{content}</p>
        )}
      </div>
    </div>
  );
}

"use client";
import { CornerDownLeft, type LucideIcon, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  href: string;
  label: string;
  group: string;
  icon: LucideIcon;
  /** Kata kunci tambahan untuk pencarian (sinonim). */
  keywords?: string;
  external?: boolean;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Skor kecocokan sederhana: awalan > kata > mengandung > huruf berurutan. */
function score(item: CommandItem, q: string) {
  const label = norm(item.label);
  const hay = norm(`${item.label} ${item.group} ${item.keywords ?? ""}`);
  if (label.startsWith(q)) return 100;
  if (hay.split(/\s+/).some((w) => w.startsWith(q))) return 80;
  if (hay.includes(q)) return 60;
  let i = 0;
  for (const c of label) if (c === q[i]) i++;
  return i === q.length ? 30 : 0;
}

/** Pencarian cepat menu & aksi (Ctrl/⌘ + K). */
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: CommandItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const query = norm(q.trim());
    if (!query) return items;
    return items
      .map((it) => ({ it, s: score(it, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);
  }, [q, items]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const t = window.setTimeout(() => input.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const go = (it: CommandItem | undefined) => {
    if (!it) return;
    onClose();
    if (it.external) window.open(it.href, "_blank", "noopener");
    else router.push(it.href);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Kelompokkan sambil menjaga urutan hasil.
  const groups: { title: string; rows: { it: CommandItem; idx: number }[] }[] = [];
  results.forEach((it, idx) => {
    const title = q.trim() ? "Hasil" : it.group;
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, rows: [] }));
    g.rows.push({ it, idx });
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Cari menu admin">
      <div className="absolute inset-0 bg-charcoal-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(18,18,18,0.45)] ring-1 ring-charcoal-900/10 admin-pop">
        <div className="flex items-center gap-3 border-b border-charcoal-900/10 px-4">
          <Search className="h-5 w-5 shrink-0 text-charcoal-700/60" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Cari menu atau aksi… mis. order, stok, gaji, HPP"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-charcoal-700/50 focus:ring-0"
            aria-label="Cari menu"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded-md border border-charcoal-900/15 bg-cream-50 px-1.5 py-0.5 text-[11px] font-medium text-charcoal-700 sm:block">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[52vh] overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">
          {groups.map((g) => (
            <div key={g.title} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-700/50">{g.title}</p>
              {g.rows.map(({ it, idx }) => {
                const Icon = it.icon;
                const on = idx === active;
                return (
                  <button
                    key={`${it.group}-${it.href}-${it.label}`}
                    type="button"
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => go(it)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors", on ? "bg-charcoal-900 text-cream-50" : "text-charcoal-900")}
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? "bg-white/10 text-bronze-300" : "bg-cream-100 text-wood-600")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                    {q.trim() && <span className={cn("shrink-0 text-xs", on ? "text-cream-200/60" : "text-charcoal-700/50")}>{it.group}</span>}
                    {on && <CornerDownLeft className="h-4 w-4 shrink-0 text-cream-200/70" />}
                  </button>
                );
              })}
            </div>
          ))}
          {!results.length && <p className="px-3 py-10 text-center text-sm text-charcoal-700/70">Tidak ada menu yang cocok dengan “{q}”.</p>}
        </div>
        <div className="hidden items-center gap-4 border-t border-charcoal-900/10 bg-cream-50 px-4 py-2 text-[11px] text-charcoal-700/70 sm:flex">
          <span>
            <kbd className="rounded border border-charcoal-900/15 bg-white px-1">↑</kbd> <kbd className="rounded border border-charcoal-900/15 bg-white px-1">↓</kbd> pilih
          </span>
          <span>
            <kbd className="rounded border border-charcoal-900/15 bg-white px-1">Enter</kbd> buka
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-charcoal-900/15 bg-white px-1">Ctrl</kbd> + <kbd className="rounded border border-charcoal-900/15 bg-white px-1">K</kbd> kapan saja
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Modal aksesibel berbasis <dialog>. */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-0 mt-auto max-h-[92vh] w-full max-w-none overflow-hidden rounded-t-3xl bg-cream-50 p-0 text-charcoal-900 shadow-soft backdrop:bg-charcoal-950/60 backdrop:backdrop-blur-sm dark:bg-charcoal-900 dark:text-cream-100 sm:m-auto sm:rounded-3xl",
        size === "md" && "sm:max-w-lg",
        size === "lg" && "sm:max-w-2xl",
        size === "xl" && "sm:max-w-4xl",
      )}
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-center justify-between border-b border-charcoal-900/10 px-6 py-4 dark:border-white/10">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-charcoal-900/5 dark:hover:bg-white/10" aria-label="Tutup">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

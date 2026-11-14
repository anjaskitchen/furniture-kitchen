"use client";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);

  // Notifikasi ditaruh di "top layer" (popover) agar tetap terlihat di atas modal <dialog>.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (items.length) el.showPopover();
    } catch {
      // Browser lama: tetap tampil sebagai elemen fixed biasa.
    }
  }, [items]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        ref={box}
        popover="manual"
        className="pointer-events-none fixed inset-x-0 bottom-auto top-4 z-[100] m-0 flex h-auto w-full flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-4 py-0 [&:not(:popover-open)]:flex"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-soft",
              t.kind === "success" ? "bg-charcoal-900 text-cream-50" : "bg-red-600 text-white",
            )}
          >
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Tutup notifikasi">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

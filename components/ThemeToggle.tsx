"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Light (default) / Dark mode. Preferensi disimpan di localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? "rounded-full p-2 transition hover:bg-charcoal-900/5 dark:hover:bg-white/10"}
      aria-label={dark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

/** Script kecil di <head> agar tidak ada kedipan tema saat load. */
export const themeInitScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

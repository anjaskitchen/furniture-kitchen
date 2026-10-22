"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./Toast";

/** Tabel konten publik yang memicu refresh tampilan website secara realtime. */
const PUBLIC_TABLES = [
  "settings",
  "home_sections",
  "features",
  "faqs",
  "categories",
  "materials",
  "products",
  "portfolio",
  "videos",
  "reviews",
  "hpl_colors",
  "duco_colors",
  "hardware",
  "price_settings",
];

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Website ikut berubah saat admin menyimpan konten: perubahan tabel diterima via
 * Supabase Realtime lalu halaman di-refresh (data server terbaru, tanpa reload penuh).
 * Hanya tersambung saat tab terlihat agar hemat koneksi & baterai.
 */
export function SiteLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stale = useRef(false);

  useEffect(() => {
    if (!configured) return;
    const sb = createClient();
    let channel: ReturnType<typeof sb.channel> | null = null;

    // Jeda singkat: menunggu revalidasi cache halaman di server selesai & menggabungkan banyak perubahan.
    const schedule = () => {
      if (document.visibilityState !== "visible") {
        stale.current = true;
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 1500);
    };

    const connect = () => {
      if (channel) return;
      channel = sb.channel("site-content");
      for (const table of PUBLIC_TABLES) channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
      channel.subscribe();
    };
    const disconnect = () => {
      if (channel) sb.removeChannel(channel);
      channel = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        connect();
        if (stale.current) {
          stale.current = false;
          router.refresh();
        }
      } else {
        // Putuskan setelah 60 detik di background (mis. HP dikunci).
        setTimeout(() => document.visibilityState === "hidden" && disconnect(), 60_000);
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timer.current);
      disconnect();
    };
  }, [router]);

  return null;
}

const LEAD_TABLES: Record<string, string> = {
  survey_requests: "Request survey baru",
  contact_messages: "Pesan kontak baru",
  customer_submissions: "Customer submission baru",
};

/** Admin: notifikasi & refresh otomatis saat lead baru masuk (RLS: hanya admin/editor yang menerima). */
export function AdminLive() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!configured) return;
    const sb = createClient();
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      await sb.realtime.setAuth();
      if (cancelled) return;
      channel = sb.channel("admin-leads");
      for (const [table, label] of Object.entries(LEAD_TABLES)) {
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table }, (payload) => {
          const name = (payload.new as { name?: string }).name;
          toast(name ? `${label} dari ${name}` : label);
          router.refresh();
        });
      }
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [router, toast]);

  return null;
}

"use server";

import { z } from "zod";
import { check, run, zOptText, zText } from "@/lib/erp/server";
import { parseVideoUrl } from "@/lib/utils";

const PATHS = ["/", "/video", "/admin/videos"];

/** Ambil judul & channel video YouTube (oEmbed publik YouTube, tanpa API key). */
export async function fetchYoutubeInfo(url: string) {
  return run({ schema: z.string().trim().min(5).max(500), input: url }, async (_sb, u) => {
    const v = parseVideoUrl(u);
    if (!v || v.kind !== "youtube") throw new Error("Link YouTube tidak dikenali. Contoh: https://www.youtube.com/watch?v=xxxx atau https://youtu.be/xxxx");
    const canonical = `https://www.youtube.com/watch?v=${v.id}`;
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Video ini tidak mengizinkan disematkan di website lain" : "Video tidak ditemukan / privat");
      const j = (await res.json()) as { title?: string; author_name?: string };
      return { id: v.id, url: canonical, title: j.title ?? "", author: j.author_name ?? "", thumbnail: v.thumbnail };
    } catch (e) {
      if (e instanceof Error && /izinkan|ditemukan/.test(e.message)) throw e;
      // Koneksi ke YouTube gagal: tetap izinkan simpan, judul diisi manual.
      return { id: v.id, url: canonical, title: "", author: "", thumbnail: v.thumbnail };
    }
  });
}

const videoSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: zText("Judul", 1, 200),
  video_url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => parseVideoUrl(u)?.kind === "youtube", "Masukkan link YouTube yang valid"),
  category: zText("Kategori", 1, 60),
  description: zOptText(1000),
  is_published: z.boolean().default(true),
});

export async function saveYoutubeVideo(input: unknown) {
  return run({ schema: videoSchema, input, revalidate: PATHS, message: "Video disimpan" }, async (sb, { id, ...d }) => {
    const row = { ...d, source: "youtube", thumbnail_url: null };
    if (id) {
      check(await sb.from("videos").update(row).eq("id", id));
      return;
    }
    // Video baru tampil paling depan.
    const { data: first } = await sb.from("videos").select("sort_order").order("sort_order").limit(1).maybeSingle();
    check(await sb.from("videos").insert({ ...row, sort_order: Math.max(0, Number(first?.sort_order ?? 1) - 1) }));
  });
}

/** Pengaturan bagian video di beranda (judul, jumlah video, tampil/sembunyi). */
export async function saveHomeVideoSection(input: unknown) {
  const schema = z.object({
    eyebrow: zOptText(60),
    title: zOptText(120),
    item_limit: z.coerce.number().int().min(1, "Minimal 1").max(24, "Maksimal 24"),
    is_active: z.boolean(),
  });
  return run({ schema, input, revalidate: PATHS, message: "Tampilan video di beranda disimpan" }, async (sb, d) => {
    check(await sb.from("home_sections").update({ ...d, updated_at: new Date().toISOString() }).eq("key", "videos"));
  });
}

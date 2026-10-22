import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Upload file (sudah divalidasi) ke bucket "uploads" dengan nama acak. Mengembalikan public URL. */
export async function uploadPublicFiles(sb: SupabaseClient, folder: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${EXT[file.type] ?? "bin"}`;
    const { error } = await sb.storage.from("uploads").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Upload gagal: ${error.message}`);
    urls.push(sb.storage.from("uploads").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

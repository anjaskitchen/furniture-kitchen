import { AdminHeader } from "@/components/admin/AdminHeader";
import { VideoManager } from "@/components/admin/VideoManager";
import { createClient } from "@/lib/supabase/server";
import type { Video } from "@/types";

export const metadata = { title: "Video YouTube" };

export default async function VideosPage() {
  const sb = await createClient();
  const [{ data: videos }, { data: sec }] = await Promise.all([
    sb.from("videos").select("*").order("sort_order").order("created_at", { ascending: false }),
    sb.from("home_sections").select("eyebrow, title, item_limit, is_active").eq("key", "videos").maybeSingle(),
  ]);
  return (
    <>
      <AdminHeader title="Video YouTube" description="Atur video YouTube yang tampil di beranda dan halaman Video: tambah dari link, urutkan, sembunyikan, atau hapus." />
      <VideoManager
        videos={(videos ?? []) as Video[]}
        section={{
          eyebrow: (sec?.eyebrow as string | null) ?? "Video",
          title: (sec?.title as string | null) ?? "Lihat proses & hasil kerja",
          item_limit: Number(sec?.item_limit ?? 6),
          is_active: (sec?.is_active as boolean | undefined) ?? true,
        }}
      />
    </>
  );
}

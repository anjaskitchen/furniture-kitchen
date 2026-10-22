import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Video" };

export default async function Page() {
  const rows = await fetchResource("videos");
  return (
    <>
      <AdminHeader title="Video" description="Video dari upload, YouTube, Vimeo, atau customer." />
      <ResourceManager resource="videos" rows={rows} />
    </>
  );
}

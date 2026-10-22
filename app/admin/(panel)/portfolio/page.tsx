import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Portfolio" };

export default async function Page() {
  const rows = await fetchResource("portfolio");
  return (
    <>
      <AdminHeader title="Portfolio" description="Upload foto/video, tambah project, edit, hapus, publish/unpublish." />
      <ResourceManager resource="portfolio" rows={rows} />
    </>
  );
}

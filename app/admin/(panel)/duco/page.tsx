import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Warna Cat Duco" };

export default async function Page() {
  const rows = await fetchResource("duco_colors");
  return (
    <>
      <AdminHeader title="Warna Cat Duco" description="Katalog warna cat duco di halaman Bahan & Warna." />
      <ResourceManager resource="duco_colors" rows={rows} />
    </>
  );
}

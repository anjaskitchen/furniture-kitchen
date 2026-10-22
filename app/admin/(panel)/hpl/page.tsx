import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Warna HPL" };

export default async function Page() {
  const rows = await fetchResource("hpl_colors");
  return (
    <>
      <AdminHeader title="Warna HPL" description="Katalog warna HPL di halaman Bahan & Warna." />
      <ResourceManager resource="hpl_colors" rows={rows} />
    </>
  );
}

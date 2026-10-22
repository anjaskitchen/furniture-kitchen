import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Kategori" };

export default async function Page() {
  const rows = await fetchResource("categories");
  return (
    <>
      <AdminHeader title="Kategori" description="Kategori produk yang tampil di katalog dan homepage." />
      <ResourceManager resource="categories" rows={rows} />
    </>
  );
}

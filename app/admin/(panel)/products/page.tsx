import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchOptions, fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Produk" };

export default async function Page() {
  const [rows, categories, materials] = await Promise.all([fetchResource("products"), fetchOptions("categories"), fetchOptions("materials")]);
  const withNames = rows.map((r) => ({ ...r, category_name: categories.find((c) => c.value === r.category_id)?.label ?? "-" }));
  return (
    <>
      <AdminHeader title="Produk" description="CRUD katalog produk: nama, kategori, deskripsi, harga, material, dimensi, foto (multiple), video, status." />
      <ResourceManager resource="products" rows={withNames} options={{ categories, materials }} />
    </>
  );
}

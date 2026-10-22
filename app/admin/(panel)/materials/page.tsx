import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Material" };

export default async function Page() {
  const rows = await fetchResource("materials");
  return (
    <>
      <AdminHeader title="Material" description="Material dan harga per meter. Perubahan langsung dipakai kalkulator." />
      <ResourceManager resource="materials" rows={rows} />
    </>
  );
}

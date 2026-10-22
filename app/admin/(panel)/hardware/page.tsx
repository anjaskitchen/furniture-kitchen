import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Hardware" };

export default async function Page() {
  const rows = await fetchResource("hardware");
  return (
    <>
      <AdminHeader title="Hardware" description="Engsel, rel, dan aksesoris hardware." />
      <ResourceManager resource="hardware" rows={rows} />
    </>
  );
}

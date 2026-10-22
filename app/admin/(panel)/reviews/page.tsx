import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Review" };

export default async function Page() {
  const rows = await fetchResource("reviews");
  return (
    <>
      <AdminHeader title="Review" description="Review manual (fallback Google) dan testimoni customer." />
      <ResourceManager resource="reviews" rows={rows} />
    </>
  );
}

import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Logo Klien" };

export default async function ClientsPage() {
  const rows = await fetchResource("clients");
  return (
    <>
      <AdminHeader title="Logo Klien" description="Instansi pemerintah & perusahaan yang pernah memakai jasa kami — tampil di landing page setelah Portfolio." />
      <ResourceManager resource="clients" rows={rows} />
    </>
  );
}

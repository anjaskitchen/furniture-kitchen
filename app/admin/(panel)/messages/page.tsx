import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Kontak" };

export default async function Page() {
  const rows = await fetchResource("contact_messages");
  return (
    <>
      <AdminHeader title="Kontak" description="Pesan dari form email/kontak website." />
      <ResourceManager resource="contact_messages" rows={rows} />
    </>
  );
}

import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Request Survey" };

export default async function Page() {
  const rows = await fetchResource("survey_requests");
  return (
    <>
      <AdminHeader title="Request Survey" description="Request survey dari website. Ubah status setelah dihubungi." />
      <ResourceManager resource="survey_requests" rows={rows} />
    </>
  );
}

import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ProjectList } from "@/components/admin/erp/project/ProjectList";
import { getCurrentUser } from "@/lib/admin/auth";
import { listProjects } from "@/lib/erp/data";

export const metadata = { title: "Proyek" };

export default async function ProjectsPage() {
  const [rows, user] = await Promise.all([listProjects(), getCurrentUser()]);
  return (
    <>
      <AdminHeader
        title="Proyek & Produksi"
        description="Setiap order otomatis menjadi proyek. Pantau material, anggaran, jadwal, dan pekerja dari satu tempat."
        action={
          <Link href="/admin/orders/new" className="btn-primary !py-2.5">
            Order / proyek baru
          </Link>
        }
      />
      <ProjectList rows={rows} showMoney={user?.role === "admin"} />
    </>
  );
}

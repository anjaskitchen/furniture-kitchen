import { AdminHeader } from "@/components/admin/AdminHeader";
import { TabLinks } from "@/components/admin/erp/kit";
import { EmployeeManager } from "@/components/admin/erp/hr/EmployeeManager";
import { getCurrentUser } from "@/lib/admin/auth";
import { getPaySettingsMap, getPositions, listEmployees } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pegawai" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function EmployeesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "jabatan" ? "jabatan" : "pegawai";
  const sb = await createClient();
  const user = await getCurrentUser();
  const isOwner = user?.role === "admin";
  const [all, positions, pay] = await Promise.all([listEmployees(sb, { includeArchived: true }), getPositions(sb), isOwner ? getPaySettingsMap(sb) : Promise.resolve(new Map())]);
  return (
    <>
      <AdminHeader title="Pegawai" description="Data identitas, jabatan, dan administrasi pegawai Mandiri Furniture." />
      <TabLinks base="/admin/pegawai" active={tab} tabs={[{ key: "pegawai", label: "Pegawai", count: all.filter((e) => !e.deleted_at).length }, { key: "jabatan", label: "Jabatan", count: positions.length }]} />
      <EmployeeManager
        tab={tab}
        employees={all.filter((e) => !e.deleted_at)}
        archived={all.filter((e) => e.deleted_at)}
        positions={positions}
        pay={Object.fromEntries(pay)}
        isOwner={isOwner}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { EmployeeDetail } from "@/components/admin/erp/hr/EmployeeDetail";
import { getCurrentUser } from "@/lib/admin/auth";
import { getEmployeeDetail, getPositions } from "@/lib/erp/data";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Detail pegawai" };

export default async function EmployeePage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const user = await getCurrentUser();
  const isOwner = user?.role === "admin";
  const ownerTabs = ["gaji", "riwayat-gaji", "potongan"];
  let tab = ["profil", "absensi", ...ownerTabs].includes(String(sp.tab)) ? String(sp.tab) : "profil";
  if (ownerTabs.includes(tab) && !isOwner) tab = "profil";
  const [d, positions] = await Promise.all([getEmployeeDetail(id, isOwner), getPositions()]);
  if (!d) notFound();
  return <EmployeeDetail key={`${d.employee.photo_path}-${d.pay?.daily_wage}-${d.pay?.pay_type}`} tab={tab} isOwner={isOwner} positions={positions} {...d} />;
}

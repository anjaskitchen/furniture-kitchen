import { AdminHeader } from "@/components/admin/AdminHeader";
import { TabLinks } from "@/components/admin/erp/kit";
import { OwnerOnly } from "@/components/admin/erp/OwnerOnly";
import { DeductionsAndLoans, PayrollSlips } from "@/components/admin/erp/hr/PayrollManager";
import { getCurrentUser } from "@/lib/admin/auth";
import { cashAccountOptions, employeeOptions, getPaySettingsMap, listDeductions, listEmployees, listLoans, listPayroll } from "@/lib/erp/data";
import { jakartaToday } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Penggajian" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PayrollPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return <OwnerOnly title="Penggajian" />;
  const sp = await searchParams;
  const tab = sp.tab === "potongan" || sp.tab === "kasbon" ? sp.tab : "slip";
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : jakartaToday().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const sb = await createClient();
  const [slips, employees, pay, deductions, loans, empOpts, accounts] = await Promise.all([
    tab === "slip" ? listPayroll(start, end, sb) : Promise.resolve([]),
    tab === "slip" ? listEmployees(sb) : Promise.resolve([]),
    tab === "slip" ? getPaySettingsMap(sb) : Promise.resolve(new Map()),
    tab === "potongan" ? listDeductions(sb) : Promise.resolve([]),
    tab === "kasbon" ? listLoans(sb) : Promise.resolve([]),
    tab !== "slip" ? employeeOptions(sb) : Promise.resolve([]),
    tab === "kasbon" ? cashAccountOptions(sb) : Promise.resolve([]),
  ]);
  return (
    <>
      <AdminHeader title="Penggajian" description="Hitung gaji dari absensi, kelola potongan & kasbon, dan cetak slip gaji." />
      <TabLinks base="/admin/penggajian" active={tab} tabs={[{ key: "slip", label: "Slip gaji" }, { key: "potongan", label: "Potongan" }, { key: "kasbon", label: "Kasbon / pinjaman" }]} />
      {tab === "slip" ? (
        <PayrollSlips start={start} end={end} slips={slips} employees={employees.filter((e) => e.status === "active" || slips.some((s) => s.employee_id === e.id))} pay={Object.fromEntries(pay)} />
      ) : (
        <DeductionsAndLoans tab={tab} deductions={deductions} loans={loans} employees={empOpts} accounts={accounts} />
      )}
    </>
  );
}

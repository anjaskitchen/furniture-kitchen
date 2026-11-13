import { AdminHeader } from "@/components/admin/AdminHeader";
import { TabLinks } from "@/components/admin/erp/kit";
import { AttendanceDaily, AttendanceRecap } from "@/components/admin/erp/hr/AttendanceManager";
import { getCurrentUser } from "@/lib/admin/auth";
import { getAttendance, listEmployees, projectOptions } from "@/lib/erp/data";
import { jakartaToday } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Absensi" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AttendancePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "rekap" ? "rekap" : "harian";
  const today = jakartaToday();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const sb = await createClient();
  const user = await getCurrentUser();
  const [y, m] = month.split("-").map(Number);
  const monthEnd = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const [employees, records, projects] = await Promise.all([
    listEmployees(sb),
    tab === "harian" ? getAttendance(date, date, sb) : getAttendance(`${month}-01`, monthEnd, sb),
    tab === "harian" ? projectOptions(sb, { activeOnly: true }) : Promise.resolve([]),
  ]);
  // Harian: pegawai aktif + pegawai lain yang sudah punya absensi di tanggal itu.
  const ids = new Set(records.map((r) => r.employee_id));
  const list = employees.filter((e) => e.status === "active" || ids.has(e.id));
  return (
    <>
      <AdminHeader title="Absensi & Hari Kerja" description="Catat kehadiran harian dan proyek yang dikerjakan. Rekap bulanan otomatis menjadi dasar perhitungan gaji." />
      <TabLinks base="/admin/absensi" active={tab} tabs={[{ key: "harian", label: "Input harian" }, { key: "rekap", label: "Rekap bulanan" }]} />
      {tab === "harian" ? (
        <AttendanceDaily key={date + records.map((r) => r.updated_at).join()} date={date} employees={list} records={records} projects={projects} isOwner={user?.role === "admin"} />
      ) : (
        <AttendanceRecap month={month} employees={list} records={records} />
      )}
    </>
  );
}

"use client";
import { CheckCheck, ChevronLeft, ChevronRight, History, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAttendanceHistory, saveAttendance } from "@/app/admin/erp/hr-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/Toast";
import type { AttendanceRow } from "@/lib/erp/data";
import { ATTENDANCE_STATUSES, fmtQty, labelOf } from "@/lib/erp/constants";
import type { Employee, Option } from "@/lib/erp/types";
import { cn } from "@/lib/utils";
import { IconButton, useAction } from "../kit";

type Row = { employee_id: string; status: string; days_worked: string; check_in: string; check_out: string; project_id: string; notes: string; existing: AttendanceRow | null };

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const dayName = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function AttendanceDaily({ date, employees, records, projects, isOwner }: { date: string; employees: Employee[]; records: AttendanceRow[]; projects: Option[]; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useAction();
  const initial = (): Row[] =>
    employees.map((e) => {
      const r = records.find((x) => x.employee_id === e.id) ?? null;
      return {
        employee_id: e.id,
        status: r?.status ?? "",
        days_worked: r ? String(r.days_worked || 1) : "1",
        check_in: r?.check_in?.slice(0, 5) ?? "",
        check_out: r?.check_out?.slice(0, 5) ?? "",
        project_id: r?.project_id ?? "",
        notes: r?.notes ?? "",
        existing: r,
      };
    });
  const [rows, setRows] = useState<Row[]>(initial);
  const [hist, setHist] = useState<{ name: string; items: { action: string; at: string; by: string; before: { status?: string; days_worked?: number } | null; after: { status?: string; days_worked?: number } | null }[] } | null>(null);
  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.employee_id === id ? { ...r, ...patch } : r)));
  const counts = useMemo(() => Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s.value, rows.filter((r) => r.status === s.value).length])), [rows]);
  const totalDays = rows.filter((r) => r.status === "present").reduce((a, r) => a + (Number(r.days_worked.replace(",", ".")) || 0), 0);

  const save = () => {
    const filled = rows.filter((r) => r.status);
    const remove = rows.filter((r) => !r.status && r.existing).map((r) => r.employee_id);
    run(
      () =>
        saveAttendance({
          date,
          rows: filled.map((r) => ({ employee_id: r.employee_id, status: r.status, days_worked: r.status === "present" ? r.days_worked.replace(",", ".") || "1" : 0, check_in: r.check_in, check_out: r.check_out, project_id: r.project_id, notes: r.notes })),
          remove,
        }),
      { success: `Absensi ${filled.length} pegawai disimpan` },
    );
  };
  const showHistory = async (r: Row, name: string) => {
    if (!r.existing) return;
    const res = await getAttendanceHistory(r.existing.id);
    if (res.ok) setHist({ name, items: (res.data as NonNullable<typeof hist>["items"]) ?? [] });
    else toast(res.error, "error");
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconButton label="Hari sebelumnya" onClick={() => router.push(`/admin/absensi?date=${addDays(date, -1)}`)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <input type="date" min="1900-01-01" max="2100-12-31" className="input !w-auto !py-2" value={date} onChange={(e) => e.target.value && router.push(`/admin/absensi?date=${e.target.value}`)} />
          <IconButton label="Hari berikutnya" onClick={() => router.push(`/admin/absensi?date=${addDays(date, 1)}`)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          <span className="hidden text-sm font-medium sm:inline">{dayName(date)}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline btn-sm" onClick={() => setRows((rs) => rs.map((r) => (r.status ? r : { ...r, status: "present", days_worked: "1" })))}>
            <CheckCheck className="h-4 w-4" /> Isi sisanya hadir
          </button>
          <button className="btn-primary btn-sm" disabled={pending} onClick={save}>
            <Save className="h-4 w-4" /> Simpan absensi
          </button>
        </div>
      </div>
      <p className="mb-3 flex flex-wrap gap-3 text-xs text-charcoal-700">
        {ATTENDANCE_STATUSES.map((s) => (
          <span key={s.value}>
            {s.label}: <strong>{counts[s.value]}</strong>
          </span>
        ))}
        <span>
          Total hari kerja: <strong>{fmtQty(totalDays)}</strong>
        </span>
      </p>

      <div className="space-y-2">
        {employees.map((e) => {
          const r = rows.find((x) => x.employee_id === e.id)!;
          return (
            <div key={e.id} className={cn("grid items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/5 lg:grid-cols-12", !r.status && "opacity-80")}>
              <div className="lg:col-span-3">
                <p className="font-semibold leading-tight">{e.full_name}</p>
                <p className="text-xs text-charcoal-700/60">{e.position_name ?? e.employee_number}</p>
              </div>
              <div className="flex flex-wrap gap-1 lg:col-span-4">
                {ATTENDANCE_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set(e.id, { status: r.status === s.value ? "" : s.value })}
                    className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition", r.status === s.value ? s.tone : "bg-white text-charcoal-700 ring-charcoal-900/10 hover:bg-cream-50")}
                    title={s.label}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {r.status === "present" ? (
                <>
                  <select className="input !py-2 text-sm lg:col-span-1" value={r.days_worked} onChange={(ev) => set(e.id, { days_worked: ev.target.value })} aria-label="Hari kerja">
                    <option value="1">1 hari</option>
                    <option value="0.5">½ hari</option>
                    <option value="1.5">1½ (lembur)</option>
                  </select>
                  <select className="input !py-2 text-sm lg:col-span-3" value={r.project_id} onChange={(ev) => set(e.id, { project_id: ev.target.value })} aria-label="Proyek yang dikerjakan">
                    <option value="">— Pekerjaan umum / workshop —</option>
                    {projects.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <input className="input !py-2 text-sm lg:col-span-4" placeholder="Catatan (opsional)" value={r.notes} onChange={(ev) => set(e.id, { notes: ev.target.value })} />
              )}
              <div className="flex items-center justify-end gap-1 lg:col-span-1">
                {r.status === "present" && (
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 text-xs text-charcoal-700 hover:bg-cream-200">Jam</summary>
                    <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-2 rounded-xl bg-white p-3 shadow-soft ring-1 ring-charcoal-900/10">
                      <label className="text-xs">
                        Masuk <input type="time" className="input !py-1.5" value={r.check_in} onChange={(ev) => set(e.id, { check_in: ev.target.value })} />
                      </label>
                      <label className="text-xs">
                        Pulang <input type="time" className="input !py-1.5" value={r.check_out} onChange={(ev) => set(e.id, { check_out: ev.target.value })} />
                      </label>
                      <input className="input !py-1.5 text-xs" placeholder="Catatan" value={r.notes} onChange={(ev) => set(e.id, { notes: ev.target.value })} />
                    </div>
                  </details>
                )}
                {isOwner && r.existing && (
                  <IconButton label="Riwayat perubahan" onClick={() => showHistory(r, e.full_name)}>
                    <History className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            </div>
          );
        })}
        {!employees.length && <p className="rounded-2xl bg-white p-6 text-center text-sm text-charcoal-700/70 ring-1 ring-charcoal-900/5">Belum ada pegawai aktif.</p>}
      </div>
      <p className="mt-3 text-xs text-charcoal-700/70">Klik status lagi untuk mengosongkan. Pilih proyek agar hari kerja & upah terhitung ke biaya proyek. Setiap koreksi tercatat di riwayat perubahan.</p>

      <AdminModal open={hist !== null} onClose={() => setHist(null)} title={`Riwayat absensi — ${hist?.name ?? ""}`}>
        <ul className="divide-y divide-charcoal-900/5 text-sm">
          {hist?.items.map((h, i) => (
            <li key={i} className="py-2">
              <p className="font-medium">
                {h.action === "INSERT" ? "Dibuat" : h.action === "UPDATE" ? "Diubah" : "Dihapus"} oleh {h.by}
              </p>
              <p className="text-xs text-charcoal-700/70">
                {new Date(h.at).toLocaleString("id-ID")} · {h.before ? `${labelOf(ATTENDANCE_STATUSES, h.before.status)} (${h.before.days_worked})` : "-"} → {h.after ? `${labelOf(ATTENDANCE_STATUSES, h.after.status)} (${h.after.days_worked})` : "-"}
              </p>
            </li>
          ))}
        </ul>
      </AdminModal>
    </div>
  );
}

export function AttendanceRecap({ month, employees, records }: { month: string; employees: Employee[]; records: AttendanceRow[] }) {
  const router = useRouter();
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const by = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of records) map.set(`${r.employee_id}|${r.work_date}`, r);
    return map;
  }, [records]);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    router.push(`/admin/absensi?tab=rekap&month=${d.toISOString().slice(0, 7)}`);
  };
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Bulan sebelumnya" onClick={() => shift(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <input type="month" className="input !w-auto !py-2" value={month} onChange={(e) => e.target.value && router.push(`/admin/absensi?tab=rekap&month=${e.target.value}`)} />
        <IconButton label="Bulan berikutnya" onClick={() => shift(1)}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5">
        <table className="w-full text-xs">
          <thead className="bg-cream-50 text-charcoal-700">
            <tr>
              <th className="sticky left-0 z-10 bg-cream-50 px-3 py-2 text-left">Pegawai</th>
              {dates.map((d) => {
                const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
                return (
                  <th key={d} className={cn("w-7 px-0.5 py-2 text-center font-medium", wd === 0 && "text-red-500")}>
                    {Number(d.slice(8))}
                  </th>
                );
              })}
              {ATTENDANCE_STATUSES.map((s) => (
                <th key={s.value} className="px-1.5 py-2 text-center" title={s.label}>
                  {s.short}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Hari kerja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-900/5">
            {employees.map((e) => {
              const mine = records.filter((r) => r.employee_id === e.id);
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium">{e.full_name}</td>
                  {dates.map((d) => {
                    const r = by.get(`${e.id}|${d}`);
                    const s = ATTENDANCE_STATUSES.find((x) => x.value === r?.status);
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        {s ? (
                          <span className={cn("inline-grid h-6 w-6 place-items-center rounded ring-1 ring-inset", s.tone)} title={`${s.label}${r?.days_worked && r.days_worked !== 1 ? ` (${r.days_worked})` : ""}`}>
                            {r?.status === "present" && r.days_worked !== 1 ? fmtQty(r.days_worked) : s.short}
                          </span>
                        ) : (
                          <span className="text-charcoal-700/20">·</span>
                        )}
                      </td>
                    );
                  })}
                  {ATTENDANCE_STATUSES.map((s) => (
                    <td key={s.value} className="px-1.5 text-center tabular-nums">
                      {mine.filter((r) => r.status === s.value).length || ""}
                    </td>
                  ))}
                  <td className="px-2 text-right font-semibold tabular-nums">{fmtQty(mine.reduce((a, r) => a + r.days_worked, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-charcoal-700/70">H = hadir, I = izin, S = sakit, L = libur, A = tidak hadir. Angka di sel = hari kerja bila bukan 1 (½ hari / lembur).</p>
    </div>
  );
}

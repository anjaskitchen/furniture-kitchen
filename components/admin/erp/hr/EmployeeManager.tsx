"use client";
import { Archive, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteEmployee, deletePosition, restoreEmployee, saveEmployee, savePosition } from "@/app/admin/erp/hr-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/Toast";
import { EMPLOYEE_STATUSES, labelOf, PAY_TYPES } from "@/lib/erp/constants";
import type { Employee, PaySettings } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { Badge, DataTable, Field, FormActions, IconButton, SearchBox, StatusPill, useAction } from "../kit";

export type EmpForm = {
  id: string | null;
  full_name: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  address: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_phone: string;
  position_id: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
};
export const empForm = (e?: Employee): EmpForm => ({
  id: e?.id ?? null,
  full_name: e?.full_name ?? "",
  gender: e?.gender ?? "",
  birth_place: e?.birth_place ?? "",
  birth_date: e?.birth_date ?? "",
  address: e?.address ?? "",
  phone: e?.phone ?? "",
  emergency_contact_name: e?.emergency_contact_name ?? "",
  emergency_contact_relation: e?.emergency_contact_relation ?? "",
  emergency_contact_phone: e?.emergency_contact_phone ?? "",
  position_id: e?.position_id ?? "",
  start_date: e?.start_date ?? "",
  end_date: e?.end_date ?? "",
  status: e?.status ?? "active",
  notes: e?.notes ?? "",
});

type Position = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean; employees: number };

export function EmployeeFormModal({ value, onClose, positions, onSaved }: { value: EmpForm | null; onClose: () => void; positions: Position[]; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<EmpForm | null>(value);
  const { run, pending, errors } = useAction();
  if (!f) return null;
  const set = (k: keyof EmpForm, v: string) => setF({ ...f, [k]: v });
  return (
    <AdminModal open onClose={onClose} title={f.id ? "Edit data pegawai" : "Tambah pegawai"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveEmployee(f), {
            onOk: (r) => {
              onClose();
              if ("data" in r && r.data) onSaved?.(r.data as string);
            },
          });
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Nama lengkap" required error={errors.full_name} className="sm:col-span-2">
          <input className="input" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus />
        </Field>
        <Field label="Jenis kelamin">
          <select className="input" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">—</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </Field>
        <Field label="Jabatan" error={errors.position_id}>
          <select className="input" value={f.position_id} onChange={(e) => set("position_id", e.target.value)}>
            <option value="">— Pilih jabatan —</option>
            {positions
              .filter((p) => p.is_active || p.id === f.position_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Tempat lahir (opsional)">
          <input className="input" value={f.birth_place} onChange={(e) => set("birth_place", e.target.value)} />
        </Field>
        <Field label="Tanggal lahir (opsional)">
          <input type="date" className="input" value={f.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
        </Field>
        <Field label="Nomor HP pegawai" error={errors.phone}>
          <input className="input" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Status pegawai" required>
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alamat lengkap" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Nama kerabat / kontak darurat">
          <input className="input" value={f.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
        </Field>
        <Field label="Hubungan">
          <input className="input" value={f.emergency_contact_relation} onChange={(e) => set("emergency_contact_relation", e.target.value)} placeholder="Istri, orang tua, saudara…" />
        </Field>
        <Field label="Nomor HP kerabat" error={errors.emergency_contact_phone}>
          <input className="input" inputMode="tel" value={f.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
        </Field>
        <Field label="Tanggal mulai bekerja">
          <input type="date" className="input" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </Field>
        {f.status !== "active" && (
          <Field label="Tanggal berhenti">
            <input type="date" className="input" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </Field>
        )}
        <Field label="Catatan administrasi" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <p className="text-xs text-charcoal-700/70 sm:col-span-2">Foto, KTP, dan pengaturan gaji diatur di halaman detail pegawai (khusus admin utama).</p>
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </AdminModal>
  );
}

export function EmployeeManager({ employees, archived, positions, pay, isOwner, tab }: { employees: Employee[]; archived: Employee[]; positions: Position[]; pay: Record<string, PaySettings>; isOwner: boolean; tab: string }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [form, setForm] = useState<EmpForm | null>(null);
  const [pos, setPos] = useState<{ id: string | null; name: string; description: string; sort_order: number; is_active: boolean } | null>(null);
  const { run, pending, errors } = useAction();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const src = status === "archived" ? archived : employees;
    return src.filter((e) => (status === "archived" || !status || e.status === status) && (!s || [e.full_name, e.employee_number, e.position_name, e.phone, e.address].join(" ").toLowerCase().includes(s)));
  }, [employees, archived, q, status]);

  if (tab === "jabatan")
    return (
      <div>
        <div className="mb-4 flex justify-between gap-3">
          <p className="text-sm text-charcoal-700">Jabatan bisa ditambah, diubah, atau dinonaktifkan kapan saja.</p>
          <button className="btn-primary !py-2.5" onClick={() => setPos({ id: null, name: "", description: "", sort_order: positions.length + 1, is_active: true })}>
            <Plus className="h-4 w-4" /> Jabatan
          </button>
        </div>
        <DataTable
          rows={positions}
          columns={[
            { key: "name", label: "Jabatan", render: (p) => <span className="font-semibold">{p.name} {!p.is_active && <Badge>Nonaktif</Badge>}</span> },
            { key: "description", label: "Keterangan", render: (p) => p.description ?? "-" },
            { key: "employees", label: "Pegawai", align: "right" },
          ]}
          actions={(p) => (
            <>
              <IconButton label="Edit" onClick={() => setPos({ id: p.id, name: p.name, description: p.description ?? "", sort_order: p.sort_order, is_active: p.is_active })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Hapus" danger onClick={() => run(() => deletePosition(p.id), { confirm: `Hapus jabatan ${p.name}?` })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )}
        />
        <AdminModal open={pos !== null} onClose={() => setPos(null)} title={pos?.id ? "Edit jabatan" : "Tambah jabatan"}>
          {pos && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => savePosition(pos), { onOk: () => setPos(null) });
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="Nama jabatan" required error={errors.name}>
                <input className="input" value={pos.name} onChange={(e) => setPos({ ...pos, name: e.target.value })} />
              </Field>
              <Field label="Urutan">
                <input type="number" className="input" value={pos.sort_order} onChange={(e) => setPos({ ...pos, sort_order: Number(e.target.value) })} />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <input className="input" value={pos.description} onChange={(e) => setPos({ ...pos, description: e.target.value })} />
              </Field>
              <label className="flex items-center gap-3 rounded-xl border border-charcoal-900/10 px-4 py-3 sm:col-span-2">
                <input type="checkbox" checked={pos.is_active} onChange={(e) => setPos({ ...pos, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
                <span className="text-sm font-medium">Aktif</span>
              </label>
              <FormActions onCancel={() => setPos(null)} pending={pending} />
            </form>
          )}
        </AdminModal>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama, nomor pegawai, jabatan, HP..." />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
          {[...EMPLOYEE_STATUSES, { value: "", label: "Semua" }, { value: "archived", label: "Arsip" }].map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm", status === s.value ? "bg-charcoal-900 font-semibold text-cream-50" : "bg-white ring-1 ring-charcoal-900/10")}>
              {s.label}
            </button>
          ))}
        </div>
        <button className="btn-primary !py-2.5" onClick={() => setForm(empForm())}>
          <Plus className="h-4 w-4" /> Tambah pegawai
        </button>
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">{list.length} pegawai</p>
      <DataTable
        rows={list}
        onRowClick={(e) => router.push(`/admin/pegawai/${e.id}`)}
        empty="Belum ada pegawai."
        columns={[
          { key: "full_name", label: "Pegawai", render: (e) => <span><span className="font-semibold">{e.full_name}</span><span className="block text-xs text-charcoal-700/60">{e.employee_number}</span></span> },
          { key: "position_name", label: "Jabatan", render: (e) => e.position_name ?? "-" },
          { key: "phone", label: "HP", render: (e) => e.phone ?? "-" },
          { key: "start_date", label: "Mulai kerja", render: (e) => (e.start_date ? formatDateShort(e.start_date) : "-"), hideMobile: true },
          ...(isOwner
            ? [
                {
                  key: "pay",
                  label: "Sistem gaji",
                  render: (e: Employee) => {
                    const p = pay[e.id];
                    if (!p) return <span className="text-xs text-amber-700">Belum diatur</span>;
                    return (
                      <span className="text-xs">
                        {labelOf(PAY_TYPES, p.pay_type)}
                        <span className="block text-charcoal-700/70">{p.pay_type === "daily" ? `${formatRupiah(p.daily_wage)}/hari` : p.pay_type === "monthly" ? `${formatRupiah(p.monthly_salary)}/bln` : "borongan"}</span>
                      </span>
                    );
                  },
                },
              ]
            : []),
          { key: "status", label: "Status", render: (e) => <StatusPill list={EMPLOYEE_STATUSES} value={e.status} /> },
        ]}
        actions={(e) =>
          status === "archived" ? (
            <IconButton label="Aktifkan kembali" onClick={() => run(() => restoreEmployee(e.id))}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          ) : (
            <>
              <IconButton label="Edit" onClick={() => setForm(empForm(e))}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Hapus / nonaktifkan"
                danger
                onClick={() =>
                  run(() => deleteEmployee(e.id), {
                    confirm: `Hapus ${e.full_name}? Pegawai yang sudah punya absensi/gaji/kasbon tidak dihapus permanen — hanya dinonaktifkan & diarsipkan agar riwayat aman.`,
                    onOk: (r) => toast("data" in r && r.data === "archived" ? "Pegawai dinonaktifkan & diarsipkan" : "Pegawai dihapus"),
                    success: "Selesai",
                  })
                }
              >
                <Archive className="h-4 w-4" />
              </IconButton>
            </>
          )
        }
      />
      {form && <EmployeeFormModal value={form} onClose={() => setForm(null)} positions={positions} onSaved={(id) => !form.id && router.push(`/admin/pegawai/${id}`)} />}
    </div>
  );
}

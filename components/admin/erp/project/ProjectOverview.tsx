"use client";
import { ArrowLeft, CalendarClock, Calculator, ExternalLink, FileText, MapPin, MessageCircle, Pencil, Phone, Ruler, UserCog } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { saveProjectInfo } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { StatusBadge } from "@/components/admin/orders/ui";
import type { Template } from "@/lib/erp/data";
import { FORMULA_VARS, PROJECT_TEXT_SPECS, SCHEDULE_STATUSES } from "@/lib/erp/constants";
import type { Option, ProjectRow } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { Field, FormActions, ProgressBar, Stat, StatusPill, useAction } from "../kit";
import { Indicator } from "./ProjectList";

export type InfoForm = {
  id: string;
  work_type: string;
  template_id: string;
  manager_id: string;
  start_date: string;
  target_end_date: string;
  actual_end_date: string;
  estimated_days: string;
  specs: Record<string, string>;
  notes: string;
};

export const infoFromProject = (p: ProjectRow): InfoForm => ({
  id: p.id,
  work_type: p.work_type ?? "",
  template_id: p.template_id ?? "",
  manager_id: p.manager_id ?? "",
  start_date: p.start_date ?? "",
  target_end_date: p.target_end_date ?? "",
  actual_end_date: p.actual_end_date ?? "",
  estimated_days: p.estimated_days === null ? "" : String(p.estimated_days),
  specs: Object.fromEntries(Object.entries(p.specs ?? {}).map(([k, v]) => [k, String(v)])),
  notes: p.notes ?? "",
});

/** Input ukuran proyek (variabel formula + teks material/finishing/aksesoris). */
export function SpecFields({ specs, onChange }: { specs: Record<string, string>; onChange: (s: Record<string, string>) => void }) {
  return (
    <>
      {FORMULA_VARS.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`ps-${f.key}`}>
          <input id={`ps-${f.key}`} className="input" type="number" min={0} step={f.step} inputMode="decimal" value={specs[f.key] ?? ""} onChange={(e) => onChange({ ...specs, [f.key]: e.target.value })} />
        </Field>
      ))}
      {PROJECT_TEXT_SPECS.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`ps-${f.key}`}>
          <input id={`ps-${f.key}`} className="input" value={specs[f.key] ?? ""} onChange={(e) => onChange({ ...specs, [f.key]: e.target.value })} />
        </Field>
      ))}
    </>
  );
}

export function ProjectHeader({ p, onEdit, showHpp = false }: { p: ProjectRow; onEdit: () => void; showHpp?: boolean }) {
  const phone = (p.customer_phone ?? "").replace(/\D/g, "").replace(/^0/, "62");
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Link href="/admin/proyek" className="mb-2 inline-flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-charcoal-900">
          <ArrowLeft className="h-4 w-4" /> Semua proyek
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Indicator value={p.indicator} />
          <h1 className="text-2xl font-bold sm:text-3xl">{p.title}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-charcoal-700">
          <span className="font-medium">{p.order_number}</span>
          <StatusBadge status={p.order_status} />
          <StatusPill list={SCHEDULE_STATUSES} value={p.schedule_status} />
          {p.work_type && <span>· {p.work_type}</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {phone.length >= 9 && (
          <a href={whatsappLink(phone, `Halo ${p.customer_name}, kami dari Mandiri Furniture ingin menginformasikan progres proyek ${p.title}.`)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm bg-white !py-2.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        <Link href={`/admin/orders/${p.order_id}`} className="btn-outline btn-sm bg-white !py-2.5">
          <ExternalLink className="h-4 w-4" /> Data order
        </Link>
        {showHpp && (
          <Link href={`/admin/hpp/${p.order_id}`} className="btn-outline btn-sm bg-white !py-2.5">
            <Calculator className="h-4 w-4" /> HPP per item
          </Link>
        )}
        <Link href={`/admin/invoice/${p.order_id}`} target="_blank" className="btn-outline btn-sm bg-white !py-2.5">
          <FileText className="h-4 w-4" /> Invoice
        </Link>
        <button onClick={onEdit} className="btn-primary btn-sm !py-2.5">
          <Pencil className="h-4 w-4" /> Atur proyek
        </button>
      </div>
    </div>
  );
}

export function ProjectOverview({ p, showMoney, onEdit }: { p: ProjectRow; showMoney: boolean; onEdit: () => void }) {
  const dims = FORMULA_VARS.filter((f) => p.specs?.[f.key] !== undefined && p.specs[f.key] !== "");
  const texts = PROJECT_TEXT_SPECS.filter((f) => p.specs?.[f.key]);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 rounded-2xl bg-white p-5 text-sm ring-1 ring-charcoal-900/5 lg:col-span-1">
        <h2 className="font-display text-base font-semibold">Konsumen</h2>
        <p className="text-base font-semibold">{p.customer_name}</p>
        {p.customer_phone && (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-wood-600" /> {p.customer_phone}
          </p>
        )}
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-wood-600" /> {p.customer_address ?? "Alamat proyek belum diisi di order"}
        </p>
        <p className="text-xs text-charcoal-700/70">Data konsumen diambil langsung dari menu Order — ubah di sana bila perlu.</p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 text-sm ring-1 ring-charcoal-900/5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-wood-600" /> Jadwal
        </h2>
        <dl className="grid grid-cols-2 gap-2">
          <dt className="text-charcoal-700/70">Tanggal order</dt>
          <dd>{formatDateShort(p.order_date)}</dd>
          <dt className="text-charcoal-700/70">Mulai kerja</dt>
          <dd>{p.start_date ? formatDateShort(p.start_date) : "-"}</dd>
          <dt className="text-charcoal-700/70">Target selesai</dt>
          <dd className={cn(p.schedule_status === "late" && "font-semibold text-red-600")}>{p.target_end_date ? formatDateShort(p.target_end_date) : "-"}</dd>
          <dt className="text-charcoal-700/70">Selesai aktual</dt>
          <dd>{p.actual_end_date ? formatDateShort(p.actual_end_date) : "-"}</dd>
          <dt className="text-charcoal-700/70">Durasi rencana / aktual</dt>
          <dd>
            {p.planned_days ?? p.estimated_days ?? "-"} / {p.actual_days ?? "-"} hari
          </dd>
          <dt className="text-charcoal-700/70">Penanggung jawab</dt>
          <dd className="flex items-center gap-1">
            <UserCog className="h-3.5 w-3.5" /> {p.manager_name ?? "-"}
          </dd>
        </dl>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Progres {Math.round(p.progress)}%</span>
            {p.is_active && p.expected_progress > 0 && <span className="text-charcoal-700/60">seharusnya {Math.round(p.expected_progress)}%</span>}
          </div>
          <ProgressBar value={p.progress} tone={p.indicator === "red" ? "bg-red-500" : p.indicator === "yellow" ? "bg-amber-400" : "bg-[#4B5138]"} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 text-sm ring-1 ring-charcoal-900/5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Ruler className="h-4 w-4 text-wood-600" /> Ukuran & spesifikasi
        </h2>
        {dims.length || texts.length ? (
          <dl className="grid grid-cols-2 gap-2">
            {dims.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-charcoal-700/70">{f.label}</dt>
                <dd className="tabular-nums">{String(p.specs[f.key])}</dd>
              </div>
            ))}
            {texts.map((f) => (
              <div key={f.key} className="contents">
                <dt className="text-charcoal-700/70">{f.label}</dt>
                <dd>{String(p.specs[f.key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-charcoal-700/70">
            Belum diisi. Klik{" "}
            <button onClick={onEdit} className="font-semibold underline">
              Atur proyek
            </button>{" "}
            untuk memasukkan panjang, tinggi, jumlah kabinet, laci, dan pintu — dipakai untuk menghitung kebutuhan material otomatis.
          </p>
        )}
        {p.notes && <p className="whitespace-pre-wrap border-t border-charcoal-900/5 pt-2 text-charcoal-700">{p.notes}</p>}
      </section>

      {showMoney && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 lg:col-span-3">
          <h2 className="mb-3 font-display text-base font-semibold">Ringkasan keuangan proyek</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Nilai kontrak" value={formatRupiah(p.contract_value)} />
            <Stat label="Sudah dibayar konsumen" value={formatRupiah(p.paid_amount)} sub={p.balance > 0 ? `Piutang ${formatRupiah(p.balance)}` : "Lunas"} tone={p.balance > 0 ? "warn" : "good"} />
            <Stat label="Anggaran biaya" value={formatRupiah(p.budget_cost_total)} sub={p.has_budget ? undefined : "belum disusun"} />
            <Stat label="Realisasi biaya" value={formatRupiah(p.actual_total_cost)} tone={p.budget_status === "over" ? "bad" : p.budget_status === "near" ? "warn" : undefined} />
            <Stat label="Estimasi laba" value={formatRupiah(p.estimated_profit)} />
            <Stat label="Laba aktual (sementara)" value={formatRupiah(p.actual_profit)} tone={p.actual_profit < 0 ? "bad" : "good"} sub="kontrak − biaya yang sudah keluar" />
          </div>
        </section>
      )}
    </div>
  );
}

export function ProjectInfoModal({
  open,
  onClose,
  initial,
  templates,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  initial: InfoForm;
  templates: Template[];
  employees: Option[];
}) {
  const [f, setF] = useState<InfoForm>(initial);
  const { run, pending, errors } = useAction();
  return (
    <AdminModal open={open} onClose={onClose} title="Atur proyek">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveProjectInfo(f), { onOk: onClose });
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Jenis pekerjaan" error={errors.work_type}>
          <input className="input" list="work-types" value={f.work_type} onChange={(e) => setF({ ...f, work_type: e.target.value })} />
          <datalist id="work-types">
            {[...new Set(templates.map((t) => t.work_type).filter(Boolean))].map((w) => (
              <option key={w!} value={w!} />
            ))}
          </datalist>
        </Field>
        <Field label="Penanggung jawab proyek">
          <select className="input" value={f.manager_id} onChange={(e) => setF({ ...f, manager_id: e.target.value })}>
            <option value="">— Belum ditentukan —</option>
            {employees.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label} {e.sub ? `(${e.sub})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal mulai pengerjaan" error={errors.start_date}>
          <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        </Field>
        <Field label="Target selesai" error={errors.target_end_date}>
          <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={f.target_end_date} onChange={(e) => setF({ ...f, target_end_date: e.target.value })} />
        </Field>
        <Field label="Estimasi durasi (hari)" hint="Kosongkan untuk dihitung dari tanggal mulai & target.">
          <input type="number" min={0} className="input" value={f.estimated_days} onChange={(e) => setF({ ...f, estimated_days: e.target.value })} />
        </Field>
        <Field label="Tanggal selesai aktual" hint="Otomatis terisi saat status order Selesai.">
          <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={f.actual_end_date} onChange={(e) => setF({ ...f, actual_end_date: e.target.value })} />
        </Field>
        <div className="rounded-2xl bg-cream-100 p-4 sm:col-span-2">
          <p className="mb-3 text-sm font-semibold">Ukuran proyek (untuk perhitungan material)</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SpecFields specs={f.specs} onChange={(specs) => setF({ ...f, specs })} />
          </div>
        </div>
        <Field label="Catatan proyek" className="sm:col-span-2">
          <textarea className="input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <FormActions onCancel={onClose} pending={pending} />
      </form>
    </AdminModal>
  );
}

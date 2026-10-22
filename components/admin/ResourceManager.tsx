"use client";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteRecord, reorderRecords, saveRecord, toggleRecord } from "@/app/admin/actions";
import { RESOURCES, type FieldDef } from "@/lib/admin/resources";
import { cn } from "@/lib/utils";
import { useToast } from "../Toast";
import { AdminModal } from "./AdminModal";
import { AdminTable } from "./AdminTable";
import { ImageUploader } from "./ImageUploader";

type Row = Record<string, unknown> & { id: string };
type Options = Record<string, { value: string; label: string }[]>;

function initialValues(fields: FieldDef[], row?: Row | null) {
  const v: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = row ? row[f.name] : f.default;
    if (f.type === "images" || f.type === "tags") v[f.name] = Array.isArray(raw) ? raw : [];
    else if (f.type === "boolean") v[f.name] = raw === undefined ? Boolean(f.default) : Boolean(raw);
    else if (f.type === "height_meta") v[f.name] = (raw as { standard_height?: number } | null)?.standard_height ?? "";
    else v[f.name] = raw === null || raw === undefined ? (f.default ?? "") : raw;
  }
  return v;
}

function Field({ f, value, onChange, error, options }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void; error?: string; options: Options }) {
  const id = `f-${f.name}`;
  const label = (
    <label htmlFor={id} className="label">
      {f.label} {f.required && <span className="text-red-500">*</span>}
    </label>
  );
  let input: React.ReactNode;
  switch (f.type) {
    case "textarea":
      input = <textarea id={id} rows={4} className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
    case "money":
    case "height_meta":
      input = (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="input"
          min={f.min ?? 0}
          max={f.max}
          step={f.step ?? (f.type === "money" ? 1000 : 1)}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "boolean":
      return (
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-wood-500" />
          <span className="text-sm font-medium">{f.label}</span>
        </label>
      );
    case "select": {
      const list = f.options ?? options[f.optionsKey ?? ""] ?? [];
      input = (
        <select id={id} className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {!f.required || !value ? <option value="">— Pilih —</option> : null}
          {list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "images":
      input = <ImageUploader multiple folder={f.folder} value={(value as string[]) ?? []} onChange={onChange} />;
      break;
    case "image":
      input = <ImageUploader folder={f.folder} value={value ? [String(value)] : []} onChange={(u) => onChange(u[0] ?? "")} />;
      break;
    case "video":
      input = <ImageUploader accept="video" folder={f.folder} value={value ? [String(value)] : []} onChange={(u) => onChange(u[0] ?? "")} />;
      break;
    case "tags":
      input = (
        <input
          id={id}
          className="input"
          defaultValue={((value as string[]) ?? []).join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="Putih, Oak, Walnut"
        />
      );
      break;
    case "color":
      input = (
        <div className="flex gap-2">
          <input type="color" aria-label={f.label} value={String(value || "#ffffff")} onChange={(e) => onChange(e.target.value)} className="h-12 w-14 cursor-pointer rounded-lg border border-charcoal-900/15" />
          <input id={id} className="input font-mono" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    case "date":
      input = <input id={id} type="date" className="input" value={String(value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      input = <input id={id} className="input" value={String(value ?? "")} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={cn(f.full && "sm:col-span-2")}>
      {label}
      {input}
      {f.help && <p className="mt-1 text-xs text-charcoal-700/70">{f.help}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const LABELS: Record<string, string> = {
  created_at: "Masuk",
  name: "Nama",
  phone: "WhatsApp",
  email: "Email",
  address: "Alamat",
  furniture_type: "Jenis furniture",
  approx_size: "Ukuran perkiraan",
  size: "Ukuran",
  material: "Material",
  estimate_total: "Estimasi",
  estimate_detail: "Detail kalkulator",
  message: "Pesan",
  reference_images: "Gambar referensi",
  channel: "Channel",
  product_id: "Produk",
};

/** Detail read-only untuk lead (survey / pesan kontak). */
function RecordDetails({ row, skip, resource }: { row: Row; skip: string[]; resource: string }) {
  const entries = Object.entries(row).filter(([k, v]) => k !== "id" && !skip.includes(k) && v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  const phone = typeof row.phone === "string" ? row.phone.replace(/\D/g, "").replace(/^0/, "62") : "";
  return (
    <div className="mb-6 rounded-2xl bg-cream-100 p-5">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className={cn(["message", "estimate_detail", "reference_images", "address", "notes"].includes(k) && "sm:col-span-2")}>
            <dt className="text-xs text-charcoal-700/70">{LABELS[k] ?? k}</dt>
            <dd className="whitespace-pre-wrap break-words font-medium">
              {k === "reference_images" && Array.isArray(v) ? (
                <span className="mt-1 flex flex-wrap gap-2">
                  {(v as string[]).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-wood-600 underline">
                      Lihat gambar
                    </a>
                  ))}
                </span>
              ) : k === "estimate_total" ? (
                `Rp ${Number(v).toLocaleString("id-ID")}`
              ) : k === "created_at" ? (
                new Date(String(v)).toLocaleString("id-ID")
              ) : typeof v === "object" ? (
                <code className="text-xs">{JSON.stringify(v, null, 1)}</code>
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {(resource === "survey_requests" || resource === "contact_messages") && (
          <a href={`/admin/orders/new?${resource === "survey_requests" ? "survey" : "message"}=${row.id}`} className="btn-primary btn-sm">
            Buat order dari lead ini
          </a>
        )}
        {phone && (
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm">
            Balas via WhatsApp
          </a>
        )}
        {typeof row.email === "string" && row.email && (
          <a href={`mailto:${row.email}`} className="btn-outline btn-sm">
            Balas via Email
          </a>
        )}
      </div>
    </div>
  );
}

export function ResourceManager({ resource, rows, options = {}, defaultFilter }: { resource: string; rows: Row[]; options?: Options; defaultFilter?: string }) {
  const def = RESOURCES[resource];
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(defaultFilter ?? "");
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();

  const filtered = useMemo(() => {
    let list = rows;
    if (filter && def.filter) list = list.filter((r) => r[def.filter!.name] === filter);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((r) => def.searchable.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
    }
    return list;
  }, [rows, q, filter, def]);

  const open = (row: Row | "new") => {
    setErrors({});
    const base = initialValues(def.fields, row === "new" ? null : row);
    // Saat menambah dengan filter aktif (mis. grup "Finishing"), isi field filter otomatis.
    if (row === "new" && filter && def.filter) base[def.filter.name] = filter;
    setValues(base);
    setEditing(row);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const id = editing && editing !== "new" ? editing.id : null;
      const res = await saveRecord(resource, id, values);
      if (res.ok) {
        toast(res.message ?? "Tersimpan");
        setEditing(null);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast(res.error, "error");
      }
    });
  };

  const remove = async (row: Row) => {
    const name = String(row.name ?? row.title ?? row.author_name ?? "data ini");
    if (!confirm(`Hapus "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await deleteRecord(resource, row.id);
    toast(res.ok ? (res.message ?? "Dihapus") : res.error, res.ok ? "success" : "error");
    if (res.ok) router.refresh();
  };

  // Urutan dihitung dalam grup filter yang sama (mis. per bagian) agar panah terasa intuitif.
  const move = async (row: Row, dir: -1 | 1) => {
    const group = def.filter ? rows.filter((r) => r[def.filter!.name] === row[def.filter!.name]) : rows;
    const ordered = [...group].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const i = ordered.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const res = await reorderRecords(resource, ordered.map((r) => r.id));
    if (res.ok) router.refresh();
    else toast(res.error, "error");
  };

  const toggle = async (row: Row) => {
    if (!def.toggle) return;
    const res = await toggleRecord(resource, row.id, !row[def.toggle.name]);
    toast(res.ok ? (res.message ?? "Diperbarui") : res.error, res.ok ? "success" : "error");
    if (res.ok) router.refresh();
  };

  return (
    <div>
      {def.description && <p className="mb-5 max-w-3xl text-sm text-charcoal-700">{def.description}</p>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Cari</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari ${def.title.toLowerCase()}...`} className="input !py-2.5 !pl-9" />
        </label>
        {def.filter && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input !py-2.5 sm:w-52" aria-label={def.filter.label}>
            <option value="">Semua {def.filter.label.toLowerCase()}</option>
            {def.filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {def.canCreate !== false && (
          <button onClick={() => open("new")} className="btn-primary !py-2.5">
            <Plus className="h-4 w-4" /> Tambah {def.singular}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">{filtered.length} data</p>

      <AdminTable
        columns={def.columns}
        rows={filtered}
        onEdit={(r) => open(r)}
        onDelete={def.canDelete === false ? undefined : remove}
        extra={
          def.toggle || def.reorderable
            ? (row) => (
                <>
                  {def.reorderable && (
                    <span className="mr-1 flex">
                      <button onClick={() => move(row, -1)} className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" aria-label="Naikkan urutan" title="Naikkan">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button onClick={() => move(row, 1)} className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" aria-label="Turunkan urutan" title="Turunkan">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                  {def.toggle && (
                <button
                  onClick={() => toggle(row)}
                  className={cn("flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium", row[def.toggle!.name] ? "text-green-700 hover:bg-green-50" : "text-charcoal-700/60 hover:bg-cream-200")}
                  title={row[def.toggle!.name] ? `Klik untuk ${def.toggle!.off.toLowerCase()}` : `Klik untuk ${def.toggle!.on.toLowerCase()}`}
                >
                  {row[def.toggle!.name] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span className="hidden sm:inline">{row[def.toggle!.name] ? def.toggle!.on : def.toggle!.off}</span>
                </button>
                  )}
                </>
              )
            : undefined
        }
      />

      <AdminModal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? `Tambah ${def.singular}` : `Edit ${def.singular}`}>
        {def.canCreate === false && editing && editing !== "new" && <RecordDetails row={editing} skip={def.fields.map((f) => f.name)} resource={resource} />}
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {def.fields.map((f) => (
            <Field key={f.name} f={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} error={errors[f.name]} options={options} />
          ))}
          <div className="flex justify-end gap-2 border-t border-charcoal-900/10 pt-4 sm:col-span-2">
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

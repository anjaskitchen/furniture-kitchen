"use client";
import { Check, Loader2, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSubmission, setSubmissionStatus, updateSubmission } from "@/app/admin/actions";
import { formatDateID } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerSubmission, SubmissionStatus } from "@/types";
import { EmptyState } from "../EmptyState";
import { useToast } from "../Toast";
import { AdminModal } from "./AdminModal";

const STATUS: { value: SubmissionStatus; label: string; cls: string }[] = [
  { value: "pending", label: "Pending", cls: "bg-amber-100 text-amber-800" },
  { value: "approved", label: "Approved", cls: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Rejected", cls: "bg-red-100 text-red-700" },
];

export function SubmissionManager({ rows }: { rows: CustomerSubmission[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<SubmissionStatus>("pending");
  const [editing, setEditing] = useState<CustomerSubmission | null>(null);
  const [pending, start] = useTransition();
  const list = rows.filter((r) => r.status === tab);

  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.ok ? (res.message ?? "Berhasil") : (res.error ?? "Gagal"), res.ok ? "success" : "error");
      if (res.ok) {
        setEditing(null);
        router.refresh();
      }
    });

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {STATUS.map((s) => (
          <button key={s.value} onClick={() => setTab(s.value)} className={cn("chip", tab === s.value && "chip-active")}>
            {s.label} ({rows.filter((r) => r.status === s.value).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title={`Tidak ada submission ${tab}`} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((s) => (
            <article key={s.id} className="card overflow-hidden">
              <div className="grid grid-cols-3 gap-1">
                {s.images.slice(0, 3).map((src) => (
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-cream-200">
                    <Image src={src} alt="" fill sizes="200px" unoptimized className="object-cover" />
                  </a>
                ))}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold">{s.project_title || "Tanpa judul"}</h3>
                    <p className="text-xs text-charcoal-700">
                      {s.name} · {s.location ?? "-"} · {formatDateID(s.created_at)}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS.find((x) => x.value === s.status)?.cls)}>{s.status}</span>
                </div>
                <p className="mt-2 text-bronze-500">{"★".repeat(s.rating)}</p>
                <p className="mt-2 line-clamp-4 text-sm text-charcoal-700">{s.testimonial}</p>
                {s.description && <p className="mt-2 line-clamp-2 text-xs text-charcoal-700/80">{s.description}</p>}
                <p className="mt-2 text-xs text-charcoal-700/70">{[s.email, s.phone].filter(Boolean).join(" · ")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.status !== "approved" && (
                    <button disabled={pending} onClick={() => act(() => setSubmissionStatus(s.id, "approved"))} className="btn btn-sm bg-green-600 text-white hover:bg-green-700">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {s.status !== "rejected" && (
                    <button disabled={pending} onClick={() => act(() => setSubmissionStatus(s.id, "rejected"))} className="btn btn-sm bg-red-600 text-white hover:bg-red-700">
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                  {s.status !== "pending" && (
                    <button disabled={pending} onClick={() => act(() => setSubmissionStatus(s.id, "pending"))} className="btn-outline btn-sm">
                      <RotateCcw className="h-3.5 w-3.5" /> Pending
                    </button>
                  )}
                  <button onClick={() => setEditing(s)} className="btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => confirm("Hapus submission ini?") && act(() => deleteSubmission(s.id))}
                    className="btn btn-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AdminModal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit submission">
        {editing && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = (k: string) => (String(fd.get(k) ?? "").trim() || null);
              act(() =>
                updateSubmission(editing.id, {
                  name: String(fd.get("name") ?? ""),
                  project_title: val("project_title"),
                  location: val("location"),
                  description: val("description"),
                  testimonial: val("testimonial"),
                  rating: Number(fd.get("rating")),
                  admin_note: val("admin_note"),
                  images: editing.images.filter((u) => fd.get(`img:${u}`) === "on"),
                }),
              );
            }}
          >
            <div>
              <label className="label" htmlFor="e-name">Nama</label>
              <input id="e-name" name="name" defaultValue={editing.name} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="e-title">Nama project</label>
              <input id="e-title" name="project_title" defaultValue={editing.project_title ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="e-loc">Lokasi</label>
              <input id="e-loc" name="location" defaultValue={editing.location ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="e-rating">Rating</label>
              <select id="e-rating" name="rating" defaultValue={editing.rating} className="input">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-desc">Deskripsi</label>
              <textarea id="e-desc" name="description" defaultValue={editing.description ?? ""} rows={2} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-testi">Testimoni</label>
              <textarea id="e-testi" name="testimonial" defaultValue={editing.testimonial ?? ""} rows={4} className="input" />
            </div>
            <div className="sm:col-span-2">
              <span className="label">Foto yang ditampilkan</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {editing.images.map((u) => (
                  <label key={u} className="relative aspect-square cursor-pointer overflow-hidden rounded-lg">
                    <Image src={u} alt="" fill sizes="120px" unoptimized className="object-cover" />
                    <input type="checkbox" name={`img:${u}`} defaultChecked className="absolute left-2 top-2 h-5 w-5 accent-wood-500" />
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-note">Catatan admin (internal)</label>
              <textarea id="e-note" name="admin_note" defaultValue={editing.admin_note ?? ""} rows={2} className="input" />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-outline">Batal</button>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </button>
            </div>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">Jika submission sudah approved, klik Approve lagi setelah edit agar perubahan tampil di website.</p>
          </form>
        )}
      </AdminModal>
    </div>
  );
}

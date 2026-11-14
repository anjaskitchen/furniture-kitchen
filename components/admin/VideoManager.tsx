"use client";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Home, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { deleteRecord, reorderRecords, toggleRecord } from "@/app/admin/actions";
import { fetchYoutubeInfo, saveHomeVideoSection, saveYoutubeVideo } from "@/app/admin/erp/video-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { Badge, Field, FormActions, IconButton, useAction } from "@/components/admin/erp/kit";
import { useToast } from "@/components/Toast";
import { cn, parseVideoUrl } from "@/lib/utils";
import type { Video } from "@/types";

type Form = { id: string | null; video_url: string; title: string; category: string; description: string; is_published: boolean };
type Section = { eyebrow: string; title: string; item_limit: number; is_active: boolean };

const CATEGORIES = ["Proses", "Project", "Inspirasi", "Tips", "Testimoni"];

export function VideoManager({ videos, section }: { videos: Video[]; section: Section }) {
  const toast = useToast();
  const { run, pending, errors } = useAction();
  const sec = useAction();
  const [f, setF] = useState<Form | null>(null);
  const [s, setS] = useState(section);
  const [loading, setLoading] = useState(false);
  const [author, setAuthor] = useState("");

  const sorted = [...videos].sort((a, b) => a.sort_order - b.sort_order);
  const shownOnHome = new Set(sorted.filter((v) => v.is_published).slice(0, s.item_limit).map((v) => v.id));
  const yt = f ? parseVideoUrl(f.video_url) : null;
  const validYt = yt?.kind === "youtube" ? yt : null;

  const lookup = async (url: string) => {
    if (parseVideoUrl(url)?.kind !== "youtube") return;
    setLoading(true);
    const r = await fetchYoutubeInfo(url);
    setLoading(false);
    if (!r.ok) return toast(r.error, "error");
    const d = r.data as { url: string; title: string; author: string };
    setAuthor(d.author);
    setF((cur) => (cur ? { ...cur, video_url: d.url, title: cur.title || d.title } : cur));
  };

  const move = (v: Video, dir: -1 | 1) => {
    const i = sorted.findIndex((x) => x.id === v.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const ids = sorted.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => reorderRecords("videos", ids), { success: "Urutan diperbarui" });
  };

  return (
    <div className="space-y-6">
      {/* Pengaturan tampilan di beranda */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Home className="h-5 w-5 text-wood-600" />
          <h2 className="font-display text-lg font-semibold">Tampilan di beranda</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sec.run(() => saveHomeVideoSection(s));
          }}
          className="grid gap-4 sm:grid-cols-[1fr_2fr_160px_auto] sm:items-end"
        >
          <Field label="Label kecil" error={sec.errors.eyebrow}>
            <input className="input" value={s.eyebrow} onChange={(e) => setS({ ...s, eyebrow: e.target.value })} placeholder="Video" />
          </Field>
          <Field label="Judul bagian" error={sec.errors.title}>
            <input className="input" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Lihat proses & hasil kerja" />
          </Field>
          <Field label="Jumlah video" error={sec.errors.item_limit}>
            <input type="number" min={1} max={24} className="input" value={s.item_limit} onChange={(e) => setS({ ...s, item_limit: Number(e.target.value) })} />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={s.is_active} onChange={(e) => setS({ ...s, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" /> Tampilkan
            </label>
            <button className="btn-primary btn-sm !py-2.5" disabled={sec.pending}>
              {sec.pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-charcoal-700/70">
          Beranda menampilkan {s.item_limit} video teratas yang dipublikasikan (bisa digeser seperti slider). Semua video yang dipublikasikan tampil di halaman{" "}
          <a href="/video" target="_blank" className="underline">
            /video
          </a>
          .
        </p>
      </section>

      {/* Daftar video */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-charcoal-700">
            {videos.length} video · {videos.filter((v) => v.is_published).length} dipublikasikan. Urutan teratas tampil lebih dulu.
          </p>
          <button
            className="btn-primary !py-2.5"
            onClick={() => {
              setAuthor("");
              setF({ id: null, video_url: "", title: "", category: "Project", description: "", is_published: true });
            }}
          >
            <Plus className="h-4 w-4" /> Tambah video YouTube
          </button>
        </div>

        <ul className="space-y-3">
          {sorted.map((v, i) => {
            const pv = parseVideoUrl(v.video_url);
            const thumb = v.thumbnail_url || (pv && pv.kind !== "file" ? pv.thumbnail : null);
            const isYt = pv?.kind === "youtube";
            return (
              <li key={v.id} className={cn("flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-charcoal-900/5 sm:flex-row sm:items-center", !v.is_published && "opacity-60")}>
                <div className="flex items-center gap-3 sm:w-auto">
                  <span className="w-6 text-center font-display text-lg font-bold text-charcoal-700/40">{i + 1}</span>
                  <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video w-40 shrink-0 overflow-hidden rounded-xl bg-charcoal-900">
                    {thumb && <Image src={thumb} alt="" fill sizes="160px" unoptimized className="object-cover" />}
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-8 w-11 place-items-center rounded-lg bg-red-600 text-white shadow">
                        <Play className="h-4 w-4 fill-white" />
                      </span>
                    </span>
                  </a>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{v.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge>{v.category}</Badge>
                    {shownOnHome.has(v.id) && <Badge tone="bg-[#4B5138]/10 text-[#4B5138] ring-[#4B5138]/25">Tampil di beranda</Badge>}
                    {!v.is_published && <Badge>Disembunyikan</Badge>}
                    {!isYt && <Badge>{v.source}</Badge>}
                  </div>
                  {v.description && <p className="mt-1 line-clamp-1 text-xs text-charcoal-700/70">{v.description}</p>}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <IconButton label="Naikkan" onClick={() => move(v, -1)} disabled={i === 0 || pending}>
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Turunkan" onClick={() => move(v, 1)} disabled={i === sorted.length - 1 || pending}>
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={v.is_published ? "Sembunyikan" : "Publikasikan"} onClick={() => run(() => toggleRecord("videos", v.id, !v.is_published))}>
                    {v.is_published ? <Eye className="h-4 w-4 text-green-700" /> : <EyeOff className="h-4 w-4" />}
                  </IconButton>
                  <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" title="Buka di YouTube" aria-label="Buka di YouTube">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {isYt && (
                    <IconButton
                      label="Edit"
                      onClick={() => {
                        setAuthor("");
                        setF({ id: v.id, video_url: v.video_url, title: v.title, category: v.category, description: v.description ?? "", is_published: v.is_published });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                  )}
                  <IconButton label="Hapus" danger onClick={() => run(() => deleteRecord("videos", v.id), { confirm: `Hapus video "${v.title}" dari website?` })}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
          {!videos.length && <li className="rounded-2xl border border-dashed border-charcoal-900/15 p-10 text-center text-sm text-charcoal-700/70">Belum ada video. Klik “Tambah video YouTube”.</li>}
        </ul>
      </section>

      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit video YouTube" : "Tambah video YouTube"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveYoutubeVideo(f), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Link YouTube" required error={errors.video_url} className="sm:col-span-2" hint="Tempel link dari tombol Bagikan di YouTube — video biasa maupun Shorts. Judul diambil otomatis.">
              <div className="flex gap-2">
                <input
                  className="input"
                  inputMode="url"
                  value={f.video_url}
                  onChange={(e) => setF({ ...f, video_url: e.target.value })}
                  onBlur={() => !f.title && lookup(f.video_url)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (parseVideoUrl(text)?.kind === "youtube") setTimeout(() => lookup(text), 0);
                  }}
                  placeholder="https://www.youtube.com/watch?v=… atau https://youtu.be/…"
                  autoFocus
                />
                <button type="button" className="btn-outline btn-sm shrink-0" disabled={!validYt || loading} onClick={() => lookup(f.video_url)}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ambil judul"}
                </button>
              </div>
            </Field>
            {validYt && (
              <div className="sm:col-span-2">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-charcoal-900">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${validYt.id}?rel=0`}
                    title="Pratinjau video"
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {author && <p className="mt-1 text-xs text-charcoal-700/70">Channel: {author}</p>}
              </div>
            )}
            {f.video_url && !validYt && <p className="text-sm text-red-600 sm:col-span-2">Link belum dikenali sebagai video YouTube.</p>}
            <Field label="Judul di website" required error={errors.title} className="sm:col-span-2">
              <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="cth. Proses Pembuatan Kitchen Set HPL" />
            </Field>
            <Field label="Kategori" required error={errors.category}>
              <input className="input" list="video-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
              <datalist id="video-cats">
                {[...new Set([...CATEGORIES, ...videos.map((v) => v.category)])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Tampilkan di website</span>
            </label>
            <Field label="Deskripsi singkat (opsional)" className="sm:col-span-2">
              <textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}

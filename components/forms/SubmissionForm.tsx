"use client";
import { ImagePlus, Loader2, Send, Star, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "../Toast";
import { FieldError, FormSuccess } from "./FormSuccess";

/** Customer Project: foto, nama, deskripsi, rating, testimoni → status pending (moderasi admin). */
export function SubmissionForm() {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ demo: boolean } | null>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) toast(`${f.name}: gunakan JPG, PNG, atau WebP`, "error");
      else if (f.size > 5 * 1024 * 1024) toast(`${f.name} melebihi 5 MB`, "error");
      else if (next.length < 5) next.push(f);
    }
    setFiles(next);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files.length) {
      toast("Tambahkan minimal 1 foto project", "error");
      return;
    }
    setLoading(true);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    fd.set("rating", String(rating));
    try {
      const res = await fetch("/api/submissions", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) setErrors(json.fieldErrors);
        toast(json.error ?? "Gagal mengirim", "error");
        return;
      }
      setDone({ demo: Boolean(json.demo) });
    } catch {
      toast("Koneksi bermasalah, coba lagi.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <FormSuccess title="Terima kasih!" message="Foto dan testimoni Anda sudah kami terima dan akan tampil di website setelah diverifikasi admin." demo={done.demo} />;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="sm:col-span-2">
        <span className="label">Foto project * (maks. 5 foto, 5 MB/foto)</span>
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-charcoal-900/15 px-4 py-10 text-center text-sm transition hover:border-wood-500 dark:border-white/15"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.files);
          }}
        >
          <ImagePlus className="h-8 w-8 text-wood-500" />
          <span className="font-medium">Klik atau tarik foto ke sini</span>
          <span className="text-xs text-charcoal-700/70">JPG, PNG, WebP</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {previews.map((src, i) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
                <Image src={src} alt="" fill unoptimized className="object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Hapus foto">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="sub-name">Nama *</label>
        <input id="sub-name" name="name" required className="input" />
        <FieldError message={errors.name} />
      </div>
      <div>
        <label className="label" htmlFor="sub-email">Email</label>
        <input id="sub-email" name="email" type="email" className="input" />
        <FieldError message={errors.email} />
      </div>
      <div>
        <label className="label" htmlFor="sub-title">Nama project</label>
        <input id="sub-title" name="project_title" className="input" placeholder="cth. Kitchen set rumah baru" />
      </div>
      <div>
        <label className="label" htmlFor="sub-loc">Lokasi</label>
        <input id="sub-loc" name="location" className="input" placeholder="cth. Antapani, Bandung" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="sub-desc">Deskripsi</label>
        <textarea id="sub-desc" name="description" rows={2} className="input" />
      </div>
      <div className="sm:col-span-2">
        <span className="label">Rating *</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} aria-label={`${i} bintang`} className="p-1">
              <Star className={cn("h-8 w-8 transition", i <= rating ? "fill-bronze-400 text-bronze-400" : "text-charcoal-900/20")} />
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="sub-testi">Testimoni *</label>
        <textarea id="sub-testi" name="testimonial" required rows={4} className="input" placeholder="Ceritakan pengalaman Anda..." />
        <FieldError message={errors.testimonial} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim untuk Diverifikasi
      </button>
    </form>
  );
}

"use client";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { formatRupiah } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { useToast } from "../Toast";
import { FieldError, FormSuccess } from "./FormSuccess";

export interface ContactDefaults {
  furniture_type?: string;
  size?: string;
  material?: string;
  estimate_total?: number;
  message?: string;
  product_id?: string;
  estimate_detail?: unknown;
}

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;

/** Form email: Nama, WA, Email, Jenis furniture, Ukuran, Material, Estimasi, Pesan, Upload referensi. */
export function ContactForm({ defaults = {}, whatsapp, furnitureTypes }: { defaults?: ContactDefaults; whatsapp: string | null; furnitureTypes: string[] }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ demo: boolean; name: string } | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast(`${f.name}: format harus JPG, PNG, atau WebP`, "error");
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast(`${f.name} melebihi 5 MB`, "error");
        continue;
      }
      if (next.length < MAX_FILES) next.push(f);
    }
    setFiles(next);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    if (defaults.estimate_detail) fd.set("estimate_detail", JSON.stringify(defaults.estimate_detail));
    try {
      const res = await fetch("/api/contact", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) setErrors(json.fieldErrors);
        toast(json.error ?? "Gagal mengirim pesan", "error");
        return;
      }
      trackEvent("email_click", { location: "contact_form" });
      setDone({ demo: Boolean(json.demo), name: String(fd.get("name") ?? "") });
    } catch {
      toast("Koneksi bermasalah, coba lagi.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <FormSuccess
        title="Pesan terkirim!"
        message={`Terima kasih ${done.name}. Tim kami akan menghubungi Anda melalui email atau WhatsApp segera.`}
        demo={done.demo}
        whatsappHref={whatsappLink(whatsapp, `Halo, saya ${done.name}. Saya baru saja mengirim pesan via email di website.`)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {defaults.product_id && <input type="hidden" name="product_id" value={defaults.product_id} />}
      <div>
        <label className="label" htmlFor="c-name">Nama *</label>
        <input id="c-name" name="name" required minLength={2} className="input" autoComplete="name" />
        <FieldError message={errors.name} />
      </div>
      <div>
        <label className="label" htmlFor="c-phone">Nomor WhatsApp *</label>
        <input id="c-phone" name="phone" required inputMode="tel" className="input" autoComplete="tel" placeholder="08xx" />
        <FieldError message={errors.phone} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="c-email">Email *</label>
        <input id="c-email" name="email" type="email" required className="input" autoComplete="email" />
        <FieldError message={errors.email} />
      </div>
      <div>
        <label className="label" htmlFor="c-type">Jenis furniture</label>
        <select id="c-type" name="furniture_type" className="input" defaultValue={defaults.furniture_type ?? ""}>
          <option value="">Pilih...</option>
          {[...new Set([...(defaults.furniture_type ? [defaults.furniture_type] : []), ...furnitureTypes])].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="c-size">Ukuran</label>
        <input id="c-size" name="size" className="input" defaultValue={defaults.size} placeholder="cth. 3 m x 2.4 m" />
      </div>
      <div>
        <label className="label" htmlFor="c-material">Material</label>
        <input id="c-material" name="material" className="input" defaultValue={defaults.material} placeholder="HPL / Cat Duco" />
      </div>
      <div>
        <label className="label" htmlFor="c-est">Estimasi harga</label>
        <input id="c-est-display" className="input" readOnly value={defaults.estimate_total ? formatRupiah(defaults.estimate_total) : "-"} aria-label="Estimasi harga" />
        {defaults.estimate_total ? <input type="hidden" name="estimate_total" value={defaults.estimate_total} /> : null}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="c-msg">Pesan</label>
        <textarea id="c-msg" name="message" rows={4} className="input" defaultValue={defaults.message} placeholder="Ceritakan kebutuhan Anda..." />
      </div>
      <div className="sm:col-span-2">
        <span className="label">Gambar referensi (maks. 5 foto, 5 MB/foto)</span>
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-charcoal-900/15 px-4 py-6 text-center text-sm transition hover:border-wood-500 dark:border-white/15"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <ImagePlus className="h-6 w-6 text-wood-500" />
          <span>Klik atau tarik foto ke sini</span>
          <input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1 text-xs dark:bg-charcoal-800">
                {f.name.slice(0, 24)}
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Hapus ${f.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim via Email
      </button>
    </form>
  );
}

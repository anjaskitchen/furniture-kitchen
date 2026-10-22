"use client";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettings } from "@/app/admin/actions";
import type { SiteSettings } from "@/types";
import { useToast } from "../Toast";
import { ImageUploader } from "./ImageUploader";

type Key = keyof SiteSettings;
type FieldSpec = { key: Key; label: string; type?: "text" | "textarea" | "image" | "video" | "number"; help?: string; full?: boolean };

const SECTIONS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "Identitas Bisnis",
    fields: [
      { key: "business_name", label: "Nama bisnis" },
      { key: "tagline", label: "Tagline" },
      { key: "description", label: "Deskripsi bisnis (SEO)", type: "textarea", full: true },
      { key: "logo_url", label: "Logo", type: "image", full: true },
    ],
  },
  {
    title: "Kontak & Lokasi",
    fields: [
      { key: "whatsapp_number", label: "Nomor WhatsApp", help: "Format internasional, cth. 6281234567890" },
      { key: "email", label: "Email publik" },
      { key: "notification_email", label: "Email tujuan notifikasi (inquiry/survey)" },
      { key: "opening_hours", label: "Jam kerja" },
      { key: "address", label: "Alamat", type: "textarea", full: true },
      { key: "city", label: "Kota (untuk SEO lokal)" },
      { key: "google_maps_url", label: "Link Google Maps" },
      { key: "google_maps_embed_query", label: "Query peta embed", help: "Nama bisnis + kota, atau koordinat 'lat,lng'" },
      { key: "google_place_id", label: "Google Place ID (untuk review live)", help: "Lihat README: Cara mengatur Google Review" },
    ],
  },
  {
    title: "Social Media",
    fields: [
      { key: "instagram_url", label: "Instagram URL" },
      { key: "facebook_url", label: "Facebook URL" },
      { key: "tiktok_url", label: "TikTok URL" },
      { key: "youtube_url", label: "YouTube URL" },
    ],
  },
  {
    title: "Hero & CTA",
    fields: [
      { key: "hero_title", label: "Hero headline (baris ke-2 setelah Enter)", type: "textarea", full: true },
      { key: "hero_subtitle", label: "Hero subheadline", type: "textarea", full: true },
      { key: "hero_image_url", label: "Hero image", type: "image", full: true },
      { key: "hero_video_url", label: "Hero video (opsional, file MP4)", type: "video", full: true },
      { key: "cta_primary_label", label: "Label CTA utama" },
      { key: "cta_secondary_label", label: "Label CTA kedua" },
      { key: "hero_card_text", label: "Kartu hero — teks kecil", help: "Kartu kecil di pojok gambar hero. Kosongkan judul untuk menyembunyikan." },
      { key: "hero_card_title", label: "Kartu hero — judul" },
      { key: "whatsapp_default_message", label: "Pesan WhatsApp default", type: "textarea", full: true },
    ],
  },
  {
    title: "Pengumuman & Ajakan Konsultasi",
    fields: [
      { key: "announcement_text", label: "Teks pengumuman (bar di atas navbar)", full: true, help: "Contoh: Promo survey gratis bulan ini. Kosongkan untuk menyembunyikan." },
      { key: "announcement_url", label: "Link pengumuman (opsional)", full: true, help: "Diawali / untuk halaman website, atau https://" },
      { key: "cta_eyebrow", label: "CTA — label kecil" },
      { key: "cta_title", label: "CTA — judul" },
      { key: "cta_text", label: "CTA — deskripsi", type: "textarea", full: true },
    ],
  },
  {
    title: "Tentang Kami & Footer",
    fields: [
      { key: "about_title", label: "Judul Tentang Kami", full: true },
      { key: "about_content", label: "Isi Tentang Kami (pisahkan paragraf dengan baris kosong)", type: "textarea", full: true },
      { key: "about_image_url", label: "Foto Tentang Kami 1", type: "image" },
      { key: "about_image_2_url", label: "Foto Tentang Kami 2", type: "image" },
      { key: "footer_text", label: "Teks footer", type: "textarea", full: true },
    ],
  },
  {
    title: "Rating Manual (fallback jika Google API tidak aktif)",
    fields: [
      { key: "manual_rating", label: "Rating (0-5)", type: "number" },
      { key: "manual_review_count", label: "Jumlah review", type: "number" },
    ],
  },
];

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, initial[f.key] ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings(values);
          if (res.ok) {
            setErrors({});
            toast(res.message ?? "Tersimpan");
            router.refresh();
          } else {
            setErrors(res.fieldErrors ?? {});
            toast(res.error, "error");
          }
        });
      }}
      className="space-y-8"
    >
      {SECTIONS.map((section) => (
        <section key={section.title} className="card p-6">
          <h2 className="mb-5 font-display text-lg font-semibold">{section.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                <label htmlFor={`s-${f.key}`} className="label">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea id={`s-${f.key}`} rows={3} className="input" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                ) : f.type === "image" || f.type === "video" ? (
                  <ImageUploader accept={f.type} folder="settings" value={values[f.key] ? [String(values[f.key])] : []} onChange={(u) => set(f.key, u[0] ?? "")} />
                ) : (
                  <input
                    id={`s-${f.key}`}
                    type={f.type === "number" ? "number" : "text"}
                    step={f.key === "manual_rating" ? 0.1 : 1}
                    className="input"
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.help && <p className="mt-1 text-xs text-charcoal-700/70">{f.help}</p>}
                {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-4 flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary shadow-soft">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pengaturan
        </button>
      </div>
    </form>
  );
}

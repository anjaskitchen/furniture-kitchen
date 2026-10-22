"use client";
import { ArrowLeft, ArrowRight, Link2, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "../Toast";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

/**
 * Upload drag & drop ke Supabase Storage (bucket "media").
 * Validasi tipe & ukuran di client; bucket juga membatasi MIME & ukuran di server,
 * dan RLS storage hanya mengizinkan admin.
 */
export function ImageUploader({
  value,
  onChange,
  multiple = false,
  accept = "image",
  folder = "misc",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  accept?: "image" | "video";
  folder?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const types = accept === "video" ? VIDEO_TYPES : IMAGE_TYPES;
  const max = accept === "video" ? MAX_VIDEO : MAX_IMAGE;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    const valid = list.filter((f) => {
      if (!types.includes(f.type)) {
        toast(`${f.name}: format tidak didukung`, "error");
        return false;
      }
      if (f.size > max) {
        toast(`${f.name} melebihi ${max / 1024 / 1024} MB`, "error");
        return false;
      }
      return true;
    });
    if (!valid.length) return;
    setBusy(true);
    const sb = createClient();
    const uploaded: string[] = [];
    for (const file of valid) {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error } = await sb.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        toast(`Upload ${file.name} gagal: ${error.message}`, "error");
        continue;
      }
      uploaded.push(sb.storage.from("media").getPublicUrl(path).data.publicUrl);
    }
    setBusy(false);
    if (uploaded.length) {
      onChange(multiple ? [...value, ...uploaded] : uploaded.slice(0, 1));
      toast(`${uploaded.length} file terunggah`);
    }
  }

  const move = (i: number, d: number) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {value.length > 0 && (
        <div className={cn("mb-3 grid gap-2", multiple ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-1 sm:max-w-xs")}>
          {value.map((url, i) => (
            <div key={url + i} className="group relative aspect-square overflow-hidden rounded-lg bg-cream-200 ring-1 ring-charcoal-900/10">
              {accept === "video" ? (
                <div className="grid h-full place-items-center p-2 text-center text-[10px] break-all text-charcoal-700">{url.split("/").pop()}</div>
              ) : (
                <Image src={url} alt="" fill sizes="160px" unoptimized className="object-cover" />
              )}
              {multiple && i === 0 && <span className="absolute left-1 top-1 rounded bg-charcoal-900 px-1.5 py-0.5 text-[10px] text-white">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                {multiple ? (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-white hover:bg-white/20" aria-label="Geser kiri">
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-white hover:bg-white/20" aria-label="Geser kanan">
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-white hover:bg-red-500" aria-label="Hapus">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(multiple || value.length === 0) && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition",
            drag ? "border-wood-500 bg-cream-100" : "border-charcoal-900/15 hover:border-wood-500 dark:border-white/15",
          )}
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin text-wood-500" /> : <Upload className="h-6 w-6 text-wood-500" />}
          <span className="font-medium">{busy ? "Mengunggah..." : `Tarik ${accept === "video" ? "video" : "foto"} ke sini atau klik untuk memilih`}</span>
          <span className="text-xs text-charcoal-700/70">
            {accept === "video" ? "MP4, WebM, MOV · maks. 50 MB" : "JPG, PNG, WebP, AVIF · maks. 10 MB"}
            {multiple && " · bisa pilih banyak"}
          </span>
          <input ref={inputRef} type="file" accept={types.join(",")} multiple={multiple} className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={accept === "video" ? "atau tempel URL YouTube / Vimeo / MP4" : "atau tempel URL gambar"}
            className="input !py-2 !pl-9 text-sm"
          />
        </div>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => {
            const u = urlInput.trim();
            if (!u) return;
            if (!/^https?:\/\//.test(u) && !u.startsWith("/")) {
              toast("URL harus diawali https://", "error");
              return;
            }
            onChange(multiple ? [...value, u] : [u]);
            setUrlInput("");
          }}
        >
          Tambah
        </button>
      </div>
    </div>
  );
}

import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(8, "Nomor WhatsApp tidak valid")
  .max(20, "Nomor WhatsApp tidak valid")
  .regex(/^[+0-9\s-]+$/, "Nomor WhatsApp hanya boleh angka");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const estimateDetailSchema = z
  .object({
    productType: z.string().max(80),
    material: z.string().max(80),
    length: z.number().min(0).max(50),
    height: z.number().min(0).max(5).optional(),
    finishing: z.string().max(80).nullable().optional(),
    hardware: z.string().max(80).nullable().optional(),
    topTable: z.string().max(80).nullable().optional(),
    accessories: z.array(z.string().max(80)).max(20).optional(),
    total: z.number().min(0),
  })
  .partial()
  .nullable()
  .optional();

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    phone: phone,
    email: z.string().trim().email("Email tidak valid").max(150),
    furniture_type: optionalText(100),
    size: optionalText(100),
    material: optionalText(100),
    estimate_total: z.coerce.number().min(0).max(10_000_000_000).optional().nullable(),
    message: optionalText(3000),
    product_id: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
    estimate_detail: z.string().max(5000).optional().nullable(),
    website: z.string().max(0).optional(), // honeypot
  })
  .strict();

export const surveySchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    phone: phone,
    address: z.string().trim().min(5, "Alamat terlalu pendek").max(500),
    preferred_date: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
    furniture_type: optionalText(100),
    approx_size: optionalText(100),
    notes: optionalText(2000),
    estimate_total: z.coerce.number().min(0).max(10_000_000_000).optional().nullable(),
    estimate_detail: z.string().max(5000).optional().nullable(),
    website: z.string().max(0).optional(),
  })
  .strict();

export const submissionSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    email: z.string().trim().email("Email tidak valid").max(150).optional().or(z.literal("").transform(() => undefined)),
    phone: phone.optional().or(z.literal("").transform(() => undefined)),
    project_title: optionalText(150),
    location: optionalText(150),
    description: optionalText(2000),
    testimonial: z.string().trim().min(10, "Testimoni minimal 10 karakter").max(2000),
    rating: z.coerce.number().int().min(1).max(5),
    website: z.string().max(0).optional(),
  })
  .strict();

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILES = 5;

/** Validasi file upload publik: tipe MIME, ukuran, jumlah, dan signature byte. */
export async function validateImageFiles(files: File[]): Promise<string | null> {
  if (files.length > MAX_FILES) return `Maksimal ${MAX_FILES} foto`;
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return `Format ${file.name} tidak didukung (gunakan JPG, PNG, atau WebP)`;
    }
    if (file.size > MAX_IMAGE_BYTES) return `${file.name} melebihi 5 MB`;
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isWebp = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    if (!isJpeg && !isPng && !isWebp) return `${file.name} bukan file gambar yang valid`;
  }
  return null;
}

export function formDataToObject(form: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = form.get(k);
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

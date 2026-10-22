import { z } from "zod";
import { slugify } from "@/lib/utils";
import type { FieldDef } from "./resources";

const urlOrPath = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "URL harus diawali https:// atau /");

/** Bangun validator Zod dari definisi field admin. */
export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "number":
      case "money": {
        let n = z.coerce.number({ message: `${f.label} harus angka` });
        if (f.min !== undefined) n = n.min(f.min, `${f.label} minimal ${f.min}`);
        else n = n.min(0, `${f.label} tidak boleh negatif`);
        if (f.max !== undefined) n = n.max(f.max, `${f.label} maksimal ${f.max}`);
        if (f.type === "money") n = n.max(100_000_000_000);
        s = f.required ? n : z.union([z.literal("").transform(() => null), z.null(), n]);
        break;
      }
      case "boolean":
        s = z.boolean();
        break;
      case "images":
        s = z.array(urlOrPath).max(20);
        break;
      case "tags":
        s = z.array(z.string().trim().max(60)).max(30);
        break;
      case "image":
      case "video":
      case "url":
        s = f.required ? urlOrPath.refine((v) => v !== "", `${f.label} wajib diisi`) : urlOrPath.transform((v) => v || null).nullable();
        break;
      case "date":
        s = z
          .string()
          .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid")
          .transform((v) => v || null)
          .nullable();
        break;
      case "color":
        s = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format #RRGGBB").nullable();
        break;
      case "select":
        s = f.options
          ? z.enum(f.options.map((o) => o.value) as [string, ...string[]], { message: `${f.label} tidak valid` })
          : z.string().uuid(`${f.label} tidak valid`);
        if (!f.required) s = z.union([z.literal("").transform(() => null), z.null(), s]);
        break;
      case "height_meta":
        s = z.union([z.literal("").transform(() => ({})), z.coerce.number().min(0).max(5).transform((n) => (n ? { standard_height: n } : {}))]);
        break;
      case "slug":
        s = z
          .string()
          .trim()
          .max(80)
          .transform((v) => slugify(v));
        break;
      default: {
        let t = z.string().trim().max(f.type === "textarea" ? 5000 : 300);
        if (f.required) t = t.min(1, `${f.label} wajib diisi`);
        s = f.required ? t : t.transform((v) => v || null).nullable();
      }
    }
    shape[f.name] = f.required || ["boolean", "images", "tags", "slug"].includes(f.type) ? s : s.optional();
  }
  return z.object(shape);
}

/** Lengkapi slug kosong dari field sumber. */
export function fillSlugs(fields: FieldDef[], values: Record<string, unknown>) {
  for (const f of fields) {
    if (f.type === "slug" && !values[f.name] && f.from) {
      values[f.name] = slugify(String(values[f.from] ?? "")) || `item-${Date.now()}`;
    }
  }
  return values;
}

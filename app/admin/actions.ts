"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin, AuthError } from "@/lib/admin/auth";
import { RESOURCES } from "@/lib/admin/resources";
import { buildSchema, fillSlugs } from "@/lib/admin/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[admin]", msg);
  if (/duplicate key/i.test(msg)) return { ok: false, error: "Data dengan slug/kode yang sama sudah ada" };
  return { ok: false, error: "Terjadi kesalahan: " + msg };
}

function revalidateResource(paths: string[]) {
  for (const p of paths) revalidatePath(p, p === "/" ? "layout" : "page");
  if (paths.includes("/katalog")) revalidatePath("/katalog/[slug]", "page");
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
const loginSchema = z.object({ email: z.string().email("Email tidak valid"), password: z.string().min(6, "Password minimal 6 karakter") });

export async function loginAction(_: unknown, form: FormData): Promise<ActionResult> {
  const h = await headers();
  const rl = rateLimit(`login:${clientIp(h)}`, 8, 15 * 60_000);
  if (!rl.ok) return { ok: false, error: "Terlalu banyak percobaan login. Coba lagi nanti." };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Email atau password salah" };
  const next = String(form.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// CRUD GENERIK
// ---------------------------------------------------------------------------
export async function saveRecord(resourceKey: string, id: string | null, values: Record<string, unknown>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const res = RESOURCES[resourceKey];
    if (!res) return { ok: false, error: "Resource tidak dikenal" };
    if (!id && res.canCreate === false) return { ok: false, error: "Data ini tidak bisa dibuat manual" };
    if (id && !z.string().uuid().safeParse(id).success) return { ok: false, error: "ID tidak valid" };

    const schema = buildSchema(res.fields);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Periksa kembali isian form", fieldErrors };
    }
    const data = fillSlugs(res.fields, { ...parsed.data });

    const sb = await createClient();
    const q = id ? sb.from(res.table).update(data).eq("id", id) : sb.from(res.table).insert(data);
    const { error } = await q;
    if (error) throw new Error(error.message);
    revalidateResource(res.revalidate);
    return { ok: true, message: `${res.singular} berhasil disimpan` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecord(resourceKey: string, id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const res = RESOURCES[resourceKey];
    if (!res || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Permintaan tidak valid" };
    if (res.canDelete === false) return { ok: false, error: "Data ini tidak bisa dihapus. Sembunyikan saja jika tidak dipakai." };
    const sb = await createClient();
    const { error } = await sb.from(res.table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateResource(res.revalidate);
    return { ok: true, message: `${res.singular} dihapus` };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleRecord(resourceKey: string, id: string, value: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    const res = RESOURCES[resourceKey];
    if (!res?.toggle || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Permintaan tidak valid" };
    const sb = await createClient();
    const { error } = await sb.from(res.table).update({ [res.toggle.name]: value }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateResource(res.revalidate);
    return { ok: true, message: value ? res.toggle.on : res.toggle.off };
  } catch (e) {
    return fail(e);
  }
}

/** Simpan urutan baru: sort_order = posisi (1..n) sesuai urutan id yang dikirim. */
export async function reorderRecords(resourceKey: string, ids: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const res = RESOURCES[resourceKey];
    const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
    if (!res?.reorderable || !parsed.success) return { ok: false, error: "Permintaan tidak valid" };
    const sb = await createClient();
    const results = await Promise.all(parsed.data.map((id, i) => sb.from(res.table).update({ sort_order: i + 1 }).eq("id", id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    revalidateResource(res.revalidate);
    return { ok: true, message: "Urutan disimpan" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// CUSTOMER SUBMISSION
// ---------------------------------------------------------------------------
const submissionEditSchema = z.object({
  name: z.string().trim().min(2).max(100),
  project_title: z.string().trim().max(150).nullable(),
  location: z.string().trim().max(150).nullable(),
  description: z.string().trim().max(2000).nullable(),
  testimonial: z.string().trim().max(2000).nullable(),
  rating: z.coerce.number().int().min(1).max(5),
  admin_note: z.string().trim().max(1000).nullable(),
  images: z.array(z.string().url()).max(10),
});

export async function updateSubmission(id: string, values: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = submissionEditSchema.safeParse(values);
    if (!parsed.success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Data tidak valid" };
    const sb = await createClient();
    const { error } = await sb.from("customer_submissions").update(parsed.data).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true, message: "Submission diperbarui" };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Approve: status approved + tampil di website sebagai
 *  - portfolio (source customer) jika ada foto
 *  - review (source customer) jika ada testimoni
 */
export async function setSubmissionStatus(id: string, status: "approved" | "rejected" | "pending"): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID tidak valid" };
    const sb = await createClient();
    const { data: sub, error: e1 } = await sb.from("customer_submissions").select("*").eq("id", id).single();
    if (e1 || !sub) throw new Error(e1?.message ?? "Submission tidak ditemukan");

    const { error } = await sb.from("customer_submissions").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);

    // Bersihkan publikasi lama agar approve/reject idempoten.
    await sb.from("portfolio").delete().eq("submission_id", id);
    await sb.from("reviews").delete().eq("submission_id", id);

    if (status === "approved") {
      if (sub.images?.length) {
        const title = sub.project_title || `Project ${sub.name}`;
        const { error: pe } = await sb.from("portfolio").insert({
          title,
          slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60)}-${id.slice(0, 6)}`,
          category: "Residential",
          location: sub.location,
          year: new Date(sub.created_at).getFullYear(),
          description: sub.description || sub.testimonial,
          images: sub.images,
          source: "customer",
          submission_id: id,
          is_published: true,
          sort_order: 100,
        });
        if (pe) throw new Error(pe.message);
      }
      if (sub.testimonial) {
        const { error: re } = await sb.from("reviews").insert({
          author_name: sub.name,
          rating: sub.rating,
          content: sub.testimonial,
          review_date: new Date(sub.created_at).toISOString().slice(0, 10),
          source: "customer",
          submission_id: id,
          is_published: true,
          sort_order: 50,
        });
        if (re) throw new Error(re.message);
      }
    }
    revalidateResource(["/", "/portfolio", "/review"]);
    return { ok: true, message: status === "approved" ? "Disetujui & ditampilkan di website" : status === "rejected" ? "Submission ditolak" : "Dikembalikan ke pending" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSubmission(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const sb = await createClient();
    await sb.from("portfolio").delete().eq("submission_id", id);
    await sb.from("reviews").delete().eq("submission_id", id);
    const { error } = await sb.from("customer_submissions").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateResource(["/", "/portfolio", "/review"]);
    return { ok: true, message: "Submission dihapus" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// PENGATURAN WEBSITE
// ---------------------------------------------------------------------------
const optional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "URL harus diawali https://")
  .transform((v) => v || null)
  .nullable()
  .optional();

const settingsSchema = z.object({
  business_name: z.string().trim().min(2, "Nama bisnis wajib diisi").max(100),
  tagline: optional(150),
  description: optional(500),
  logo_url: optionalUrl,
  address: optional(300),
  city: optional(80),
  whatsapp_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, "").replace(/^0/, "62"))
    .refine((v) => v === "" || /^\d{9,15}$/.test(v), "Nomor WhatsApp tidak valid (contoh 6281234567890)")
    .transform((v) => v || null),
  email: z.string().trim().email("Email tidak valid").or(z.literal("")).transform((v) => v || null),
  notification_email: z.string().trim().email("Email notifikasi tidak valid").or(z.literal("")).transform((v) => v || null),
  instagram_url: optionalUrl,
  facebook_url: optionalUrl,
  tiktok_url: optionalUrl,
  youtube_url: optionalUrl,
  google_maps_url: optionalUrl,
  google_maps_embed_query: optional(300),
  google_place_id: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^[A-Za-z0-9_-]+$/.test(v), "Place ID tidak valid")
    .transform((v) => v || null),
  opening_hours: optional(150),
  hero_title: optional(200),
  hero_subtitle: optional(400),
  hero_image_url: optionalUrl,
  hero_video_url: optionalUrl,
  cta_primary_label: optional(40),
  cta_secondary_label: optional(40),
  footer_text: optional(400),
  about_title: optional(200),
  about_content: optional(5000),
  manual_rating: z.coerce.number().min(0).max(5),
  manual_review_count: z.coerce.number().int().min(0).max(1_000_000),
  whatsapp_default_message: optional(500),
  announcement_text: optional(200),
  announcement_url: optionalUrl,
  hero_card_title: optional(80),
  hero_card_text: optional(80),
  cta_eyebrow: optional(60),
  cta_title: optional(150),
  cta_text: optional(400),
  about_image_url: optionalUrl,
  about_image_2_url: optionalUrl,
});

export async function saveSettings(values: Record<string, unknown>): Promise<ActionResult> {
  try {
    await assertAdmin();
    const parsed = settingsSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { ok: false, error: "Periksa kembali isian", fieldErrors };
    }
    const sb = await createClient();
    const { error } = await sb.from("settings").upsert({ id: true, ...parsed.data });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, message: "Pengaturan disimpan" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// ADMIN USER (khusus role admin)
// ---------------------------------------------------------------------------
const newUserSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  full_name: z.string().trim().max(100).optional(),
  password: z.string().min(10, "Password minimal 10 karakter"),
  role: z.enum(["admin", "editor"]),
});

export async function createAdminUser(values: unknown): Promise<ActionResult> {
  try {
    await assertAdmin(true);
    const parsed = newUserSchema.safeParse(values);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const admin = createAdminClient();
    if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum diisi di environment server" };
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name ?? "" },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Gagal membuat user");
    const { error: e2 } = await admin
      .from("users")
      .upsert({ id: data.user.id, email: parsed.data.email, full_name: parsed.data.full_name ?? null, role: parsed.data.role });
    if (e2) throw new Error(e2.message);
    revalidatePath("/admin/users");
    return { ok: true, message: "Admin baru dibuat" };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserRole(userId: string, role: "customer" | "editor" | "admin"): Promise<ActionResult> {
  try {
    const me = await assertAdmin(true);
    if (!z.string().uuid().safeParse(userId).success || !["customer", "editor", "admin"].includes(role)) return { ok: false, error: "Data tidak valid" };
    if (me.id === userId) return { ok: false, error: "Tidak bisa mengubah role akun sendiri" };
    const sb = await createClient();
    const { error } = await sb.from("users").update({ role }).eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/users");
    return { ok: true, message: "Role diperbarui" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAdminUser(userId: string): Promise<ActionResult> {
  try {
    const me = await assertAdmin(true);
    if (me.id === userId) return { ok: false, error: "Tidak bisa menghapus akun sendiri" };
    const admin = createAdminClient();
    if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum diisi" };
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/users");
    return { ok: true, message: "User dihapus" };
  } catch (e) {
    return fail(e);
  }
}

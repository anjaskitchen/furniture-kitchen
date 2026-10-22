import { NextResponse } from "next/server";
import { badRequest, limit, parseJsonSafe, sameOrigin } from "@/lib/api";
import { emailTable, sendEmail } from "@/lib/email";
import { formatRupiah } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadPublicFiles } from "@/lib/upload";
import { contactSchema, formDataToObject, validateImageFiles } from "@/lib/validation";
import { getSettings } from "@/services/data";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = limit(req, "contact");
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(
    formDataToObject(form, ["name", "phone", "email", "furniture_type", "size", "material", "estimate_total", "message", "product_id", "estimate_detail", "website"]),
  );
  if (!parsed.success) return badRequest(parsed.error);
  const data = parsed.data;

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const fileError = await validateImageFiles(files);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const sb = createAdminClient();
  if (!sb) {
    console.warn("[contact] Supabase belum dikonfigurasi — mode demo, data tidak disimpan");
    return NextResponse.json({ ok: true, demo: true });
  }

  let images: string[] = [];
  try {
    images = await uploadPublicFiles(sb, "references", files);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal mengunggah gambar" }, { status: 500 });
  }

  const { error } = await sb.from("contact_messages").insert({
    name: data.name,
    phone: data.phone,
    email: data.email,
    furniture_type: data.furniture_type,
    size: data.size,
    material: data.material,
    estimate_total: data.estimate_total ?? null,
    estimate_detail: parseJsonSafe(data.estimate_detail),
    message: data.message,
    reference_images: images,
    product_id: data.product_id ?? null,
    channel: "email",
  });
  if (error) {
    console.error("[contact]", error.message);
    return NextResponse.json({ error: "Gagal menyimpan pesan" }, { status: 500 });
  }
  if (data.product_id) await sb.rpc("increment_product_counter", { p_product_id: data.product_id, p_field: "inquiry" });

  const settings = await getSettings();
  const to = settings.notification_email || process.env.EMAIL_TO || settings.email || "";
  await sendEmail({
    to,
    replyTo: data.email,
    subject: `Inquiry baru dari ${data.name}${data.furniture_type ? ` — ${data.furniture_type}` : ""}`,
    html: emailTable("Inquiry baru dari website", [
      ["Nama", data.name],
      ["WhatsApp", data.phone],
      ["Email", data.email],
      ["Jenis furniture", data.furniture_type],
      ["Ukuran", data.size],
      ["Material", data.material],
      ["Estimasi", data.estimate_total ? formatRupiah(data.estimate_total) : null],
      ["Pesan", data.message],
      ["Gambar referensi", images.join("\n")],
    ]),
  });

  return NextResponse.json({ ok: true });
}

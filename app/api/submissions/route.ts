import { NextResponse } from "next/server";
import { badRequest, limit, sameOrigin } from "@/lib/api";
import { emailTable, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/server";
import { uploadPublicFiles } from "@/lib/upload";
import { formDataToObject, submissionSchema, validateImageFiles } from "@/lib/validation";
import { getSettings } from "@/services/data";

/** Customer submission → status "pending". Tidak tampil sampai di-approve admin. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = limit(req, "submission", 3);
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Format data tidak valid" }, { status: 400 });

  const parsed = submissionSchema.safeParse(
    formDataToObject(form, ["name", "email", "phone", "project_title", "location", "description", "testimonial", "rating", "website"]),
  );
  if (!parsed.success) return badRequest(parsed.error);
  const d = parsed.data;

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ error: "Tambahkan minimal 1 foto" }, { status: 400 });
  const fileError = await validateImageFiles(files);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: true, demo: true });

  let images: string[];
  try {
    images = await uploadPublicFiles(sb, "submissions", files);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal mengunggah foto" }, { status: 500 });
  }

  const { error } = await sb.from("customer_submissions").insert({
    name: d.name,
    email: d.email ?? null,
    phone: d.phone ?? null,
    project_title: d.project_title,
    location: d.location,
    description: d.description,
    testimonial: d.testimonial,
    rating: d.rating,
    images,
    status: "pending",
  });
  if (error) {
    console.error("[submission]", error.message);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }

  const settings = await getSettings();
  await sendEmail({
    to: settings.notification_email || process.env.EMAIL_TO || settings.email || "",
    subject: `Customer submission baru — ${d.name}`,
    html: emailTable("Customer submission menunggu approval", [
      ["Nama", d.name],
      ["Project", d.project_title],
      ["Rating", `${d.rating}/5`],
      ["Testimoni", d.testimonial],
    ]),
  });
  return NextResponse.json({ ok: true });
}

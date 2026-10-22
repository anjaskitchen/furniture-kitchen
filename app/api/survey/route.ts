import { NextResponse } from "next/server";
import { badRequest, limit, parseJsonSafe, sameOrigin } from "@/lib/api";
import { emailTable, sendEmail } from "@/lib/email";
import { formatRupiah } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { surveySchema } from "@/lib/validation";
import { getSettings } from "@/services/data";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = limit(req, "survey");
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Format data tidak valid" }, { status: 400 });
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const d = parsed.data;

  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: true, demo: true });

  const { error } = await sb.from("survey_requests").insert({
    name: d.name,
    phone: d.phone,
    address: d.address,
    preferred_date: d.preferred_date,
    furniture_type: d.furniture_type,
    approx_size: d.approx_size,
    notes: d.notes,
    estimate_total: d.estimate_total ?? null,
    estimate_detail: parseJsonSafe(d.estimate_detail),
  });
  if (error) {
    console.error("[survey]", error.message);
    return NextResponse.json({ error: "Gagal menyimpan request" }, { status: 500 });
  }

  const settings = await getSettings();
  await sendEmail({
    to: settings.notification_email || process.env.EMAIL_TO || settings.email || "",
    subject: `Request survey baru — ${d.name}`,
    html: emailTable("Request survey baru", [
      ["Nama", d.name],
      ["WhatsApp", d.phone],
      ["Alamat", d.address],
      ["Tanggal diinginkan", d.preferred_date],
      ["Jenis furniture", d.furniture_type],
      ["Ukuran perkiraan", d.approx_size],
      ["Estimasi kalkulator", d.estimate_total ? formatRupiah(d.estimate_total) : null],
      ["Catatan", d.notes],
    ]),
  });

  return NextResponse.json({ ok: true });
}

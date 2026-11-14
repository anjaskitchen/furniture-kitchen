import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrder } from "@/lib/admin/orders-data";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, kindLabel } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizePhone, whatsappLink } from "@/lib/whatsapp";
import { getSettings } from "@/services/data";

export type InvoiceData = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

/** Semua data invoice (order + pengaturan tampilan + rekening + label jenis pembayaran). */
export async function loadInvoice(sb: SupabaseClient, orderId: string) {
  const [data, s, inv, banks, kinds, tok] = await Promise.all([
    getOrder(orderId, sb),
    getSettings(),
    sb
      .from("settings")
      .select("invoice_logo_url, invoice_title, invoice_footer, invoice_terms, invoice_show_bank, invoice_review_url, invoice_completed_note")
      .eq("id", true)
      .maybeSingle(),
    sb.from("invoice_bank_accounts").select("id, bank_name, account_number, account_holder, notes").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("payment_kinds").select("code, label"),
    sb.from("orders").select("public_token").eq("id", orderId).maybeSingle(),
  ]);
  if (!data) return null;
  const cfg = (inv.data ?? {}) as Record<string, unknown>;
  const str = (k: string) => ((cfg[k] as string | null) ?? "").trim();
  const showBank = (cfg.invoice_show_bank as boolean | undefined) ?? true;
  return {
    ...data,
    settings: s,
    publicToken: (tok.data?.public_token as string | undefined) ?? null,
    logo: str("invoice_logo_url") || s.logo_url || null,
    title: str("invoice_title") || "INVOICE",
    terms: str("invoice_terms")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean),
    footer:
      str("invoice_footer") ||
      `Terima kasih atas kepercayaan Anda. Pertanyaan terkait invoice ini dapat disampaikan melalui WhatsApp ${s.whatsapp_number ? `+${s.whatsapp_number}` : ""}.`,
    banks: showBank ? ((banks.data ?? []) as { id: string; bank_name: string; account_number: string; account_holder: string; notes: string | null }[]) : [],
    warrantyNote: str("invoice_completed_note"),
    reviewUrl: str("invoice_review_url"),
    kindNames: Object.fromEntries((kinds.data ?? []).map((k) => [k.code as string, k.label as string])) as Record<string, string>,
  };
}

/** Invoice untuk konsumen lewat token rahasia (tanpa login). */
export async function loadPublicInvoice(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("orders").select("id").eq("public_token", token).maybeSingle();
  if (!data) return null;
  return loadInvoice(admin, data.id as string);
}

export const kindName = (inv: InvoiceData, code: string) => inv.kindNames[code] ?? kindLabel(code);

/** Pesan WhatsApp berisi ringkasan + link invoice yang bisa dibuka & disimpan PDF oleh konsumen. */
export function invoiceWhatsapp(inv: InvoiceData, siteUrl: string) {
  const o = inv.order;
  const link = inv.publicToken ? `${siteUrl}/invoice/${inv.publicToken}` : "";
  const lines = [
    `Halo ${o.customer_name},`,
    "",
    `Berikut invoice *${o.order_number}* dari ${inv.settings.business_name} untuk pekerjaan *${o.title}*.`,
    "",
    `Total: *${formatRupiah(o.total)}*`,
    o.paid_amount > 0 ? `Sudah dibayar: ${formatRupiah(o.paid_amount)}` : null,
    o.balance > 0 ? `Sisa tagihan: *${formatRupiah(o.balance)}*${o.due_date ? ` (jatuh tempo ${formatDateShort(o.due_date)})` : ""}` : "Status: *LUNAS*",
    o.estimated_finish_date ? `Estimasi selesai maksimal: ${formatDateShort(o.estimated_finish_date)}` : null,
    ...(o.balance > 0 && inv.banks.length ? ["", "Pembayaran transfer ke:", ...inv.banks.map((b) => `• ${b.bank_name} ${b.account_number} a.n. ${b.account_holder}`)] : []),
    link ? "" : null,
    link ? `Lihat & unduh invoice (PDF):\n${link}` : null,
    "",
    "Terima kasih.",
  ].filter((l) => l !== null);
  const text = lines.join("\n");
  const phone = o.customer_phone ?? "";
  const digits = normalizePhone(phone);
  return {
    text,
    hasPhone: digits.length >= 9,
    /** WhatsApp Web (desktop). */
    web: `https://web.whatsapp.com/send?${digits ? `phone=${digits}&` : ""}text=${encodeURIComponent(text)}`,
    /** Aplikasi WhatsApp (HP) / pilih otomatis. */
    app: whatsappLink(phone, text),
    link,
  };
}

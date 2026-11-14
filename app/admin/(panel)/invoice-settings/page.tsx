import { AdminHeader } from "@/components/admin/AdminHeader";
import { InvoiceSettings, type BankAccount, type PaymentKindRow } from "@/components/admin/erp/InvoiceSettings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pengaturan Invoice" };

export default async function InvoiceSettingsPage() {
  const sb = await createClient();
  const [{ data: s }, { data: banks }, { data: last }, { data: kinds }] = await Promise.all([
    sb.from("settings").select("logo_url, invoice_logo_url, invoice_title, invoice_footer, invoice_terms, invoice_show_bank, work_days_per_week, invoice_review_url, invoice_completed_note").eq("id", true).maybeSingle(),
    sb.from("invoice_bank_accounts").select("*").order("sort_order").order("created_at"),
    sb.from("orders").select("id").order("created_at", { ascending: false }).limit(1),
    sb.from("payment_kinds").select("code, label, sort_order, is_active, is_system").order("sort_order").order("label"),
  ]);
  return (
    <>
      <AdminHeader title="Pengaturan Invoice" description="Logo, rekening transfer, jenis pembayaran, garansi, syarat & ketentuan, dan catatan yang tampil di invoice konsumen." />
      <InvoiceSettings
        initial={{
          invoice_logo_url: (s?.invoice_logo_url as string | null) ?? "",
          invoice_title: (s?.invoice_title as string) ?? "INVOICE",
          invoice_footer: (s?.invoice_footer as string | null) ?? "",
          invoice_terms: (s?.invoice_terms as string | null) ?? "",
          invoice_show_bank: (s?.invoice_show_bank as boolean | undefined) ?? true,
          work_days_per_week: Number(s?.work_days_per_week ?? 6),
          invoice_review_url: (s?.invoice_review_url as string | null) ?? "",
          invoice_completed_note: (s?.invoice_completed_note as string | null) ?? "",
        }}
        banks={(banks ?? []) as BankAccount[]}
        kinds={(kinds ?? []) as PaymentKindRow[]}
        siteLogo={(s?.logo_url as string | null) ?? null}
        previewOrderId={(last?.[0]?.id as string | undefined) ?? null}
      />
    </>
  );
}

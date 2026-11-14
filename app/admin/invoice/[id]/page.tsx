import { ExternalLink, Pencil, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintInvoiceButtons, SendInvoiceWhatsapp } from "@/components/invoice/InvoiceActions";
import { INVOICE_PRINT_CSS, InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { requireAdminPage } from "@/lib/admin/auth";
import { publicEnv } from "@/lib/env";
import { invoiceWhatsapp, loadInvoice } from "@/lib/invoice";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Invoice admin: cetak / simpan PDF, kirim ke konsumen via WhatsApp. Tampilan diatur di Pengaturan Invoice. */
export default async function InvoicePage({ params }: { params: Params }) {
  const user = await requireAdminPage();
  if (!["admin", "editor"].includes(user.role)) redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const inv = await loadInvoice(await createClient(), id);
  if (!inv) notFound();
  // Domain yang sedang dipakai admin (mis. www.kitchensetcustombdg.com); fallback ke env.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const siteUrl = host && !host.startsWith("localhost") ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : publicEnv.siteUrl;
  const wa = invoiceWhatsapp(inv, siteUrl);
  const o = inv.order;

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 print:bg-white print:p-0">
      <style>{INVOICE_PRINT_CSS}</style>
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-end gap-2 print:hidden">
        <Link href={`/admin/orders/${o.id}`} className="btn-outline btn-sm bg-white !py-2.5">
          <Pencil className="h-4 w-4" /> Edit order
        </Link>
        <Link href="/admin/invoice-settings" className="btn-outline btn-sm bg-white !py-2.5">
          <Settings2 className="h-4 w-4" /> Pengaturan
        </Link>
        {wa.link && (
          <a href={wa.link} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm bg-white !py-2.5" title="Tampilan yang dilihat konsumen">
            <ExternalLink className="h-4 w-4" /> Link konsumen
          </a>
        )}
        <PrintInvoiceButtons fileName={`Invoice ${o.order_number} - ${o.customer_name}`} primary={false} />
        <SendInvoiceWhatsapp {...wa} />
      </div>
      <InvoiceDocument inv={inv} />
    </main>
  );
}

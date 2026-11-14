import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintInvoiceButtons } from "@/components/invoice/InvoiceActions";
import { INVOICE_PRINT_CSS, InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { loadPublicInvoice } from "@/lib/invoice";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const inv = await loadPublicInvoice(token);
  return {
    title: inv ? `Invoice ${inv.order.order_number}` : "Invoice",
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

/** Invoice untuk konsumen (dibuka dari link WhatsApp). Tanpa login; hanya bisa diakses dengan token rahasia. */
export default async function PublicInvoicePage({ params }: { params: Params }) {
  const { token } = await params;
  const inv = await loadPublicInvoice(token);
  if (!inv) notFound();
  const o = inv.order;
  const s = inv.settings;
  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 print:bg-white print:p-0">
      <style>{INVOICE_PRINT_CSS}</style>
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-charcoal-700">Invoice untuk {o.customer_name}</p>
        <div className="flex flex-wrap gap-2">
          <PrintInvoiceButtons fileName={`Invoice ${o.order_number} - ${s.business_name}`} />
          {s.whatsapp_number && (
            <a href={whatsappLink(s.whatsapp_number, `Halo ${s.business_name}, saya ${o.customer_name} ingin bertanya tentang invoice ${o.order_number}.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm !py-2.5">
              <MessageCircle className="h-4 w-4" /> Tanya via WhatsApp
            </a>
          )}
        </div>
      </div>
      <InvoiceDocument inv={inv} />
    </main>
  );
}

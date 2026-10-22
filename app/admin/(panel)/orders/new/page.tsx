import { OrderForm } from "@/components/admin/orders/OrderForm";
import { emptyOrderForm } from "@/lib/admin/order-form";
import { getCategorySuggestions } from "@/lib/admin/orders-data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Order baru" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const UUID = /^[0-9a-f-]{36}$/i;

/** Order baru — bisa diisi otomatis dari lead: ?survey=<id> atau ?message=<id>. */
export default async function NewOrderPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [categories, sb] = await Promise.all([getCategorySuggestions(), createClient()]);
  const form = emptyOrderForm();

  const survey = typeof sp.survey === "string" && UUID.test(sp.survey) ? sp.survey : null;
  const message = typeof sp.message === "string" && UUID.test(sp.message) ? sp.message : null;

  if (survey) {
    const { data: s } = await sb.from("survey_requests").select("*").eq("id", survey).maybeSingle();
    if (s) {
      Object.assign(form, {
        survey_request_id: s.id,
        source: "survey",
        customer_name: s.name ?? "",
        customer_phone: s.phone ?? "",
        customer_address: s.address ?? "",
        category: s.furniture_type ?? "",
        title: [s.furniture_type, s.name].filter(Boolean).join(" — "),
        notes: [s.notes, s.approx_size ? `Ukuran: ${s.approx_size}` : null].filter(Boolean).join("\n"),
      });
      if (s.estimate_total) form.items = [{ ...form.items[0], name: `${s.furniture_type ?? "Pekerjaan"}${s.approx_size ? ` (${s.approx_size})` : ""}`, qty: "1", unit: "paket", unit_price: Number(s.estimate_total) }];
    }
  } else if (message) {
    const { data: m } = await sb.from("contact_messages").select("*").eq("id", message).maybeSingle();
    if (m) {
      Object.assign(form, {
        contact_message_id: m.id,
        source: "website",
        customer_name: m.name ?? "",
        customer_phone: m.phone ?? "",
        customer_email: m.email ?? "",
        category: m.furniture_type ?? "",
        title: [m.furniture_type, m.name].filter(Boolean).join(" — "),
        notes: [m.message, m.size ? `Ukuran: ${m.size}` : null, m.material ? `Material: ${m.material}` : null].filter(Boolean).join("\n"),
      });
      if (m.estimate_total) form.items = [{ ...form.items[0], name: `${m.furniture_type ?? "Pekerjaan"}${m.size ? ` (${m.size})` : ""}`, qty: "1", unit: "paket", unit_price: Number(m.estimate_total) }];
    }
  }

  return <OrderForm initial={form} categories={categories} />;
}

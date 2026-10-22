import type { OrderFormValues } from "@/components/admin/orders/OrderForm";
import { jakartaToday } from "@/lib/orders";
import type { OrderItemRow, OrderPaymentRow, OrderRow } from "./orders-data";

let seq = 0;
const key = () => `s${(seq++).toString(36)}`;

export function emptyOrderForm(): OrderFormValues {
  return {
    id: null,
    order_number: null,
    order_date: jakartaToday(),
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    title: "",
    category: "",
    source: "whatsapp",
    status: "confirmed",
    discount: 0,
    additional_fee: 0,
    cost_estimate: 0,
    due_date: "",
    completed_at: "",
    survey_request_id: null,
    contact_message_id: null,
    notes: "",
    items: [{ key: key(), name: "", description: "", qty: "1", unit: "meter", unit_price: 0 }],
    payments: [],
  };
}

export function orderToForm(o: OrderRow, items: OrderItemRow[], payments: OrderPaymentRow[]): OrderFormValues {
  return {
    id: o.id,
    order_number: o.order_number,
    order_date: o.order_date,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone ?? "",
    customer_email: o.customer_email ?? "",
    customer_address: o.customer_address ?? "",
    title: o.title,
    category: o.category ?? "",
    source: o.source,
    status: o.status,
    discount: o.discount,
    additional_fee: o.additional_fee,
    cost_estimate: o.cost_estimate,
    due_date: o.due_date ?? "",
    completed_at: o.completed_at ?? "",
    survey_request_id: o.survey_request_id,
    contact_message_id: o.contact_message_id,
    notes: o.notes ?? "",
    items: items.map((i) => ({ key: i.id, name: i.name, description: i.description ?? "", qty: String(i.qty), unit: i.unit, unit_price: i.unit_price })),
    payments: payments.map((p) => ({
      key: p.id,
      paid_at: p.paid_at,
      amount: p.amount,
      method: p.method,
      kind: p.kind,
      reference: p.reference ?? "",
      note: p.note ?? "",
    })),
  };
}

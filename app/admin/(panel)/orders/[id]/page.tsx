import { notFound } from "next/navigation";
import { OrderForm } from "@/components/admin/orders/OrderForm";
import { orderToForm } from "@/lib/admin/order-form";
import { getCategorySuggestions, getOrder } from "@/lib/admin/orders-data";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await getOrder(id) : null;
  return { title: data ? data.order.order_number : "Order" };
}

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, categories] = await Promise.all([getOrder(id), getCategorySuggestions()]);
  if (!data) notFound();
  // key: form di-reset ke data terbaru setelah disimpan (router.refresh).
  return <OrderForm key={data.order.updated_at} initial={orderToForm(data.order, data.items, data.payments)} categories={categories} />;
}

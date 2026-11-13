import { notFound } from "next/navigation";
import { lineKey, PurchaseForm, type PoFormValues } from "@/components/admin/erp/PurchaseForm";
import { getCurrentUser } from "@/lib/admin/auth";
import { cashAccountOptions, getMaterialItems, getPurchaseOrder, getSupplierProducts, projectOptions, supplierOptions } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getPurchaseOrder(id) : null;
  return { title: d?.po.po_number ?? "Pembelian" };
}

export default async function PurchaseDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const [data, user, suppliers, items, products, projects, accounts] = await Promise.all([
    getPurchaseOrder(id),
    getCurrentUser(),
    supplierOptions(sb),
    getMaterialItems(sb),
    getSupplierProducts(sb),
    projectOptions(sb),
    cashAccountOptions(sb),
  ]);
  if (!data) notFound();
  const { po } = data;
  const initial: PoFormValues = {
    id: po.id,
    supplier_id: po.supplier_id,
    project_id: po.project_id ?? "",
    order_date: po.order_date,
    invoice_number: po.invoice_number ?? "",
    status: po.status === "draft" ? "draft" : "ordered",
    expected_date: po.expected_date ?? "",
    due_date: po.due_date ?? "",
    discount: po.discount,
    shipping_cost: po.shipping_cost,
    notes: po.notes ?? "",
    items: data.items.map((i) => ({
      key: lineKey(),
      material_item_id: i.material_item_id,
      description: i.description ?? "",
      qty: String(i.qty),
      unit: i.unit,
      unit_price: i.unit_price,
      project_id: i.project_id && i.project_id !== po.project_id ? i.project_id : "",
    })),
  };
  // Supplier nonaktif tetap tampil agar PO lama bisa dibuka.
  const supplierList = suppliers.some((s) => s.value === po.supplier_id) ? suppliers : [{ value: po.supplier_id, label: po.supplier_name }, ...suppliers];
  return (
    <PurchaseForm
      key={`${po.status}-${po.total}-${po.paid_amount}-${po.invoice_number}`}
      initial={initial}
      po={po}
      suppliers={supplierList}
      items={items}
      products={products}
      projects={projects}
      payments={data.payments}
      accounts={accounts}
      isOwner={user?.role === "admin"}
    />
  );
}

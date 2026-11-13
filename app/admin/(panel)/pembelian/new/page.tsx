import { lineKey, PurchaseForm, type PoFormValues } from "@/components/admin/erp/PurchaseForm";
import { getMaterialItems, getSupplierProducts, projectOptions, supplierOptions } from "@/lib/erp/data";
import { numifyAll } from "@/lib/erp/server";
import type { Requirement } from "@/lib/erp/types";
import { jakartaToday } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pembelian baru" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

/** ?project=<id>&supplier=<id>&req=<id,id> → isi otomatis dari kekurangan material proyek. */
export default async function NewPurchasePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sb = await createClient();
  const projectId = uuid(sp.project);
  const supplierId = uuid(sp.supplier);
  const reqIds = typeof sp.req === "string" ? sp.req.split(",").filter((x) => uuid(x)) : [];
  const [suppliers, items, products, projects, reqs] = await Promise.all([
    supplierOptions(sb),
    getMaterialItems(sb, { activeOnly: true }),
    getSupplierProducts(sb),
    projectOptions(sb, { activeOnly: true }),
    projectId && reqIds.length ? sb.from("project_requirements_view").select("*").eq("project_id", projectId).in("id", reqIds) : Promise.resolve({ data: [] }),
  ]);
  const requirements = numifyAll<Requirement>(reqs.data as Record<string, unknown>[]);
  const lines = requirements
    .filter((r) => r.material_item_id)
    .map((r) => {
      const p = products.find((x) => x.material_item_id === r.material_item_id && x.supplier_id === supplierId && x.is_active);
      const need = r.shortage_qty > 0 ? r.shortage_qty : r.still_needed > 0 ? r.still_needed : r.qty;
      return { key: lineKey(), material_item_id: r.material_item_id!, description: r.spec_text ?? "", qty: String(need), unit: p?.unit || r.unit, unit_price: p?.price ?? r.recommended_price ?? r.est_unit_price, project_id: "" };
    });
  const initial: PoFormValues = {
    id: null,
    supplier_id: supplierId,
    project_id: projectId,
    order_date: jakartaToday(),
    invoice_number: "",
    status: "draft",
    expected_date: "",
    due_date: "",
    discount: 0,
    shipping_cost: 0,
    notes: "",
    items: lines.length ? lines : [{ key: lineKey(), material_item_id: "", description: "", qty: "1", unit: "pcs", unit_price: 0, project_id: "" }],
  };
  return <PurchaseForm initial={initial} po={null} suppliers={suppliers} items={items} products={products} projects={projects} isOwner={false} />;
}

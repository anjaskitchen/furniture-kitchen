import { AdminHeader } from "@/components/admin/AdminHeader";
import { SupplierManager } from "@/components/admin/erp/SupplierManager";
import { getMaterialItems, getSupplierProducts, getSuppliers } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Supplier" };

export default async function SuppliersPage() {
  const sb = await createClient();
  const [suppliers, products, items] = await Promise.all([getSuppliers(sb), getSupplierProducts(sb), getMaterialItems(sb, { activeOnly: true })]);
  return (
    <>
      <AdminHeader title="Database Supplier" description="Toko material langganan, kontak, dan daftar barang beserta harganya." />
      <SupplierManager suppliers={suppliers} products={products} items={items} />
    </>
  );
}

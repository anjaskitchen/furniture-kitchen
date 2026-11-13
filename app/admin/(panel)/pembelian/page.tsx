import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { PurchaseList } from "@/components/admin/erp/PurchaseList";
import { listPurchaseOrders } from "@/lib/erp/data";

export const metadata = { title: "Pembelian" };

export default async function PurchasesPage() {
  const rows = await listPurchaseOrders({});
  return (
    <>
      <AdminHeader
        title="Pembelian Bahan Baku"
        description="Purchase order ke supplier, penerimaan barang ke stok, dan utang supplier."
        action={
          <Link href="/admin/pembelian/new" className="btn-primary !py-2.5">
            <Plus className="h-4 w-4" /> Buat PO
          </Link>
        }
      />
      <PurchaseList rows={rows} />
    </>
  );
}

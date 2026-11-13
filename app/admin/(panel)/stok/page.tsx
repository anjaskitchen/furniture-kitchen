import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { InventoryManager } from "@/components/admin/erp/InventoryManager";
import { TabLinks } from "@/components/admin/erp/kit";
import { getCategories, getInventoryLots, getMaterialItems, getMovements, supplierOptions } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stok Barang" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["ringkasan", "lot", "riwayat"] as const;

export default async function StockPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof TABS)[number]) : "ringkasan";
  const sb = await createClient();
  const [items, lots, movements, categories, suppliers] = await Promise.all([
    getMaterialItems(sb),
    getInventoryLots(sb),
    tab === "riwayat" ? getMovements(sb, { limit: 500 }) : Promise.resolve([]),
    getCategories(sb),
    supplierOptions(sb),
  ]);
  return (
    <>
      <AdminHeader
        title="Stok Barang / Persediaan"
        description="Stok fisik, stok yang dialokasikan ke proyek, dan stok tersedia. Stok tidak berkurang saat dialokasikan — hanya saat benar-benar dipakai."
        action={
          <Link href="/admin/pembelian/new" className="btn-outline btn-sm bg-white !py-2.5">
            Beli barang (PO)
          </Link>
        }
      />
      <TabLinks
        base="/admin/stok"
        active={tab}
        tabs={[
          { key: "ringkasan", label: "Ringkasan per bahan" },
          { key: "lot", label: "Lot stok", count: lots.filter((l) => l.qty_on_hand > 0).length },
          { key: "riwayat", label: "Riwayat mutasi" },
        ]}
      />
      <InventoryManager key={tab} tab={tab} items={items} lots={lots} movements={movements} categories={categories} suppliers={suppliers} />
    </>
  );
}

import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CategoryManager } from "@/components/admin/erp/CategoryManager";
import { TabLinks } from "@/components/admin/erp/kit";
import { MaterialManager } from "@/components/admin/erp/MaterialManager";
import { getCategories, getMaterialItems, getSupplierProducts, supplierOptions } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bahan Baku" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function MaterialsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "kategori" ? "kategori" : "bahan";
  const sb = await createClient();
  const [categories, items, products, suppliers] = await Promise.all([getCategories(sb), getMaterialItems(sb), getSupplierProducts(sb), supplierOptions(sb)]);
  return (
    <>
      <AdminHeader
        title="Bahan Baku"
        description="Database bahan, spesifikasi, dan perbandingan harga dari beberapa supplier."
        action={
          <Link href="/admin/suppliers" className="btn-outline btn-sm bg-white !py-2.5">
            Kelola supplier
          </Link>
        }
      />
      <TabLinks
        base="/admin/bahan"
        active={tab}
        tabs={[
          { key: "bahan", label: "Bahan baku", count: items.length },
          { key: "kategori", label: "Kategori & spesifikasi", count: categories.length },
        ]}
      />
      {tab === "bahan" ? <MaterialManager items={items} categories={categories} products={products} suppliers={suppliers} /> : <CategoryManager categories={categories} />}
    </>
  );
}

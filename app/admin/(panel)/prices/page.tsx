import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Harga" };

export default async function Page() {
  const [materials, hardware, prices] = await Promise.all([fetchResource("materials"), fetchResource("hardware"), fetchResource("price_settings")]);
  return (
    <>
      <AdminHeader
        title="Harga Kalkulator"
        description="Semua harga kalkulator disimpan di database. Tambah, edit, hapus, aktifkan/nonaktifkan — perubahan langsung dipakai kalkulator."
      />
      <section className="mb-14">
        <h2 className="mb-4 font-display text-xl font-semibold">1. Material (HPL, Cat Duco, dll.)</h2>
        <ResourceManager resource="materials" rows={materials} />
      </section>
      <section className="mb-14">
        <h2 className="mb-4 font-display text-xl font-semibold">2. Hardware</h2>
        <ResourceManager resource="hardware" rows={hardware} />
      </section>
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">3. Jenis Produk, Finishing, Top Table, Aksesoris & Biaya Tambahan</h2>
        <ResourceManager resource="price_settings" rows={prices} />
      </section>
    </>
  );
}

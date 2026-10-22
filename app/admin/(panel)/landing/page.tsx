import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { fetchResource } from "@/lib/admin/data";

export const metadata = { title: "Landing Page" };

export default async function Page() {
  const [sections, features, faqs] = await Promise.all([fetchResource("home_sections"), fetchResource("features"), fetchResource("faqs")]);
  return (
    <>
      <AdminHeader
        title="Landing Page"
        description="Susun homepage tanpa coding: urutan section, tampil/sembunyi, judul, poin keunggulan, dan FAQ. Perubahan langsung tampil di website."
      />
      <p className="mb-10 rounded-xl bg-white p-4 text-sm text-charcoal-700 ring-1 ring-charcoal-900/5">
        Hero (judul, gambar/video, tombol), pengumuman di atas navbar, dan teks ajakan konsultasi diatur di{" "}
        <Link href="/admin/settings" className="font-semibold text-wood-600 underline">
          Pengaturan Website
        </Link>
        . Isi section (produk, portfolio, video, review) diambil dari menu masing-masing.
      </p>
      <section className="mb-14">
        <h2 className="mb-4 font-display text-xl font-semibold">1. Section Homepage</h2>
        <ResourceManager resource="home_sections" rows={sections} />
      </section>
      <section className="mb-14">
        <h2 className="mb-4 font-display text-xl font-semibold">2. Statistik, Proses Kerja & Keunggulan</h2>
        <ResourceManager resource="features" rows={features} />
      </section>
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">3. FAQ</h2>
        <ResourceManager resource="faqs" rows={faqs} />
      </section>
    </>
  );
}

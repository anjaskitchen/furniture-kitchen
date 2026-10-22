import { AdminHeader } from "@/components/admin/AdminHeader";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettings } from "@/services/data";

export const metadata = { title: "Pengaturan Website" };

export default async function Page() {
  const settings = await getSettings();
  return (
    <>
      <AdminHeader title="Pengaturan Website" description="Nama bisnis, logo, kontak, WhatsApp, social media, hero, CTA, footer, dan Google Maps." />
      <SettingsForm initial={settings} />
    </>
  );
}

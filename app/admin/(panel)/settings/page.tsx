import { AdminHeader } from "@/components/admin/AdminHeader";
import { GoogleReviewStatus } from "@/components/admin/GoogleReviewStatus";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettings } from "@/services/data";
import { getGoogleReviewStatus } from "@/services/google-reviews";

export const metadata = { title: "Pengaturan Website" };

export default async function Page() {
  const [settings, googleStatus] = await Promise.all([getSettings(), getGoogleReviewStatus()]);
  return (
    <>
      <AdminHeader title="Pengaturan Website" description="Nama bisnis, logo, kontak, WhatsApp, social media, hero, CTA, footer, dan Google Maps." />
      <GoogleReviewStatus status={googleStatus} />
      <SettingsForm initial={settings} />
    </>
  );
}

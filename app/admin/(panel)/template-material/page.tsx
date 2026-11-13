import { AdminHeader } from "@/components/admin/AdminHeader";
import { TemplateManager } from "@/components/admin/erp/TemplateManager";
import { getMaterialItems, getTemplates } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Template Material" };

export default async function TemplatesPage() {
  const sb = await createClient();
  const [templates, items] = await Promise.all([getTemplates(sb), getMaterialItems(sb, { activeOnly: true })]);
  return (
    <>
      <AdminHeader title="Template Material" description="Formula kebutuhan bahan per jenis pekerjaan — dipakai untuk menghitung RAB proyek secara otomatis." />
      <TemplateManager templates={templates} items={items} />
    </>
  );
}

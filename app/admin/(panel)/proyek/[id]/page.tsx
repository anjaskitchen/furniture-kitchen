import { notFound } from "next/navigation";
import { ProjectDetail, type ProjectTab } from "@/components/admin/erp/project/ProjectDetail";
import { getCurrentUser } from "@/lib/admin/auth";
import { cashAccountOptions, employeeOptions, getInventoryLots, getMaterialItems, getProjectDetail, getTemplates, supplierOptions } from "@/lib/erp/data";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS: ProjectTab[] = ["ringkasan", "material", "anggaran", "jadwal", "pekerja"];

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Proyek" };
  const sb = await createClient();
  const { data } = await sb.from("projects").select("orders(order_number, title)").eq("id", id).maybeSingle();
  const o = data?.orders as unknown as { order_number: string; title: string } | null;
  return { title: o ? `${o.order_number} · ${o.title}` : "Proyek" };
}

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const user = await getCurrentUser();
  const isOwner = user?.role === "admin";
  let tab = (TABS as string[]).includes(String(sp.tab)) ? (sp.tab as ProjectTab) : "ringkasan";
  if (tab === "anggaran" && !isOwner) tab = "ringkasan";
  const sb = await createClient();
  const [detail, lots, items, templates, suppliers, employees, accounts] = await Promise.all([
    getProjectDetail(id),
    tab === "material" ? getInventoryLots(sb) : Promise.resolve([]),
    tab === "material" ? getMaterialItems(sb, { activeOnly: true }) : Promise.resolve([]),
    getTemplates(sb),
    tab === "material" ? supplierOptions(sb) : Promise.resolve([]),
    employeeOptions(sb),
    isOwner && tab === "anggaran" ? cashAccountOptions(sb) : Promise.resolve([]),
  ]);
  if (!detail) notFound();
  return (
    <ProjectDetail
      tab={tab}
      isOwner={isOwner}
      project={detail.project}
      requirements={detail.requirements}
      allocations={detail.allocations}
      usage={detail.usage}
      budgets={detail.budgets}
      expenses={detail.expenses}
      stages={detail.stages}
      workers={detail.workers}
      lots={lots}
      items={items}
      templates={templates}
      suppliers={suppliers}
      employees={employees}
      accounts={accounts}
    />
  );
}

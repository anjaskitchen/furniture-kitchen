import { notFound } from "next/navigation";
import { OwnerOnly } from "@/components/admin/erp/OwnerOnly";
import { PayrollEditor } from "@/components/admin/erp/hr/PayrollEditor";
import { getCurrentUser } from "@/lib/admin/auth";
import { cashAccountOptions, getPayroll } from "@/lib/erp/data";

type Params = Promise<{ id: string }>;
export const metadata = { title: "Slip gaji" };

export default async function PayrollDetailPage({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return <OwnerOnly title="Slip gaji" />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, accounts] = await Promise.all([getPayroll(id), cashAccountOptions()]);
  if (!d) notFound();
  return <PayrollEditor key={`${d.payroll.status}-${d.payroll.net_amount}-${d.items.length}-${d.payroll.notes}`} payroll={d.payroll} items={d.items} accounts={accounts} />;
}

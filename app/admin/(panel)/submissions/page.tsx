import { AdminHeader } from "@/components/admin/AdminHeader";
import { SubmissionManager } from "@/components/admin/SubmissionManager";
import { createClient } from "@/lib/supabase/server";
import type { CustomerSubmission } from "@/types";

export const metadata = { title: "Customer Submission" };

export default async function Page() {
  const sb = await createClient();
  const { data } = await sb.from("customer_submissions").select("*").order("created_at", { ascending: false });
  return (
    <>
      <AdminHeader title="Customer Submission" description="Foto & testimoni dari customer. Tidak tampil di website sampai di-approve. Approve = tampil di Portfolio (Customer Project) dan Review." />
      <SubmissionManager rows={(data ?? []) as CustomerSubmission[]} />
    </>
  );
}

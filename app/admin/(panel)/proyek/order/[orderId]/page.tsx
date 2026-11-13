import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ orderId: string }>;

/** Buka proyek dari halaman order. Proyek lama yang belum ada akan dibuat otomatis. */
export default async function ProjectByOrder({ params }: { params: Params }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const sb = await createClient();
  let { data } = await sb.from("projects").select("id").eq("order_id", orderId).maybeSingle();
  if (!data) {
    const ins = await sb.from("projects").insert({ order_id: orderId }).select("id").single();
    data = ins.data;
  }
  if (!data) notFound();
  redirect(`/admin/proyek/${data.id}`);
}

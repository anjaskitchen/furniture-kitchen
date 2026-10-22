import "server-only";
import { createClient } from "@/lib/supabase/server";
import { RESOURCES } from "./resources";

type Row = Record<string, unknown> & { id: string };

/** Ambil semua baris resource (sesi admin, RLS: admin melihat semua termasuk nonaktif/draft). */
export async function fetchResource(key: string): Promise<Row[]> {
  const def = RESOURCES[key];
  const sb = await createClient();
  let q = sb.from(def.table).select("*").limit(1000);
  for (const o of def.orderBy) q = q.order(o.column, { ascending: o.ascending });
  const { data, error } = await q;
  if (error) {
    console.error("[admin data]", key, error.message);
    return [];
  }
  return (data ?? []) as Row[];
}

export async function fetchOptions(table: "categories" | "materials") {
  const sb = await createClient();
  const { data } = await sb.from(table).select("id,name").order("sort_order");
  return (data ?? []).map((r) => ({ value: r.id as string, label: r.name as string }));
}

export async function countRows(table: string, filter?: [string, string]) {
  const sb = await createClient();
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (filter) q = q.eq(filter[0], filter[1]);
  const { count } = await q;
  return count ?? 0;
}

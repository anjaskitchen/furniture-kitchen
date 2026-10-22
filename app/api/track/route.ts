import { NextResponse } from "next/server";
import { z } from "zod";
import { limit } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/server";

const schema = z.object({ productId: z.string().uuid(), type: z.enum(["view", "inquiry"]) });

/** Counter view/inquiry produk untuk "Produk Terpopuler" di dashboard. */
export async function POST(req: Request) {
  const limited = limit(req, "track", 60, 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (isSupabaseConfigured) {
    await createPublicClient().rpc("increment_product_counter", { p_product_id: parsed.data.productId, p_field: parsed.data.type });
  }
  return NextResponse.json({ ok: true });
}

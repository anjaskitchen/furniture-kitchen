import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { clientIp, rateLimit } from "./rate-limit";

export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function badRequest(error: ZodError) {
  return NextResponse.json({ error: "Periksa kembali data yang diisi", fieldErrors: fieldErrors(error) }, { status: 400 });
}

/** Rate limit per IP + endpoint. Mengembalikan response 429 jika terlampaui. */
export function limit(req: Request, name: string, max = 5, windowMs = 10 * 60_000) {
  const r = rateLimit(`${name}:${clientIp(req.headers)}`, max, windowMs);
  if (r.ok) return null;
  return NextResponse.json(
    { error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(r.retryAfter / 60)} menit.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}

/** Tolak request lintas origin (CSRF dasar untuk endpoint form). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function parseJsonSafe(value: unknown): unknown {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

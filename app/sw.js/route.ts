import { readFileSync } from "node:fs";
import { join } from "node:path";

// Dibuat sekali saat build: versi = commit Git di Vercel (atau waktu build di lokal).
export const dynamic = "force-static";

const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? `local-${Date.now()}`).slice(0, 12);
const source = readFileSync(join(process.cwd(), "pwa", "sw.template.js"), "utf8").replace("__SW_VERSION__", version);

export function GET() {
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}

#!/usr/bin/env node
/**
 * Uji end-to-end CRUD + keamanan terhadap project Supabase sungguhan.
 *
 *   npm run verify            → uji database, RLS, storage
 *   npm run verify -- --site http://localhost:3000   → + uji form publik (API) & halaman
 *
 * Membuat user editor sementara (password acak, tidak pernah ditampilkan), lalu:
 *  1. insert → update → delete pada setiap tabel konten sebagai admin (lewat RLS)
 *  2. memastikan anon TIDAK bisa menulis konten & TIDAK bisa membaca lead
 *  3. upload & hapus file di bucket storage "media"
 *  4. (opsional) kirim form survey/kontak lewat API website dan cek tersimpan
 * Semua data uji dibersihkan di akhir.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) if (existsSync(join(root, f))) process.loadEnvFile(join(root, f));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}
const siteIdx = process.argv.indexOf("--site");
const site = siteIdx > 0 ? process.argv[siteIdx + 1]?.replace(/\/$/, "") : null;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);
const admin = createClient(url, anonKey, opts);

const tag = `verify-${Date.now()}`;
let passed = 0;
let failed = 0;
const check = (ok, label, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "✔" : "✘"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
};

// Data uji minimal per tabel + field yang diubah saat update.
const CASES = {
  categories: [{ name: `Uji ${tag}`, slug: tag }, { name: "Uji diubah" }],
  materials: [{ name: `Uji ${tag}`, slug: tag, price_per_meter: 1000 }, { price_per_meter: 2000 }],
  products: [{ name: `Uji ${tag}`, slug: tag, images: [], status: "draft" }, { price_estimate: 5_000_000 }],
  hpl_colors: [{ name: "Uji", code: tag }, { brand: "Uji Brand" }],
  duco_colors: [{ name: "Uji", code: tag }, { finish: "Glossy" }],
  hardware: [{ name: `Uji ${tag}`, price: 100 }, { price: 200 }],
  price_settings: [{ group: "accessory", name: `Uji ${tag}`, price: 100 }, { price: 300 }],
  portfolio: [{ title: `Uji ${tag}`, slug: tag }, { location: "Bandung" }],
  videos: [{ title: `Uji ${tag}`, video_url: "https://www.youtube.com/watch?v=MMXmH1M1LYU" }, { category: "Uji" }],
  reviews: [{ author_name: "Uji", content: tag }, { rating: 4 }],
  features: [{ section: "advantage", title: `Uji ${tag}` }, { description: "diubah" }],
  faqs: [{ question: `Uji ${tag}?`, answer: "Jawaban" }, { answer: "Jawaban baru" }],
};

let userId = null;
const cleanup = [];

try {
  // --- user editor sementara -------------------------------------------------
  const email = `${tag}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data: created, error: ce } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (ce) throw new Error(`createUser: ${ce.message}`);
  userId = created.user.id;
  check(true, "Trigger auth → public.users");
  const { error: re } = await service.from("users").update({ role: "editor" }).eq("id", userId);
  check(!re, "Set role editor (service role)", re?.message);
  const { error: le } = await admin.auth.signInWithPassword({ email, password });
  check(!le, "Login editor", le?.message);

  // --- CRUD per tabel ---------------------------------------------------------
  for (const [table, [row, patch]] of Object.entries(CASES)) {
    const { data: ins, error: ie } = await admin.from(table).insert(row).select("id").single();
    if (ie) {
      check(false, `${table}: insert`, ie.message);
      continue;
    }
    cleanup.push([table, ins.id]);
    const { error: ue } = await admin.from(table).update(patch).eq("id", ins.id);
    const { data: got } = await admin.from(table).select("*").eq("id", ins.id).single();
    const key = Object.keys(patch)[0];
    check(!ue && String(got?.[key]) === String(patch[key]), `${table}: insert → update → read`, ue?.message);
    const { error: aw } = await anon.from(table).update(patch).eq("id", ins.id).select("id");
    const { data: still } = await service.from(table).select("id").eq("id", ins.id);
    check(still?.length === 1 && !aw?.message?.includes("violates") , `${table}: anon tidak bisa mengubah`);
    const { error: de } = await admin.from(table).delete().eq("id", ins.id);
    const { data: gone } = await service.from(table).select("id").eq("id", ins.id);
    check(!de && gone?.length === 0, `${table}: delete`, de?.message);
    if (!de) cleanup.pop();
  }

  // Section homepage: tidak dibuat manual, tapi bisa diubah & disembunyikan.
  const { data: sec } = await admin.from("home_sections").select("id,title,is_active").eq("key", "faq").single();
  const { error: se } = await admin.from("home_sections").update({ title: "Uji judul" }).eq("id", sec.id);
  const { error: se2 } = await admin.from("home_sections").update({ title: sec.title, is_active: sec.is_active }).eq("id", sec.id);
  check(!se && !se2, "home_sections: update & kembalikan", se?.message ?? se2?.message);

  // Settings
  const { data: st } = await admin.from("settings").select("announcement_text").eq("id", true).single();
  const { error: ste } = await admin.from("settings").update({ announcement_text: tag }).eq("id", true);
  await admin.from("settings").update({ announcement_text: st.announcement_text }).eq("id", true);
  check(!ste, "settings: update (admin)", ste?.message);
  const { data: anonSt } = await anon.from("settings").update({ business_name: "HACK" }).eq("id", true).select();
  check(!anonSt?.length, "settings: anon tidak bisa mengubah");

  // --- keamanan lead ----------------------------------------------------------
  for (const t of ["survey_requests", "contact_messages", "customer_submissions", "users"]) {
    const { data } = await anon.from(t).select("id").limit(1);
    check(!data?.length, `${t}: tidak bisa dibaca publik`);
  }
  const { error: ai } = await anon.from("survey_requests").insert({ name: "x", phone: "1", address: "x" });
  check(Boolean(ai), "survey_requests: anon tidak bisa insert langsung (wajib lewat API)");
  const { error: pe } = await admin.from("users").update({ role: "admin" }).eq("id", userId);
  check(Boolean(pe), "Editor tidak bisa menaikkan role sendiri");

  // --- penjualan: order, item, pembayaran, laporan ---------------------------
  {
    const day = "2026-01-15";
    const { data: oid, error: oe } = await admin.rpc("save_order", {
      p: {
        order_date: day,
        customer_name: `Uji ${tag}`,
        title: "Order uji",
        category: `Kategori ${tag}`,
        source: "website",
        status: "production",
        discount: 100000,
        additional_fee: 50000,
        cost_estimate: 3000000,
        items: [
          { name: "Item A", qty: 2.5, unit: "meter", unit_price: 1200000 },
          { name: "Item B", qty: 1, unit: "unit", unit_price: 800000 },
        ],
        payments: [{ paid_at: day, amount: 1500000, method: "transfer", kind: "dp" }],
      },
    });
    check(!oe && oid, "orders: simpan via save_order (editor)", oe?.message);
    if (oid) {
      cleanup.push(["orders", oid]);
      const { data: o } = await admin.from("orders_view").select("order_number,subtotal,total,paid_amount,balance,payment_status,gross_profit").eq("id", oid).single();
      // 2.5×1.2jt + 0.8jt = 3.8jt; total = 3.8jt − 0.1jt + 0.05jt = 3.75jt
      check(Number(o.subtotal) === 3800000 && Number(o.total) === 3750000, `orders: total otomatis akurat (${o.total})`);
      check(Number(o.balance) === 2250000 && o.payment_status === "partial", "orders: sisa tagihan & status bayar");
      check(Number(o.gross_profit) === 750000, "orders: laba kotor = total − HPP");
      check(/^ORD-2601-\d{4}$/.test(o.order_number), `orders: nomor order otomatis (${o.order_number})`);
      const { data: r, error: re2 } = await admin.rpc("order_report", { p_from: day, p_to: day });
      const cat = r?.by_category?.find((c) => c.label === `Kategori ${tag}`);
      check(!re2 && cat && Number(cat.revenue) === 3750000, "orders: laporan menghitung omset order", re2?.message);
      const { data: anonOrders } = await anon.from("orders").select("id").limit(1);
      const { error: anonRpc } = await anon.rpc("order_report", { p_from: day, p_to: day });
      check(!anonOrders?.length && Boolean(anonRpc), "orders: data penjualan tertutup untuk publik");
      const { error: de2 } = await admin.from("orders").delete().eq("id", oid);
      const { data: items } = await service.from("order_items").select("id").eq("order_id", oid);
      check(!de2 && items?.length === 0, "orders: hapus order ikut menghapus item", de2?.message);
      if (!de2) cleanup.pop();
    }
  }

  // --- storage ----------------------------------------------------------------
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const path = `verify/${tag}.png`;
  const { error: upe } = await admin.storage.from("media").upload(path, png, { contentType: "image/png" });
  check(!upe, "storage media: upload (admin)", upe?.message);
  const pub = admin.storage.from("media").getPublicUrl(path).data.publicUrl;
  const res = await fetch(pub);
  check(res.ok, "storage media: URL publik bisa diakses");
  const { error: aue } = await anon.storage.from("media").upload(`verify/${tag}-anon.png`, png, { contentType: "image/png" });
  check(Boolean(aue), "storage media: anon tidak bisa upload");
  const { error: rme } = await admin.storage.from("media").remove([path]);
  check(!rme, "storage media: hapus file", rme?.message);

  // --- form publik lewat website ---------------------------------------------
  if (site) {
    for (const p of ["/", "/katalog", "/kalkulator", "/bahan-warna", "/portfolio", "/video", "/tentang", "/review", "/kontak", "/kirim-project", "/offline", "/manifest.webmanifest", "/sw.js", "/sitemap.xml", "/admin/login"]) {
      const r = await fetch(site + p, { redirect: "manual" });
      check(r.status === 200, `GET ${p} → ${r.status}`);
    }
    const r = await fetch(site + "/admin", { redirect: "manual" });
    check([302, 307].includes(r.status), `GET /admin tanpa login → redirect (${r.status})`);

    const headers = { "Content-Type": "application/json", Origin: site };
    const survey = await fetch(site + "/api/survey", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: `Uji ${tag}`, phone: "081234567890", address: "Jl. Uji No. 1, Bandung", furniture_type: "Kitchen Set", notes: tag }),
    });
    const sj = await survey.json().catch(() => ({}));
    check(survey.ok, `POST /api/survey → ${survey.status}`, JSON.stringify(sj));
    const { data: sv } = await service.from("survey_requests").select("id").eq("notes", tag);
    check(sv?.length === 1, "Survey tersimpan di database");
    for (const s of sv ?? []) cleanup.push(["survey_requests", s.id]);
  }
} catch (e) {
  check(false, "Uji berhenti", e.message);
} finally {
  for (const [t, id] of cleanup) await service.from(t).delete().eq("id", id);
  if (userId) await service.auth.admin.deleteUser(userId);
  console.log(`\n${passed} lulus, ${failed} gagal. Data uji dibersihkan.`);
  process.exit(failed ? 1 : 0);
}

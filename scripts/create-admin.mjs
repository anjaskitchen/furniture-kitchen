#!/usr/bin/env node
/**
 * Buat (atau perbarui) akun admin lewat Supabase Auth Admin API.
 *
 *   npm run admin:create -- --email admin@domain.com --password "RahasiaPanjang123" [--name "Nama"] [--role admin|editor]
 *
 * Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (dibaca dari .env.local).
 * Jika email sudah terdaftar, password dan role-nya diperbarui.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = arg("email")?.trim().toLowerCase();
const password = arg("password");
const fullName = arg("name") ?? "";
const role = arg("role") ?? "admin";

const fail = (msg) => {
  console.error(`[admin] ${msg}`);
  process.exit(1);
};

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Gunakan: npm run admin:create -- --email admin@domain.com --password "minimal10karakter"');
if (!password || password.length < 10) fail("Password minimal 10 karakter.");
if (!["admin", "editor"].includes(role)) fail("Role harus admin atau editor.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local.");

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

let user = await findUser();
if (user) {
  const { data, error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) fail(error.message);
  user = data.user;
  console.log(`[admin] User ${email} sudah ada — password diperbarui.`);
} else {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) fail(error.message);
  user = data.user;
  console.log(`[admin] User ${email} dibuat.`);
}

const { error } = await sb.from("users").upsert({ id: user.id, email, full_name: fullName || null, role });
if (error) fail(`Gagal set role (sudah menjalankan npm run db:migrate?): ${error.message}`);
console.log(`[admin] Role "${role}" aktif. Login di /admin/login`);

#!/usr/bin/env node
/**
 * Buat (atau perbarui) akun admin lewat Supabase Auth Admin API.
 *
 *   npm run admin:create -- --username anjasfurniture --password "RahasiaKuat123"
 *   npm run admin:create -- --email admin@domain.com --password "..." [--username nama] [--name "Nama"] [--role admin|editor]
 *
 * Username atau email wajib salah satu. Tanpa email, akun memakai alamat internal
 * <username>@akun.internal (tidak ditampilkan). Login bisa dengan username atau email.
 * Jika akun dengan username/email itu sudah ada, password, nama, dan role-nya diperbarui.
 * Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (dibaca dari .env.local).
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

const INTERNAL_DOMAIN = "akun.internal";
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const username = arg("username")?.trim().toLowerCase() || null;
const email = arg("email")?.trim().toLowerCase() || null;
const password = arg("password");
const fullName = arg("name") ?? "";
const role = arg("role") ?? "admin";

const fail = (msg) => {
  console.error(`[admin] ${msg}`);
  process.exit(1);
};

if (!username && !email) fail('Gunakan: npm run admin:create -- --username nama --password "minimal8karakter" (atau --email)');
if (username && !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) fail("Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.");
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Format email tidak valid.");
if (!password || password.length < 8) fail("Password minimal 8 karakter.");
if (!["admin", "editor"].includes(role)) fail("Role harus admin atau editor.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local.");

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Cari akun yang sudah ada: berdasarkan username dulu, lalu email.
async function findExisting() {
  if (username) {
    const { data } = await sb.from("users").select("id,email").eq("username", username).maybeSingle();
    if (data) return data;
  }
  if (email) {
    const { data } = await sb.from("users").select("id,email").eq("email", email).maybeSingle();
    if (data) return data;
  }
  return null;
}

const loginEmail = email ?? `${username}@${INTERNAL_DOMAIN}`;
const meta = { full_name: fullName, username };
const existing = await findExisting();
let userId;
if (existing) {
  const patch = { password, user_metadata: meta, email_confirm: true };
  if (email && email !== existing.email) patch.email = email;
  const { error } = await sb.auth.admin.updateUserById(existing.id, patch);
  if (error) fail(error.message);
  userId = existing.id;
  console.log(`[admin] Akun ${username ?? email} sudah ada — password diperbarui.`);
} else {
  const { data, error } = await sb.auth.admin.createUser({ email: loginEmail, password, email_confirm: true, user_metadata: meta });
  if (error) fail(error.message);
  userId = data.user.id;
  console.log(`[admin] Akun ${username ?? email} dibuat.`);
}

const profile = { id: userId, role, ...(fullName ? { full_name: fullName } : {}), ...(username ? { username } : {}) };
const { data: row } = await sb.from("users").select("email").eq("id", userId).single();
const { error } = await sb.from("users").upsert({ ...profile, email: row?.email ?? loginEmail });
if (error) fail(`Gagal menyimpan profil (sudah menjalankan npm run db:migrate?): ${error.message}`);
console.log(`[admin] Role "${role}" aktif. Login di /admin/login dengan ${username ? `username "${username}"` : `email ${email}`}.`);

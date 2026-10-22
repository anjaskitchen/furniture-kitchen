#!/usr/bin/env node
/**
 * Migrasi database otomatis (tanpa Supabase CLI).
 *
 *   npm run db:migrate   → jalankan file baru di supabase/migrations (berurutan, sekali saja)
 *   npm run db:seed      → isi data awal supabase/seed.sql (sekali saja; --force untuk ulang)
 *   npm run db:setup     → migrate + seed
 *   npm run db:status    → daftar migrasi yang sudah/belum dijalankan
 *
 * Koneksi: env SUPABASE_DB_URL (Supabase → Project Settings → Database →
 * Connection string → URI, Session pooler port 5432). Dibaca dari .env.local / .env.
 *
 * Riwayat disimpan di supabase_migrations.schema_migrations — tabel yang sama
 * dengan Supabase CLI, sehingga keduanya tetap kompatibel.
 * Flag --if-configured: lewati tanpa error jika SUPABASE_DB_URL kosong (dipakai saat build).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const [command = "migrate", ...flags] = process.argv.slice(2);
const has = (flag) => flags.includes(flag);
const log = (msg) => console.log(`[db] ${msg}`);

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  if (has("--if-configured")) {
    log("SUPABASE_DB_URL kosong — migrasi dilewati.");
    process.exit(0);
  }
  console.error("[db] SUPABASE_DB_URL belum diisi. Lihat README bagian 'Migrasi database'.");
  process.exit(1);
}

function connectionConfig(raw) {
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  // sslmode di URL mengganti opsi ssl di bawah, jadi dihapus dan diatur eksplisit.
  u.searchParams.delete("sslmode");
  return { connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20_000 };
}

const migrationsDir = join(root, "supabase", "migrations");
const seedFile = join(root, "supabase", "seed.sql");
const SEED_VERSION = "seed";

const client = new pg.Client(connectionConfig(url));

async function ensureHistory() {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
    create table if not exists supabase_migrations.seed_files (
      path text primary key,
      hash text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const [, version, name] = file.match(/^(\d+)_(.+)\.sql$/);
      return { file, version, name };
    });
}

async function applied() {
  const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
  return new Set(rows.map((r) => r.version));
}

async function runSql(sql, label) {
  try {
    await client.query("begin");
    await client.query(sql);
    return true;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error(`[db] GAGAL di ${label}: ${e.message}`);
    if (e.position) {
      const pos = Number(e.position);
      console.error(`[db] ...${sql.slice(Math.max(0, pos - 120), pos + 80)}...`);
    }
    return false;
  }
}

async function migrate() {
  const done = await applied();
  const pending = listMigrations().filter((m) => !done.has(m.version));
  if (!pending.length) {
    log("Database sudah versi terbaru.");
    return true;
  }
  for (const m of pending) {
    const sql = readFileSync(join(migrationsDir, m.file), "utf8");
    log(`→ ${m.file}`);
    if (!(await runSql(sql, m.file))) return false;
    await client.query("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)", [m.version, m.name, [sql]]);
    await client.query("commit");
  }
  // Minta PostgREST memuat ulang skema agar tabel/kolom baru langsung tersedia di API.
  await client.query("notify pgrst, 'reload schema'");
  log(`${pending.length} migrasi diterapkan.`);
  return true;
}

async function seed() {
  if (!existsSync(seedFile)) return log("supabase/seed.sql tidak ada — dilewati."), true;
  const sql = readFileSync(seedFile, "utf8");
  const { rows } = await client.query("select 1 from supabase_migrations.seed_files where path = $1", [SEED_VERSION]);
  // Seed hanya sekali: data yang dihapus admin tidak boleh muncul lagi saat deploy berikutnya.
  if (rows.length && !has("--force")) return log("Seed sudah pernah dijalankan (pakai --force untuk mengulang)."), true;
  log("→ seed.sql");
  if (!(await runSql(sql, "seed.sql"))) return false;
  await client.query(
    `insert into supabase_migrations.seed_files (path, hash) values ($1, md5($2))
     on conflict (path) do update set hash = excluded.hash, applied_at = now()`,
    [SEED_VERSION, sql],
  );
  await client.query("commit");
  log("Data awal berhasil diisi.");
  return true;
}

async function status() {
  const done = await applied();
  for (const m of listMigrations()) console.log(`${done.has(m.version) ? "✔" : "·"} ${m.file}`);
  const { rows } = await client.query("select applied_at from supabase_migrations.seed_files where path = $1", [SEED_VERSION]);
  console.log(`${rows.length ? "✔" : "·"} seed.sql${rows.length ? ` (${rows[0].applied_at.toISOString()})` : ""}`);
  return true;
}

let ok = false;
try {
  await client.connect();
  // Cegah dua proses (mis. dua build paralel) migrasi bersamaan.
  await client.query("select pg_advisory_lock(727274)");
  await ensureHistory();
  if (command === "migrate") ok = await migrate();
  else if (command === "seed") ok = await seed();
  else if (command === "setup") ok = (await migrate()) && (await seed());
  else if (command === "status") ok = await status();
  else console.error(`[db] Perintah tidak dikenal: ${command}`);
} catch (e) {
  console.error(`[db] ${e.message}`);
} finally {
  await client.end().catch(() => {});
}
process.exit(ok ? 0 : 1);

/**
 * Generate ikon PWA (PNG) dari logo SVG. Jalankan: npm run icons
 * Ganti app/icon.svg dengan logo bisnis Anda, lalu jalankan ulang.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });
// Buang blok <metadata> agar sharp hanya membaca gambar.
const svg = Buffer.from(readFileSync(join(root, "app", "icon.svg"), "utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, ""));
const BG = "#1C1C1C";

async function plain(size, name) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(join(out, name));
}

// Maskable: logo di area aman 80% di atas latar penuh, agar tidak terpotong di Android.
async function maskable(size, name) {
  const inner = Math.round(size * 0.8);
  const logo = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(out, name));
}

await plain(192, "icon-192.png");
await plain(512, "icon-512.png");
await maskable(512, "maskable-512.png");
await maskable(180, "apple-touch-icon.png");
console.log("public/icons/* written");

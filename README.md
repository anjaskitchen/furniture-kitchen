# Website Custom Furniture & Kitchen Set

Website company profile + katalog + **kalkulator harga dinamis** + **CMS landing page** + admin panel untuk bisnis custom furniture & kitchen set. Installable sebagai **PWA**.

**Stack:** Next.js 15 (App Router, SSR/ISR) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage + RLS) · Swiper.js · Lucide Icons · Zod · Resend (email) · Google Places API (review) · Google Analytics 4.

> **Mode demo:** tanpa env Supabase, website tetap jalan memakai data contoh (`lib/demo-data.ts`) agar bisa dipreview. Form akan menampilkan label "mode demo" dan tidak menyimpan data. Admin panel membutuhkan Supabase.

---

## Daftar isi

1. [Struktur project](#1-struktur-project)
2. [Database schema](#2-database-schema)
3. [Fitur & source code](#3-fitur--source-code)
4. [Environment variables](#4-environment-variables)
5. [Cara menjalankan](#5-cara-menjalankan) (termasuk migrasi database otomatis)
6. [Cara membuat admin](#6-cara-membuat-admin)
   - [Mengatur landing page (CMS)](#6b-mengatur-landing-page-cms)
   - [Order, omset & laporan KPI](#6c-order-omset--laporan-kpi)
7. [Cara mengubah harga](#7-cara-mengubah-harga)
8. [Cara upload katalog](#8-cara-upload-katalog)
9. [Cara mengatur Google Review](#9-cara-mengatur-google-review)
10. [Setup email & WhatsApp](#10-setup-email--whatsapp)
11. [Deployment (Vercel)](#11-deployment-vercel)
12. [Keamanan, SEO, performa](#12-keamanan-seo-performa)
13. [PWA](#13-pwa)
14. [Uji end-to-end](#14-uji-end-to-end)

---

## 1. Struktur project

```
app/
  (site)/                  Halaman publik (Navbar, Footer, WhatsApp floating, mobile CTA)
    page.tsx               HOME
    katalog/               KATALOG (search, filter kategori & material, sort harga)
    katalog/[slug]/        DETAIL PRODUK (gallery slider, video, CTA WhatsApp)
    kalkulator/            KALKULATOR HARGA
    bahan-warna/           BAHAN & WARNA (HPL + Cat Duco)
    portfolio/             PORTFOLIO (masonry + lightbox)
    video/                 VIDEO (slider, lazy load)
    tentang/               TENTANG KAMI
    review/                REVIEW CUSTOMER (Google live / fallback manual)
    kontak/                KONTAK (email, request survey, request design, peta)
    kirim-project/         Customer Project submission
  offline/                 Halaman fallback PWA saat offline
  admin/
    login/                 Login admin
    (panel)/               Dashboard + semua menu admin (dilindungi auth + role)
      landing (section homepage, statistik/proses/keunggulan, FAQ),
      products, categories, prices, materials, hpl, duco, hardware,
      portfolio, videos, submissions, reviews, surveys, messages, settings, users
    actions.ts             Server Actions (CRUD, approval, settings, user)
  api/
    contact/               Form email + upload referensi → DB + notifikasi email
    survey/                Request survey → DB + notifikasi email
    submissions/           Customer submission (status pending)
    track/                 Counter view/inquiry produk
  sitemap.ts, robots.ts, manifest.ts, opengraph-image.tsx
components/                Komponen UI reusable (Navbar, Footer, Hero, ProductCard, ProductGrid,
                           ProductDetail, PriceCalculator, MaterialCard, ColorCard, PortfolioGrid,
                           VideoSlider, ReviewSlider, ContactForm, WhatsAppButton, Toast, LoadingState,
                           EmptyState, …)
components/admin/          AdminSidebar, AdminTable, AdminModal, ImageUploader, ResourceManager, …
components/forms/          ContactForm, SurveyForm, SubmissionForm
lib/
  calculator.ts            ⭐ calculateEstimate() — engine kalkulator (terpisah dari UI)
  admin/resources.ts       Konfigurasi CRUD admin (field, kolom, validasi)
  supabase/                Client server/browser/middleware
  validation.ts            Skema Zod + validasi file
  whatsapp.ts, email.ts, seo.ts, rate-limit.ts, analytics.ts, format.ts
  demo-data.ts             Data awal (sumber supabase/seed.sql & mode demo)
services/
  data.ts                  Query data publik (Supabase / fallback demo)
  google-reviews.ts        Google Places API (New) + fallback manual
types/                     Tipe TypeScript domain
hooks/                     (cadangan untuk custom hooks)
styles/globals.css         Tailwind + design tokens
public/placeholders/       Ilustrasi placeholder SVG (ganti dengan foto asli via Admin)
public/icons/, pwa/        Ikon PWA (npm run icons) & template service worker (disajikan di /sw.js)
supabase/migrations/       Migrasi SQL berurutan (tabel, relasi, trigger, RLS, storage, grant)
supabase/seed.sql          Data awal (generated: npm run seed:sql), dijalankan sekali
scripts/db.mjs             Runner migrasi otomatis (db:migrate / db:seed / db:setup / db:status)
scripts/create-admin.mjs   Membuat / reset akun admin dengan username atau email (npm run admin:create)
scripts/verify-crud.mjs    Uji end-to-end CRUD + RLS + storage + API + penjualan (npm run verify)
tests/                     Unit test kalkulator (npm test)
middleware.ts              Proteksi /admin + refresh sesi Supabase
```

## 2. Database schema

File: [`supabase/migrations/`](supabase/migrations) (dijalankan berurutan oleh `npm run db:migrate`). Ringkasan tabel & relasi:

| Tabel | Isi | Relasi |
|---|---|---|
| `users` | Profil + `username` (unik, untuk login) + `role` (customer / editor / admin) | `id` → `auth.users.id` (dibuat otomatis oleh trigger saat user baru) |
| `categories` | Kategori produk | — |
| `materials` | HPL, Cat Duco, Veneer… + `price_per_meter` | — |
| `products` | Produk katalog (images[], video, status, view/inquiry count) | `category_id` → categories, `material_id` → materials |
| `hpl_colors` | Katalog warna HPL (nama, kode, brand, kategori, foto) | — |
| `duco_colors` | Katalog warna Cat Duco (kode, kategori, finish) | — |
| `hardware` | Hardware + harga per meter/fixed | — |
| `price_settings` | Jenis produk (pengali + tinggi standar), finishing (%), top table (Rp/m), aksesoris (Rp/unit), biaya tambahan | — |
| `portfolio` | Project (admin / customer) | `submission_id` → customer_submissions |
| `videos` | Video YouTube/Vimeo/upload | — |
| `customer_submissions` | Kiriman customer (pending/approved/rejected) | — |
| `reviews` | Review manual / testimoni approved | `submission_id` → customer_submissions |
| `survey_requests` | Request survey | — |
| `contact_messages` | Pesan form email + gambar referensi | `product_id` → products |
| `settings` | Satu baris pengaturan website (identitas, kontak, hero, pengumuman, CTA, Tentang Kami) | — |
| `home_sections` | Section homepage: urutan, tampil/sembunyi, eyebrow/judul/deskripsi, tombol, jumlah item | `key` unik → komponen section |
| `features` | Poin konten: statistik hero, proses kerja, keunggulan, nilai Tentang Kami (ikon + judul + deskripsi) | — |
| `faqs` | FAQ homepage (+ structured data FAQPage) | — |
| `orders` | Order penjualan: nomor otomatis `ORD-YYMM-0001`, customer, project, status, diskon, biaya tambahan, HPP, total & dibayar (dihitung trigger) | `survey_request_id` / `contact_message_id` → lead asal |
| `order_items` | Item pekerjaan (qty × harga satuan) | `order_id` → orders (cascade) |
| `order_payments` | DP / termin / pelunasan (tanggal, metode, referensi) | `order_id` → orders (cascade) |
| `orders_view` | View ringkasan: sisa tagihan, status bayar, laba kotor | — |

**Row Level Security (aktif di semua tabel):**
- Publik (anon) hanya bisa **membaca** baris yang aktif/published + settings.
- Leads (`survey_requests`, `contact_messages`, `customer_submissions`) **tidak bisa dibaca/ditulis publik**; insert dilakukan API route server dengan service role setelah validasi Zod + rate limit.
- Hanya `admin`/`editor` (fungsi `is_admin()`) yang bisa menulis konten & harga. Hanya `admin` yang bisa mengubah role (trigger `protect_user_role`).
- Storage: bucket `media` (katalog, maks. 50 MB, image/video) & `uploads` (customer, maks. 5 MB, image) — publik baca, hanya admin/service role menulis.

Riwayat migrasi disimpan di `supabase_migrations.schema_migrations` (format yang sama dengan Supabase CLI). Setiap migrasi berjalan dalam transaksi, jadi jika gagal tidak ada perubahan setengah jadi. `npm run verify` menguji policy RLS anon vs editor vs service role terhadap database sungguhan.

## 3. Fitur & source code

- **Kalkulator harga** (`lib/calculator.ts`, `components/PriceCalculator.tsx`)
  - Input: jenis produk, material, panjang, tinggi, finishing, top table, hardware, opsi tambahan (+qty).
  - Output: `basePrice, materialCost, finishingCost, hardwareCost, topTableCost, accessoriesCost, additionalCost, totalEstimate` + breakdown.
  - Rumus:
    - `materialCost = harga material/m × panjang × pengali jenis produk × faktor tinggi`
    - faktor tinggi = `tinggi / tinggi standar` jika tinggi melebihi standar jenis produk, selain itu 1
    - finishing = persen × materialCost · hardware & top table = Rp/m × panjang · aksesoris = Rp × qty
  - **Tidak ada harga di frontend** — semua dari tabel `materials`, `hardware`, `price_settings`.
  - Contoh default: HPL 3 m = **Rp 6.600.000**, Cat Duco 3 m = **Rp 8.400.000** (diverifikasi oleh `npm test`).
  - Kirim hasil: WhatsApp (pesan otomatis), Email (form + simpan DB + notifikasi), Request Survey.
- **WhatsApp click-to-chat** dengan pre-filled message di semua CTA, floating button (desktop), sticky bar `[Hitung Harga] [WhatsApp]` (mobile).
- **Customer submission** → pending → Admin approve → otomatis tampil di Portfolio (Customer Project) & Review.
- **Admin panel** lengkap: CRUD semua konten, upload drag-and-drop multi foto/video ke Supabase Storage, toggle aktif/publish, dashboard dengan grafik leads & produk terpopuler.
- **Dark/Light mode** (default light premium), animasi ringan (fade/hover/slide), `prefers-reduced-motion` dihormati.
- **Analytics GA4**: `product_view`, `calculator_started`, `calculator_completed`, `whatsapp_click`, `email_click`, `survey_request`, `product_inquiry`.

## 4. Environment variables

Lihat [`.env.example`](.env.example).

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL production (sitemap, canonical, OG) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon/public key (aman di browser, dilindungi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Rahasia, server only**. Untuk simpan lead/upload form publik & buat admin user |
| `GOOGLE_PLACES_API_KEY` / `GOOGLE_MAPS_API_KEY` | opsional | Review Google live (server only) |
| `GOOGLE_PLACE_ID` | opsional | Place ID bisnis (atau isi di Admin → Pengaturan) |
| `WHATSAPP_NUMBER` | opsional | Fallback jika nomor di Admin kosong |
| `EMAIL_SERVICE_KEY` | opsional* | API key Resend. *Tanpa ini data tetap tersimpan, hanya notifikasi email yang dilewati |
| `EMAIL_FROM` | opsional* | Alamat pengirim (domain terverifikasi di Resend) |
| `EMAIL_TO` | opsional | Fallback penerima notifikasi |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | opsional | `G-XXXXXXX` |

## 5. Cara menjalankan

### 5.1 Install
```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
```

### 5.2 Setup Supabase & database (otomatis)
1. Buat project di <https://supabase.com> (region Singapore disarankan).
2. **Project Settings → API**: salin URL, `anon` key, dan `service_role` key ke `.env.local`.
3. **Project Settings → Database → Connection string → URI → Session pooler** (port 5432). Ganti `[YOUR-PASSWORD]` dengan password database (tanpa kurung siku), isi ke `SUPABASE_DB_URL`:
   ```
   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   > Gunakan **Session pooler**, bukan *Direct connection*: host `db.<ref>.supabase.co` hanya IPv6 sehingga gagal di banyak jaringan dan di Vercel. Jika password mengandung karakter khusus (`@ : / ? #`), encode dulu (mis. `@` → `%40`).
4. Jalankan:
   ```bash
   npm run db:setup     # semua migrasi + data awal (sekali)
   npm run db:status    # cek migrasi yang sudah diterapkan
   ```
   Perintah ini membuat tabel, relasi, trigger, RLS, bucket storage `media` & `uploads`, dan data awal: 12 produk, 10 portfolio, 11 warna HPL, 10 warna Duco, 5 hardware, 5 video, 5 review, 9 section homepage, 14 poin konten, 6 FAQ, serta harga awal HPL Rp 2.200.000/m & Cat Duco Rp 2.800.000/m.
5. **Authentication → Providers → Email**: pastikan Email aktif. Untuk keamanan, matikan "Allow new users to sign up" (admin dibuat lewat script/menu admin).

**Migrasi otomatis saat deploy:** `npm run build` menjalankan `db:setup` lebih dulu jika `SUPABASE_DB_URL` terisi, jadi setiap deploy Vercel otomatis menerapkan migrasi baru. Seed hanya dijalankan **sekali** (dicatat di `supabase_migrations.seed_files`) sehingga data yang Anda hapus di admin tidak muncul kembali. Untuk build tanpa migrasi: `npm run build:app`.

**Menambah perubahan skema:** buat file baru `supabase/migrations/<YYYYMMDDHHMMSS>_nama.sql` (pakai `if not exists` / `add column if not exists` agar aman), lalu `npm run db:migrate` atau cukup deploy.

### 5.3 Setup Storage
Migrasi sudah membuat bucket `media` dan `uploads` beserta policy-nya. Cek di **Storage** bahwa keduanya ada dan bertanda *Public*. Batas ukuran & tipe file sudah diatur di bucket (bisa diubah di Storage → bucket → Settings).

### 5.4 Development
```bash
npm run dev          # http://localhost:3000
npm test             # unit test kalkulator
npm run typecheck    # cek TypeScript
npm run lint
npm run verify -- --site http://localhost:3000   # uji end-to-end (bagian 14)
```

### 5.5 Build production
```bash
npm run build
npm start
```

Script lain: `npm run seed:sql` (generate ulang `supabase/seed.sql` dari `lib/demo-data.ts`), `npm run placeholders` (generate ulang gambar placeholder), `npm run icons` (generate ikon PWA dari `app/icon.svg`).

## 6. Cara membuat admin

Login admin (`/admin/login`) menerima **username atau email** di satu kolom. Email tidak wajib: akun boleh hanya punya username.

**Admin pertama**: satu perintah (butuh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local` dan migrasi sudah dijalankan):
```bash
npm run admin:create -- --username anjasfurniture --password "PasswordKuat123"
# opsional: --email admin@domain.com  --name "Nama"  --role editor
```
Jika username/email sudah terdaftar, password, nama, dan role-nya diperbarui. Perintah yang sama juga dipakai untuk **reset password** jika lupa.

**Kelola akun dari admin panel**: menu **Akun Admin**:
- **Tambah akun**: isi username dan/atau email (minimal salah satu), nama, role, password (min. 8 karakter).
- **Edit**: ganti username, email, nama, role, atau password (kosongkan password jika tidak diganti).
- **Hapus** akun lain. Akun sendiri tidak bisa dihapus dan role-nya tidak bisa diubah sendiri, agar selalu ada admin.
- Role: `admin` = akses penuh termasuk akun; `editor` = konten, harga, leads (hanya bisa mengubah akunnya sendiri); *tanpa akses* = tidak bisa masuk admin.

Username: 3–30 karakter, huruf kecil, angka, titik, garis bawah, atau strip (tidak membedakan huruf besar/kecil saat login). Akun tanpa email memakai alamat internal `<username>@akun.internal` yang tidak ditampilkan. Pesan gagal login selalu sama ("Username/email atau password salah") agar username tidak bisa ditebak, dan login dibatasi 8 percobaan per 15 menit per IP.

### Tampilan admin
- Sidebar dikelompokkan (Utama, Katalog, Harga & Material, Leads & Review, Sistem) dan bisa **dilipat menjadi ikon** (tombol di sidebar atau **Ctrl/⌘ + B**); pilihan tersimpan per perangkat.
- Di HP: menu drawer dari kiri, tabel berubah menjadi kartu (ketuk kartu untuk edit).
- Dashboard: aksi cepat, daftar "perlu tindakan" (lead baru/submission pending), grafik leads, leads terbaru, produk terpopuler, dan checklist **Kesiapan website** (foto asli, logo, WhatsApp, Place ID, dll.).

## 6b. Mengatur landing page (CMS)

Semua tampilan homepage bisa diubah tanpa coding. Halaman di-revalidate otomatis saat disimpan, jadi perubahan langsung tampil.

| Yang diubah | Menu admin |
|---|---|
| Urutan section homepage, tampil/sembunyi, eyebrow, judul, deskripsi, label & link tombol, jumlah item | **Landing Page → Section Homepage** (panah ↑↓ untuk urutan, ikon mata untuk sembunyikan) |
| Statistik di bawah hero (Rating / Garansi / Survey), langkah proses kerja, keunggulan, nilai di Tentang Kami | **Landing Page → Statistik, Proses Kerja & Keunggulan** (ikon dipilih dari daftar). Statistik berikon *Bintang* tanpa nilai = rating review otomatis |
| FAQ (juga dikirim ke Google sebagai FAQPage) | **Landing Page → FAQ** |
| Hero (judul, subjudul, gambar/video, label tombol, kartu kecil), bar pengumuman di atas navbar, teks ajakan konsultasi (CTA), foto Tentang Kami, kontak, sosial media | **Pengaturan Website** |
| Isi section: kategori, produk unggulan (centang *Tampilkan di homepage*), portfolio, video, review | Menu masing-masing |

Section yang datanya kosong (mis. belum ada video) otomatis disembunyikan, dan latar section selang-seling tetap rapi setelah urutan diubah.

## 6c. Order, omset & laporan KPI

Menu **Penjualan** di admin:

- **Order** — catat order lengkap: customer, project, kategori, sumber order (WhatsApp, website, IG, referensi, dll.), status (*Penawaran → Deal → Produksi → Instalasi → Selesai / Batal*), item pekerjaan (qty desimal mis. `3,5` meter), diskon, biaya tambahan, HPP, dan pembayaran (DP/termin/pelunasan; tombol *Isi sisa tagihan*). Total, sisa tagihan, status bayar & laba kotor dihitung otomatis. Tersedia filter periode/status/pembayaran, pencarian, urutan, tombol WhatsApp ke customer, dan **Invoice** siap cetak/PDF.
- **Buat order dari lead** — buka Request Survey / Pesan Kontak → *Buat order dari lead ini* (data customer & estimasi terisi otomatis).
- **Laporan & KPI** — periode *Hari ini, 7/30 hari, Bulan ini, Bulan lalu, Kuartal, Tahun ini, Tahun lalu* atau rentang tanggal bebas, dibandingkan otomatis dengan periode sebelumnya: omset, kas masuk, laba kotor & margin, jumlah order, rata-rata nilai order, piutang & jatuh tempo, order selesai, rasio order/leads, **target omset** (pro-rata per hari, khusus admin mengatur), grafik tren, omset per kategori & sumber, status, order berjalan, dan top customer.
- **Export Excel** — file `.xlsx` lengkap: *Ringkasan* (KPI dengan rumus perubahan, target, piutang, pipeline, rincian, top customer + **3 grafik Excel native**), *Tren* (+ grafik), *Order* (autofilter, total `SUBTOTAL` yang ikut filter), *Item*, *Pembayaran*, *Piutang* (hari terlambat).
- **Dashboard** menampilkan ringkasan penjualan bulan ini + progres target.

**Definisi angka (konsisten di layar & Excel):** Omset = total order berstatus Deal/Produksi/Instalasi/Selesai berdasarkan tanggal order (Penawaran & Batal tidak dihitung) · Kas masuk = pembayaran berdasarkan tanggal bayar · Piutang = total − dibayar order terkonfirmasi per hari ini · Laba kotor = omset − HPP · Semua tanggal WIB. Perhitungan dilakukan di database (`order_report`, trigger total) dan diuji di `npm test` & `npm run verify`.

Data penjualan hanya bisa diakses admin/editor (RLS); perubahan order tersinkron realtime antar admin.

## 7. Cara mengubah harga

Admin → **Harga** (semua harga kalkulator di satu halaman):
1. **Material** — ubah `Harga per meter` HPL / Cat Duco / tambah material baru.
2. **Hardware** — Standard / Soft Closing / Premium (per meter atau harga tetap). Hanya yang dicentang *Opsi kalkulator* yang muncul.
3. **Jenis Produk, Finishing, Top Table, Aksesoris, Biaya Tambahan** (pakai filter grup):
   - Jenis Produk: `harga` = pengali (1 = normal, 1.1 = +10%), *Tinggi standar* = tinggi yang sudah termasuk harga per meter.
   - Finishing: `harga` = persen dari biaya material (Premium 15 = +15%).
   - Top Table: Rupiah per meter panjang.
   - Aksesoris: Rupiah per unit.
   - Biaya Tambahan: Rupiah tetap yang otomatis ditambahkan (0 = gratis).

Tombol mata = aktifkan/nonaktifkan. Setelah disimpan, halaman kalkulator di-revalidate otomatis sehingga harga baru **langsung dipakai**.

## 8. Cara upload katalog

- **Produk:** Admin → Produk → *Tambah Produk*. Tarik banyak foto sekaligus ke area upload (foto pertama = cover, urutan bisa digeser), tambah video (upload MP4/WebM atau tempel URL YouTube/Vimeo), pilih kategori, material, status *Published/Draft*.
- **Portfolio:** Admin → Portfolio → *Tambah Project* (foto, video, lokasi, tahun, material). Toggle publish/unpublish.
- **Video:** Admin → Video. YouTube/Vimeo otomatis memakai thumbnail resmi; file upload sebaiknya diberi thumbnail.
- **Warna HPL / Cat Duco:** Admin → HPL / Cat Duco (nama, kode, brand, kategori, warna dasar, foto sampel).
- **Customer submission:** Admin → Customer Submission → Approve / Reject / Edit.
- **Gambar placeholder** (`/placeholders/*.svg`) cukup diganti dengan upload foto asli lewat admin; foto hero & logo di Admin → Pengaturan Website.

Upload langsung ke Supabase Storage dari browser admin (dibatasi RLS hanya admin). Format: JPG/PNG/WebP/AVIF (maks. 10 MB) dan MP4/WebM/MOV (maks. 50 MB). Next.js otomatis mengubah foto ke WebP/AVIF responsif saat ditampilkan.

## 9. Cara mengatur Google Review

Website memakai **Google Places API (New) — Place Details** secara resmi (bukan scraping). Implementasi: `services/google-reviews.ts`. Data di-cache 1 jam. Google mengembalikan rating, jumlah ulasan, dan maksimal **5 review** paling relevan.

1. **Google Cloud Console** → buat/ pilih project → aktifkan **Billing** (ada kuota gratis bulanan).
2. **APIs & Services → Library** → aktifkan **Places API (New)**.
3. **Credentials → Create API key** → *Restrict key*: API restrictions = Places API (New). (Key dipanggil dari server, jadi jangan dibatasi HTTP referrer; bisa dibatasi IP jika server punya IP tetap.)
4. Isi `GOOGLE_PLACES_API_KEY` di env.
5. **Temukan Place ID** (jangan memakai short URL `maps.app.goo.gl/...`):
   - Cara termudah: buka <https://developers.google.com/maps/documentation/places/web-service/place-id> → *Place ID Finder* → ketik nama bisnis → salin Place ID (`ChIJ...`).
   - Atau via API:
     ```bash
     curl -X POST 'https://places.googleapis.com/v1/places:searchText' \
       -H 'Content-Type: application/json' \
       -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
       -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress' \
       -d '{"textQuery": "Nama Bisnis Anda Bandung"}'
     ```
   - Pastikan nama & alamat hasilnya sama dengan bisnis di link Google Maps Anda (`https://maps.app.goo.gl/hbrsjzTrYgMLddL39`).
6. Isi Place ID di **Admin → Pengaturan Website → Google Place ID** (atau env `GOOGLE_PLACE_ID`). Isi juga *Link Google Maps* untuk tombol "Lihat Semua Review di Google".

**Fallback:** jika API key/Place ID kosong atau API error, website **tidak membuat review palsu "live"** — yang tampil adalah review manual dari Admin → Review + rating manual dari Admin → Pengaturan, diberi keterangan bukan data live, dan schema `AggregateRating` tidak dikirim. Review di `seed.sql` hanyalah contoh — hapus/ganti dengan review asli.

## 10. Setup email & WhatsApp

**Email (Resend):**
1. Daftar di <https://resend.com> → *Domains* → tambahkan & verifikasi domain Anda (DNS).
2. *API Keys* → buat key → isi `EMAIL_SERVICE_KEY`. Isi `EMAIL_FROM` dengan alamat di domain terverifikasi.
3. Admin → Pengaturan Website → *Email tujuan notifikasi*.
Notifikasi dikirim untuk: form email/inquiry, request survey, dan customer submission. Data tetap tersimpan di database walaupun email gagal/tidak dikonfigurasi.

**WhatsApp:** Admin → Pengaturan Website → *Nomor WhatsApp* (format `628xxxxxxxxxx`) & *Pesan WhatsApp default*. Semua tombol (floating, sticky mobile, produk, kalkulator, form sukses) memakai `https://wa.me/<nomor>?text=<pesan>`.

## 11. Deployment (Vercel)

1. Push project ke GitHub (repo: `anjaskitchen/furniture-kitchen`).
2. <https://vercel.com/new> → import repo. Framework terdeteksi otomatis (Next.js), build command `npm run build`.
3. **Settings → Environment Variables** (Production + Preview), isi dari `.env.example`, minimal:
   - `NEXT_PUBLIC_SITE_URL` = domain final (mis. `https://www.domain-anda.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL` (Session pooler) agar migrasi berjalan otomatis setiap deploy. Boleh diisi hanya untuk *Production* jika Preview tidak boleh mengubah database.
   - opsional: `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`, `EMAIL_SERVICE_KEY`, `EMAIL_FROM`, `EMAIL_TO`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`
4. Deploy. Log build menampilkan `[db] Database sudah versi terbaru.` atau daftar migrasi yang diterapkan. Tambahkan custom domain di *Settings → Domains*.
5. Supabase → **Authentication → URL Configuration** → *Site URL* = domain Anda.
6. Daftarkan `https://domain-anda.com/sitemap.xml` di Google Search Console, dan lengkapi Google Business Profile.

Region fungsi server diset ke **Singapore (`sin1`)** lewat `vercel.json` agar dekat dengan database Supabase (Singapore) — setiap query jauh lebih cepat dibanding region default AS.

Netlify / hosting Node lain juga bisa (`npm run build` + `npm start`, Node 20.12+).

## 12. Keamanan, SEO, performa

**Keamanan**
- Supabase Auth (cookie httpOnly via `@supabase/ssr`), middleware memproteksi `/admin`, setiap server action mengecek role, dan RLS di database sebagai lapisan kedua.
- Validasi input Zod di server untuk semua form & CRUD admin; validasi file (MIME, ukuran, jumlah, *magic bytes*), nama file acak.
- Rate limiting (form publik, login, tracking), honeypot anti-spam, cek same-origin, security headers.
- Secret (`SUPABASE_SERVICE_ROLE_KEY`, Google key, email key) hanya di server — tidak pernah dikirim ke browser.
- Rate limiter bawaan bersifat in-memory per instance; untuk trafik besar gunakan Upstash Redis / Vercel KV.

**SEO**
- Metadata per halaman (title, description, canonical), Open Graph & Twitter Card, OG image dinamis.
- Structured data: `FurnitureStore` (LocalBusiness), `Product`, `Review`, `BreadcrumbList`.
- `sitemap.xml`, `robots.txt`, `lang="id"`, keyword lokal ("Kitchen Set Bandung", dll.) secara natural tanpa stuffing; kota diambil dari Admin → Pengaturan.

**Performa**
- SSR + ISR (revalidate 1–5 menit, langsung revalidate saat admin menyimpan), `next/image` (AVIF/WebP, responsive, lazy), code splitting per route, font self-hosted, video YouTube/Vimeo dimuat setelah diklik (facade), slider lazy.
- Target Lighthouse > 90. Setelah mengganti placeholder, gunakan foto ≤ 2000 px agar tetap ringan.

## 13. PWA

- `app/manifest.ts` → `/manifest.webmanifest`: nama & deskripsi dari Pengaturan Website, ikon 192/512 + maskable, shortcut Kalkulator/Katalog/Kontak.
- `app/sw.js/route.ts` (sumber: `pwa/sw.template.js`) — service worker (aktif di production). Versinya otomatis mengikuti commit Git setiap deploy, sehingga HP/PC yang sudah meng-install aplikasi mendeteksi versi baru (dicek saat aplikasi dibuka & tiap 15 menit) dan menampilkan bar **"Versi terbaru website tersedia → Muat ulang"**. Halaman *network-first* (konten admin selalu terbaru saat online, halaman yang pernah dibuka tetap bisa dilihat offline), aset `/_next/static` *cache-first*, gambar & font *stale-while-revalidate*. `/admin`, `/api`, dan domain lain (Supabase, YouTube) tidak pernah di-cache. Fallback offline: `/offline`.
- Kartu "Install aplikasi" muncul otomatis di browser yang mendukung (Chrome/Edge/Android). Jika ditolak, kartu tidak muncul lagi selama 30 hari. Di iPhone: Safari → Share → *Add to Home Screen*.
- Mengganti logo PWA: ganti `app/icon.svg`, jalankan `npm run icons`, lalu deploy.

### Realtime
- **Website:** saat admin menyimpan konten (produk, harga, section homepage, FAQ, pengaturan, dll.), halaman yang sedang dibuka pengunjung ikut diperbarui otomatis dalam ±2 detik tanpa reload (Supabase Realtime + refresh data server). Koneksi hanya aktif saat tab terlihat.
- **Admin:** lead baru (request survey, pesan kontak, customer submission) memunculkan notifikasi dan memperbarui badge menu secara langsung.
- Diaktifkan oleh migrasi `20261022000400_realtime.sql`; RLS tetap berlaku (pengunjung tidak menerima data lead).

## 14. Uji end-to-end

```bash
npm run build && npm start                         # terminal 1
npm run verify -- --site http://localhost:3000     # terminal 2
```
Script membuat user editor sementara, lalu menguji **insert → update → read → delete** di semua tabel konten. Script juga memastikan anon tidak bisa menulis konten, membaca lead, atau menaikkan role; menguji upload & hapus file storage; membuka semua halaman publik; dan mengirim form survey lewat API. Semua data uji dibersihkan otomatis. Termasuk uji penjualan (simpan order via RPC, akurasi total/sisa/laba, nomor order, laporan, akses publik ditolak, hapus cascade). Hasil terakhir: **78 lulus, 0 gagal**.

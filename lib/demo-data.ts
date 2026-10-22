/**
 * Data awal (seed). Dipakai untuk:
 *  1. men-generate supabase/seed.sql (npm run seed:sql)
 *  2. fallback "mode demo" di server saat Supabase belum dikonfigurasi,
 *     agar website tetap bisa dipreview. Begitu env Supabase diisi,
 *     semua data (termasuk harga kalkulator) dibaca dari database.
 *
 * File ini hanya di-import oleh kode server (services/*).
 */
import type {
  Category,
  DucoColor,
  Faq,
  Feature,
  Hardware,
  HomeSection,
  HplColor,
  Material,
  PortfolioItem,
  PriceSetting,
  Product,
  Review,
  SiteSettings,
  Video,
} from "../types/index.ts";

const uid = (prefix: string, n: number) => `00000000-0000-4000-8${prefix}-${String(n).padStart(12, "0")}`;
const img = (name: string) => `/placeholders/${name}.svg`;
const now = "2026-10-01T00:00:00.000Z";

export const demoSettings: SiteSettings = {
  business_name: "Kayuna Interior",
  tagline: "Custom Furniture & Kitchen Set Bandung",
  description:
    "Workshop custom furniture dan kitchen set di Bandung. Desain modern, material berkualitas, dan harga transparan sejak hari pertama konsultasi.",
  logo_url: null,
  address: "Jl. Contoh Raya No. 123, Bandung, Jawa Barat",
  city: "Bandung",
  whatsapp_number: "6281234567890",
  email: "halo@contoh-furniture.com",
  notification_email: "admin@contoh-furniture.com",
  instagram_url: "https://instagram.com/",
  facebook_url: "https://facebook.com/",
  tiktok_url: "https://tiktok.com/",
  youtube_url: "https://youtube.com/",
  google_maps_url: "https://maps.app.goo.gl/hbrsjzTrYgMLddL39",
  google_maps_embed_query: "Bandung, Jawa Barat",
  google_place_id: null,
  opening_hours: "Senin – Sabtu, 08.00 – 17.00 WIB",
  hero_title: "Custom Furniture & Kitchen Set\nSesuai Ruang, Sesuai Gaya Anda.",
  hero_subtitle:
    "Kitchen set dan furniture custom dengan desain modern, material berkualitas, dan harga transparan.",
  hero_image_url: img("island-1"),
  hero_video_url: null,
  cta_primary_label: "Hitung Harga",
  cta_secondary_label: "Lihat Katalog",
  footer_text: "Custom furniture & kitchen set premium untuk rumah, apartemen, dan ruang komersial.",
  about_title: "Dirancang presisi, dibuat dengan tangan berpengalaman.",
  about_content:
    "Kami adalah workshop custom furniture yang berfokus pada kitchen set, wardrobe, dan interior built-in. Setiap proyek dimulai dari survei dan pengukuran, dilanjutkan desain 3D, produksi di workshop sendiri, hingga instalasi rapi di lokasi.\n\nKami percaya furniture yang baik itu jujur: material jelas, harga transparan, dan hasil yang awet bertahun-tahun.",
  manual_rating: 4.9,
  manual_review_count: 5,
  whatsapp_default_message: "Halo, saya ingin konsultasi custom furniture.",
  announcement_text: null,
  announcement_url: null,
  hero_card_title: "Harga transparan per meter",
  hero_card_text: "Mulai dari",
  cta_eyebrow: "Konsultasi Gratis",
  cta_title: "Siap mewujudkan ruang impian Anda?",
  cta_text: "Ceritakan kebutuhan Anda. Tim kami membantu dari desain, pemilihan material, hingga estimasi biaya.",
  about_image_url: img("wardrobe-2"),
  about_image_2_url: img("kitchen-4"),
};

export const demoCategories: Category[] = [
  ["Kitchen Set", "kitchen-set", "kitchen-1"],
  ["Kitchen Island", "kitchen-island", "island-1"],
  ["Wardrobe", "wardrobe", "wardrobe-1"],
  ["TV Cabinet", "tv-cabinet", "tv-1"],
  ["Lemari", "lemari", "wardrobe-3"],
  ["Meja", "meja", "table-1"],
  ["Rak", "rak", "shelf-1"],
  ["Bathroom Cabinet", "bathroom-cabinet", "bathroom-1"],
  ["Custom Furniture", "custom-furniture", "living-1"],
  ["Interior", "interior", "office-1"],
  ["Lainnya", "lainnya", "shelf-2"],
].map(([name, slug, image], i) => ({
  id: uid("001", i + 1),
  name,
  slug,
  description: null,
  image_url: img(image),
  show_on_home: !["kitchen-island", "bathroom-cabinet", "rak", "lainnya"].includes(slug),
  sort_order: i + 1,
  is_active: true,
}));

const cat = (slug: string) => demoCategories.find((c) => c.slug === slug)!.id;

export const demoMaterials: Material[] = [
  {
    id: uid("002", 1),
    name: "HPL",
    slug: "hpl",
    description: "High Pressure Laminate — tahan gores, mudah dibersihkan, ratusan pilihan motif.",
    price_per_meter: 2200000,
    image_url: img("swatch-wood"),
    sort_order: 1,
    is_active: true,
  },
  {
    id: uid("002", 2),
    name: "Cat Duco",
    slug: "cat-duco",
    description: "Finishing cat semprot berlapis dengan hasil mulus, warna bebas, glossy/matte/satin.",
    price_per_meter: 2800000,
    image_url: img("swatch-solid"),
    sort_order: 2,
    is_active: true,
  },
  {
    id: uid("002", 3),
    name: "Veneer Kayu",
    slug: "veneer",
    description: "Lapisan kayu asli untuk tampilan natural premium.",
    price_per_meter: 3200000,
    image_url: img("swatch-wood"),
    sort_order: 3,
    is_active: true,
  },
];

const mat = (slug: string) => demoMaterials.find((m) => m.slug === slug)!.id;

type ProductSeed = [string, string, string, string, string, string, number, string[], string];
const productSeeds: ProductSeed[] = [
  ["Kitchen Set Minimalis Modern", "kitchen-set", "hpl", "Standard", "300 x 60 x 240 cm", "Kitchen set L-shape dengan kabinet atas & bawah, handle aluminium tersembunyi, dan backsplash keramik.", 6600000, ["kitchen-1", "kitchen-2", "kitchen-3"], "Oak Natural, Putih Doff"],
  ["Kitchen Set Duco Putih Glossy", "kitchen-set", "cat-duco", "Premium", "350 x 60 x 240 cm", "Kabinet cat duco putih glossy, engsel soft closing, dan top table quartz.", 12500000, ["kitchen-2", "kitchen-4"], "Pure White Glossy"],
  ["Kitchen Island Walnut", "kitchen-island", "hpl", "Premium", "180 x 90 x 90 cm", "Kitchen island dengan laci besar, area duduk, dan top marmer.", 14800000, ["island-1", "island-2", "island-3"], "Walnut, Marmer Carrara"],
  ["Wardrobe Sliding 4 Pintu", "wardrobe", "hpl", "Standard", "240 x 60 x 260 cm", "Lemari pakaian sliding dengan rel aluminium senyap, gantungan, dan laci internal.", 9800000, ["wardrobe-1", "wardrobe-2"], "Light Oak"],
  ["Walk-in Wardrobe Charcoal", "wardrobe", "cat-duco", "Premium", "300 x 60 x 270 cm", "Walk-in wardrobe duco charcoal matte dengan lampu LED sensor.", 18900000, ["wardrobe-3", "wardrobe-2"], "Charcoal Matte"],
  ["TV Cabinet Floating", "tv-cabinet", "hpl", "Standard", "200 x 40 x 45 cm", "Rak TV gantung dengan backdrop panel kisi kayu dan laci soft closing.", 5400000, ["tv-1", "tv-2", "tv-3"], "Teak, Hitam Doff"],
  ["Lemari Serbaguna 3 Pintu", "lemari", "hpl", "Standard", "150 x 50 x 200 cm", "Lemari penyimpanan dengan rak adjustable untuk ruang keluarga atau kamar.", 4600000, ["wardrobe-2", "shelf-3"], "Putih, Oak"],
  ["Meja Makan Solid Top", "meja", "veneer", "Premium", "180 x 90 x 75 cm", "Meja makan 6 kursi dengan top veneer kayu jati dan kaki besi powder coating.", 7200000, ["table-1", "table-2", "table-3"], "Jati Natural"],
  ["Rak Display Minimalis", "rak", "hpl", "Standard", "120 x 35 x 200 cm", "Rak buku/display terbuka dengan kombinasi kabinet tertutup.", 3500000, ["shelf-1", "shelf-2"], "Walnut"],
  ["Bathroom Vanity Cabinet", "bathroom-cabinet", "hpl", "Premium", "100 x 50 x 85 cm", "Kabinet wastafel tahan lembap dengan top solid surface dan cermin.", 4900000, ["bathroom-1", "bathroom-2", "bathroom-3"], "Sage Green"],
  ["Meja Kerja Home Office", "meja", "hpl", "Standard", "160 x 60 x 75 cm", "Meja kerja dengan rak dinding dan manajemen kabel tersembunyi.", 3800000, ["office-1", "office-2"], "Oak, Putih"],
  ["Custom Built-in Living Room", "custom-furniture", "cat-duco", "Custom", "Sesuai ruang", "Built-in cabinet ruang keluarga sesuai ukuran dan desain Anda.", 15000000, ["living-1", "living-2", "living-3"], "Custom"],
];

export const demoProducts: Product[] = productSeeds.map(
  ([name, category, material, finishing, dimensions, description, price, images, colors], i) => ({
    id: uid("003", i + 1),
    name,
    slug: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    category_id: cat(category),
    material_id: mat(material),
    description,
    finishing,
    colors: colors.split(",").map((c) => c.trim()),
    dimensions,
    price_estimate: price,
    images: images.map(img),
    video_url: i === 0 ? "https://www.youtube.com/watch?v=MMXmH1M1LYU" : null,
    status: "published",
    is_featured: i < 6,
    view_count: [128, 96, 74, 88, 41, 65, 22, 37, 19, 28, 15, 33][i] ?? 0,
    inquiry_count: [14, 9, 6, 8, 3, 5, 1, 4, 1, 2, 1, 3][i] ?? 0,
    created_at: now,
  }),
);

type HplSeed = [string, string, string, HplColor["category"], string, string?];
const hplSeeds: HplSeed[] = [
  ["Natural Oak", "TH-001", "Taco", "Wood", "#C9A27E", "swatch-wood"],
  ["Walnut Brown", "TH-118", "Taco", "Wood", "#7C5433", "swatch-wood"],
  ["Teak Classic", "AC-2210", "Aica", "Wood", "#A87444", "swatch-wood"],
  ["Pure White", "TH-900", "Taco", "Solid", "#F7F6F2"],
  ["Warm Grey", "LC-5521", "Lamitak", "Solid", "#9B958C"],
  ["Carrara Marble", "AC-8801", "Aica", "Marble", "#EEECE8", "swatch-marble"],
  ["Concrete Stone", "LC-7710", "Lamitak", "Stone", "#A6A29B"],
  ["Linen Pattern", "TH-430", "Taco", "Pattern", "#E3D8C3"],
  ["Charcoal Matte", "AC-1990", "Aica", "Matte", "#3A3A3A"],
  ["Cream Glossy", "TH-955G", "Taco", "Glossy", "#F1E7D2"],
  ["Sage Matte", "LC-6420", "Lamitak", "Matte", "#8C9A84"],
];

export const demoHplColors: HplColor[] = hplSeeds.map(([name, code, brand, category, hex, swatch], i) => ({
  id: uid("004", i + 1),
  name,
  code,
  brand,
  category,
  hex,
  image_url: swatch ? img(swatch) : null,
  sort_order: i + 1,
  is_active: true,
}));

type DucoSeed = [string, string, DucoColor["category"], DucoColor["finish"], string];
const ducoSeeds: DucoSeed[] = [
  ["Snow White", "DC-W01", "White", "Glossy", "#FBFBF8"],
  ["Ivory Cream", "DC-C02", "Cream", "Satin", "#F2E8D5"],
  ["Latte", "DC-C05", "Cream", "Matte", "#D9C4A3"],
  ["Dove Grey", "DC-G03", "Grey", "Matte", "#B4B1AA"],
  ["Slate Grey", "DC-G08", "Grey", "Satin", "#6B6E70"],
  ["Jet Black", "DC-B01", "Black", "Glossy", "#1C1C1C"],
  ["Olive Green", "DC-GR4", "Green", "Matte", "#6E7F5E"],
  ["Navy Blue", "DC-BL2", "Blue", "Satin", "#2D3B55"],
  ["Mocha Brown", "DC-BR6", "Brown", "Matte", "#6F4E37"],
  ["Terracotta Custom", "DC-CU1", "Custom Color", "Satin", "#B5654A"],
];

export const demoDucoColors: DucoColor[] = ducoSeeds.map(([name, code, category, finish, hex], i) => ({
  id: uid("005", i + 1),
  name,
  code,
  category,
  finish,
  hex,
  image_url: null,
  sort_order: i + 1,
  is_active: true,
}));

export const demoHardware: Hardware[] = [
  ["Standard", "Engsel & rel standar berkualitas", 0, "per_meter", true],
  ["Soft Closing", "Engsel & rel soft closing — menutup pelan tanpa bunyi", 350000, "per_meter", true],
  ["Premium", "Hardware premium (Blum/Hettich atau setara) full soft closing", 750000, "per_meter", true],
  ["Handle Aluminium Profil", "Handle tersembunyi aluminium per meter", 150000, "per_meter", false],
  ["Rak Piring Stainless", "Rak piring stainless tarik untuk kabinet atas", 850000, "fixed", false],
].map(([name, description, price, price_unit, is_calculator_option], i) => ({
  id: uid("006", i + 1),
  name: name as string,
  description: description as string,
  price: price as number,
  price_unit: price_unit as Hardware["price_unit"],
  is_calculator_option: is_calculator_option as boolean,
  sort_order: i + 1,
  is_active: true,
}));

type PriceSeed = [PriceSetting["group"], string, number, PriceSetting["unit"], string | null, PriceSetting["meta"]?];
const priceSeeds: PriceSeed[] = [
  // Jenis produk: price = pengali harga material, standard_height = tinggi standar (m)
  ["product_type", "Kitchen Set", 1, "multiplier", "Harga per meter lari (kabinet atas + bawah)", { standard_height: 2.4 }],
  ["product_type", "Lemari", 1, "multiplier", "Tinggi standar 2 m", { standard_height: 2 }],
  ["product_type", "Wardrobe", 1.1, "multiplier", "Tinggi standar 2.4 m", { standard_height: 2.4 }],
  ["product_type", "TV Cabinet", 0.8, "multiplier", "Tinggi standar 0.6 m", { standard_height: 0.6 }],
  ["product_type", "Meja", 0.7, "multiplier", "Tinggi standar 0.75 m", { standard_height: 0.75 }],
  ["product_type", "Custom Furniture", 1, "multiplier", "Tinggi standar 2.4 m", { standard_height: 2.4 }],
  // Finishing: persen dari biaya material
  ["finishing", "Standard", 0, "percent", "Finishing standar"],
  ["finishing", "Premium", 15, "percent", "Detail list, edging premium, finishing lebih halus"],
  ["finishing", "Custom", 25, "percent", "Detail custom sesuai desain"],
  // Top table: rupiah per meter panjang
  ["top_table", "Tidak ada", 0, "per_meter", null],
  ["top_table", "Granit", 1500000, "per_meter", null],
  ["top_table", "Marmer", 2500000, "per_meter", null],
  ["top_table", "Quartz", 3500000, "per_meter", null],
  ["top_table", "Solid Surface", 2800000, "per_meter", null],
  ["top_table", "Custom", 0, "per_meter", "Harga dikonfirmasi saat konsultasi"],
  // Aksesoris: rupiah per item
  ["accessory", "Kitchen Island", 8000000, "fixed", "Island standar 150 cm"],
  ["accessory", "Rak", 750000, "fixed", null],
  ["accessory", "Laci tambahan", 450000, "fixed", null],
  ["accessory", "Lampu LED", 650000, "fixed", "LED strip + sensor"],
  ["accessory", "Aksesoris", 1000000, "fixed", "Rak bumbu, tempat sendok, dll."],
  ["accessory", "Custom", 0, "fixed", "Harga dikonfirmasi saat konsultasi"],
  // Biaya tambahan otomatis (0 = gratis)
  ["additional", "Survey, pengiriman & instalasi (area Bandung)", 0, "fixed", "Gratis area Bandung"],
];

export const demoPriceSettings: PriceSetting[] = priceSeeds.map(([group, name, price, unit, description, meta], i) => ({
  id: uid("007", i + 1),
  group,
  name,
  price,
  unit,
  description,
  meta: meta ?? {},
  sort_order: i + 1,
  is_active: true,
}));

type PortfolioSeed = [string, PortfolioItem["category"], string, number, string, string, string[]];
const portfolioSeeds: PortfolioSeed[] = [
  ["Kitchen Set Rumah Dago", "Kitchen Set", "Dago, Bandung", 2026, "HPL Oak + Top Granit", "Kitchen set L-shape dengan kabinet atas full ke plafon.", ["kitchen-1", "kitchen-3"]],
  ["Apartemen Gateway Pasteur", "Residential", "Pasteur, Bandung", 2026, "HPL Putih Doff", "Full interior apartemen tipe 2BR: kitchen, wardrobe, TV cabinet.", ["living-2", "kitchen-4"]],
  ["Wardrobe Kamar Utama Setiabudi", "Wardrobe", "Setiabudi, Bandung", 2025, "Duco Charcoal", "Wardrobe 3 meter dengan pintu sliding dan LED sensor.", ["wardrobe-3", "wardrobe-1"]],
  ["Kantor Startup Braga", "Office", "Braga, Bandung", 2025, "HPL Walnut", "Meja kerja, rak arsip, dan pantry untuk 20 karyawan.", ["office-1", "office-2", "office-3"]],
  ["Kafe Riau Street", "Commercial", "Jl. Riau, Bandung", 2025, "Veneer Jati", "Bar counter dan rak display kafe.", ["shelf-2", "table-2"]],
  ["Kitchen Island Ciumbuleuit", "Kitchen Set", "Ciumbuleuit, Bandung", 2026, "Duco Sage + Quartz", "Kitchen island dengan area makan 4 kursi.", ["island-2", "island-3"]],
  ["TV Cabinet Antapani", "Furniture", "Antapani, Bandung", 2025, "HPL Teak", "Backdrop TV kisi kayu dan rak gantung.", ["tv-2", "tv-3"]],
  ["Rumah Tinggal Arcamanik", "Residential", "Arcamanik, Bandung", 2024, "HPL & Duco", "Kitchen set, lemari, dan vanity kamar mandi.", ["kitchen-5", "bathroom-2"]],
  ["Klinik Kecantikan Buah Batu", "Commercial", "Buah Batu, Bandung", 2024, "Duco Putih Glossy", "Meja resepsionis dan kabinet treatment.", ["office-3", "shelf-3"]],
  ["Meja Makan Keluarga Cimahi", "Furniture", "Cimahi", 2024, "Veneer Jati", "Meja makan 8 kursi dengan top veneer jati.", ["table-3", "table-1"]],
];

export const demoPortfolio: PortfolioItem[] = portfolioSeeds.map(
  ([title, category, location, year, material, description, images], i) => ({
    id: uid("008", i + 1),
    title,
    slug: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    category,
    location,
    year,
    material,
    description,
    images: images.map(img),
    video_url: null,
    source: "admin",
    is_published: true,
    sort_order: i + 1,
  }),
);

// Video contoh dari YouTube — GANTI dengan video milik bisnis Anda melalui Admin → Video.
export const demoVideos: Video[] = [
  ["Proses Pembuatan Kitchen Set HPL", "Proses", "https://www.youtube.com/watch?v=MMXmH1M1LYU"],
  ["Kitchen Set Minimalis Multiplek HPL", "Project", "https://www.youtube.com/watch?v=Y1Mx1cH-e74"],
  ["Desain Kitchen Set Finishing HPL", "Inspirasi", "https://www.youtube.com/watch?v=1UIIaYoYgQs"],
  ["Pemasangan Kabinet Bawah", "Proses", "https://www.youtube.com/watch?v=8V5cgb3s5_g"],
  ["Kitchen Set Finishing HPL & Duco", "Project", "https://www.youtube.com/watch?v=7E-XCOMi8Qc"],
].map(([title, category, video_url], i) => ({
  id: uid("009", i + 1),
  title,
  description: "Video contoh — ganti dengan video project Anda dari Admin Panel.",
  category,
  video_url,
  thumbnail_url: null,
  source: "youtube",
  is_published: true,
  sort_order: i + 1,
}));

// Review manual CONTOH (fallback). Bukan review Google live.
export const demoReviews: Review[] = [
  ["Rina A.", 5, "Kitchen set-nya rapi banget, sesuai desain 3D. Tim datang tepat waktu dan instalasi bersih.", "2026-09-12"],
  ["Budi S.", 5, "Harga transparan dari awal, tidak ada biaya tersembunyi. Wardrobe duco-nya mulus.", "2026-08-28"],
  ["Dewi K.", 5, "Konsultasi via WhatsApp responsif, dibantu pilih HPL yang cocok. Hasilnya memuaskan.", "2026-08-03"],
  ["Andi P.", 4, "Kualitas material bagus, pengerjaan sedikit mundur karena hujan tapi dikomunikasikan dengan baik.", "2026-07-19"],
  ["Sari M.", 5, "TV cabinet dan backdrop-nya jadi pusat perhatian ruang keluarga. Recommended!", "2026-06-30"],
].map(([author_name, rating, content, review_date], i) => ({
  id: uid("010", i + 1),
  author_name: author_name as string,
  author_photo_url: null,
  rating: rating as number,
  content: content as string,
  review_date: review_date as string,
  source: "manual",
  is_published: true,
  sort_order: i + 1,
}));

// Section homepage — urutan, visibilitas, dan teks diatur di Admin → Landing Page.
export const demoHomeSections: HomeSection[] = (
  [
    ["categories", "Layanan Kami", "Furniture custom untuk setiap ruang", null, "Semua Katalog", "/katalog", 7],
    ["featured_products", "Katalog", "Produk pilihan", "Desain favorit customer kami. Semua ukuran dan warna bisa disesuaikan.", "Lihat Katalog", "/katalog", 8],
    ["calculator", "Harga Transparan", "Hitung estimasi biaya dalam 1 menit", "Pilih jenis furniture, material, ukuran, dan opsi tambahan. Kalkulator kami langsung menampilkan rincian biaya — tanpa perlu menunggu penawaran.", "Hitung Estimasi Harga", "/kalkulator", 3],
    ["portfolio", "Portfolio", "Hasil pekerjaan kami", null, "Lihat Portfolio", "/portfolio", 6],
    ["videos", "Video", "Lihat proses & hasil kerja", null, "Semua Video", "/video", 2],
    ["reviews", "Review Customer", "Apa kata customer kami", null, "Lihat Semua Review", "/review", 6],
    ["advantages", "Kenapa Kami", "Dikerjakan serius, dari survei sampai instalasi", null, null, null, 6],
    ["faq", "FAQ", "Pertanyaan yang sering diajukan", "Belum menemukan jawaban? Tanyakan langsung lewat WhatsApp.", "Tanya via WhatsApp", null, 8],
    ["cta", null, null, null, null, null, 1],
  ] as const
).map(([key, eyebrow, title, description, cta_label, cta_url, item_limit], i) => ({
  id: uid("011", i + 1),
  key,
  eyebrow,
  title,
  description,
  cta_label,
  cta_url,
  item_limit,
  sort_order: i + 1,
  is_active: true,
}));

export const demoFeatures: Feature[] = (
  [
    ["hero_stat", "star", "Rating", null, null],
    ["hero_stat", "shield-check", "Garansi", null, "1 Thn"],
    ["hero_stat", "ruler", "Survey", null, "Gratis"],
    ["process", "pencil-ruler", "Konsultasi & Survey", "Diskusi kebutuhan dan pengukuran lokasi gratis.", null],
    ["process", "box", "Desain 3D", "Visual 3D realistis sebelum produksi dimulai.", null],
    ["process", "hammer", "Produksi Workshop", "Dikerjakan tukang berpengalaman dengan mesin presisi.", null],
    ["process", "truck", "Instalasi Rapi", "Pemasangan bersih, tepat waktu, bergaransi.", null],
    ["advantage", "shield-check", "Garansi Pengerjaan", "Garansi konstruksi & hardware untuk ketenangan Anda.", null],
    ["advantage", "award", "Material Berkualitas", "Multiplek, HPL & cat duco pilihan dari brand terpercaya.", null],
    ["advantage", "calculator", "Harga Transparan", "Rincian biaya jelas sejak awal, tanpa biaya tersembunyi.", null],
    ["about_value", "hammer", "Workshop sendiri", "Produksi dikontrol penuh untuk kualitas & ketepatan waktu.", null],
    ["about_value", "award", "Material bergaransi", "Multiplek, HPL, cat duco, dan hardware dari brand terpercaya.", null],
    ["about_value", "users", "Tim berpengalaman", "Desainer, tukang, dan installer yang berpengalaman.", null],
    ["about_value", "leaf", "Rapi & bertanggung jawab", "Area kerja bersih dan layanan purna jual.", null],
  ] as const
).map(([section, icon, title, description, value], i) => ({
  id: uid("012", i + 1),
  section,
  icon,
  title,
  description,
  value,
  sort_order: i + 1,
  is_active: true,
}));

export const demoFaqs: Faq[] = [
  ["Berapa lama pengerjaan kitchen set?", "Rata-rata 3–5 minggu setelah desain disetujui dan DP diterima, tergantung ukuran dan finishing. Cat duco umumnya butuh waktu lebih lama dibanding HPL karena proses pengecatan berlapis."],
  ["Apakah survey dan pengukuran dikenakan biaya?", "Survey dan pengukuran gratis untuk area kota kami. Untuk luar kota, biaya transport dikonfirmasi lebih dulu sebelum jadwal survey."],
  ["Apa beda finishing HPL dan cat duco?", "HPL adalah lapisan laminasi yang tahan gores dan mudah dirawat dengan pilihan motif kayu, marmer, dan solid. Cat duco memberi tampilan mulus tanpa sambungan dengan warna bebas, cocok untuk desain modern dan klasik."],
  ["Apakah harga di kalkulator sudah final?", "Kalkulator memberi estimasi berdasarkan harga per meter terbaru. Harga final ditentukan setelah survey, karena ukuran detail, kondisi dinding, dan pilihan aksesoris bisa memengaruhi biaya."],
  ["Bagaimana sistem pembayarannya?", "Umumnya DP 50% saat desain disetujui, 40% sebelum pengiriman, dan 10% setelah instalasi selesai. Detailnya tertulis di surat penawaran."],
  ["Apakah ada garansi?", "Ya. Kami memberi garansi konstruksi dan hardware. Jika ada kendala setelah instalasi, cukup hubungi kami lewat WhatsApp."],
].map(([question, answer], i) => ({ id: uid("013", i + 1), question, answer, sort_order: i + 1, is_active: true }));

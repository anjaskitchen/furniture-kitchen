import { FEATURE_ICONS } from "../feature-icons";

/**
 * Konfigurasi CRUD admin (data murni — aman dikirim ke client).
 * Satu ResourceManager generik + server action generik melayani semua tabel ini,
 * sehingga menambah tabel/field baru cukup di file ini.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "select"
  | "boolean"
  | "image"
  | "images"
  | "video"
  | "url"
  | "tags"
  | "date"
  | "color"
  | "slug"
  | "height_meta";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Ambil opsi select dari data dinamis yang dikirim halaman (mis. kategori). */
  optionsKey?: string;
  help?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  default?: string | number | boolean | null;
  /** Lebar penuh di grid form */
  full?: boolean;
  /** Field slug otomatis dibuat dari field ini jika kosong */
  from?: string;
  /** Folder storage untuk upload */
  folder?: string;
}

export interface ColumnDef {
  name: string;
  label: string;
  type?: "text" | "money" | "boolean" | "image" | "badge" | "date" | "color" | "percent_or_money" | "rating";
  /** Tampilkan label yang lebih ramah untuk nilai tertentu (mis. key section). */
  labels?: Record<string, string>;
}

export interface ResourceDef {
  key: string;
  table: string;
  title: string;
  singular: string;
  description?: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  orderBy: { column: string; ascending: boolean }[];
  searchable: string[];
  /** Kolom boolean yang bisa di-toggle langsung dari tabel (aktif/publish). */
  toggle?: { name: string; on: string; off: string };
  filter?: { name: string; label: string; options: { value: string; label: string }[] };
  canCreate?: boolean;
  canDelete?: boolean;
  /** Tampilkan tombol naik/turun untuk mengubah sort_order langsung dari tabel. */
  reorderable?: boolean;
  revalidate: string[];
}

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export const HPL_CATS = ["Wood", "Solid", "Marble", "Stone", "Pattern", "Matte", "Glossy"] as const;
export const DUCO_CATS = ["White", "Cream", "Grey", "Black", "Green", "Blue", "Brown", "Custom Color"] as const;
export const PORTFOLIO_CATS = ["Kitchen Set", "Wardrobe", "Furniture", "Office", "Residential", "Commercial"] as const;
export const PRICE_GROUPS = [
  { value: "product_type", label: "Jenis Produk" },
  { value: "finishing", label: "Finishing" },
  { value: "top_table", label: "Top Table" },
  { value: "accessory", label: "Aksesoris" },
  { value: "additional", label: "Biaya Tambahan" },
];

export const HOME_SECTION_LABELS: Record<string, string> = {
  categories: "Kategori / Layanan",
  featured_products: "Produk Pilihan",
  calculator: "Kalkulator & Proses Kerja",
  portfolio: "Portfolio",
  videos: "Video",
  reviews: "Review Customer",
  advantages: "Keunggulan",
  faq: "FAQ",
  cta: "Ajakan Konsultasi (CTA)",
};
export const FEATURE_SECTION_OPTIONS = [
  { value: "hero_stat", label: "Statistik Hero" },
  { value: "process", label: "Proses Kerja" },
  { value: "advantage", label: "Keunggulan" },
  { value: "about_value", label: "Nilai (Tentang Kami)" },
];

const sortOrder: FieldDef = { name: "sort_order", label: "Urutan", type: "number", default: 0, min: 0, step: 1 };
const isActive: FieldDef = { name: "is_active", label: "Aktif", type: "boolean", default: true };
const isPublished: FieldDef = { name: "is_published", label: "Publish", type: "boolean", default: true };

export const RESOURCES: Record<string, ResourceDef> = {
  products: {
    key: "products",
    table: "products",
    title: "Produk",
    singular: "Produk",
    description: "Katalog produk. Foto pertama menjadi cover.",
    fields: [
      { name: "name", label: "Nama produk", type: "text", required: true, full: true },
      { name: "slug", label: "Slug URL", type: "slug", from: "name", help: "Kosongkan untuk dibuat otomatis" },
      { name: "category_id", label: "Kategori", type: "select", optionsKey: "categories", required: true },
      { name: "material_id", label: "Material", type: "select", optionsKey: "materials" },
      { name: "finishing", label: "Finishing", type: "text", placeholder: "Standard / Premium / Custom" },
      { name: "price_estimate", label: "Estimasi harga (Rp)", type: "money" },
      { name: "dimensions", label: "Dimensi", type: "text", placeholder: "300 x 60 x 240 cm" },
      { name: "colors", label: "Warna (pisahkan koma)", type: "tags", full: true },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "images", label: "Foto produk", type: "images", full: true, folder: "products" },
      { name: "video_url", label: "Video (upload / YouTube / Vimeo)", type: "video", full: true, folder: "products" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ],
        default: "published",
      },
      { name: "is_featured", label: "Tampilkan di homepage", type: "boolean", default: false },
    ],
    columns: [
      { name: "images", label: "", type: "image" },
      { name: "name", label: "Nama" },
      { name: "category_name", label: "Kategori", type: "badge" },
      { name: "price_estimate", label: "Estimasi", type: "money" },
      { name: "view_count", label: "Dilihat" },
      { name: "status", label: "Status", type: "badge" },
    ],
    orderBy: [{ column: "created_at", ascending: false }],
    searchable: ["name", "description"],
    revalidate: ["/", "/katalog"],
  },
  categories: {
    key: "categories",
    table: "categories",
    title: "Kategori",
    singular: "Kategori",
    fields: [
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", from: "name" },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "image_url", label: "Gambar", type: "image", full: true, folder: "categories" },
      { name: "show_on_home", label: "Tampil di homepage", type: "boolean", default: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "image_url", label: "", type: "image" },
      { name: "name", label: "Nama" },
      { name: "slug", label: "Slug" },
      { name: "show_on_home", label: "Homepage", type: "boolean" },
      { name: "sort_order", label: "Urutan" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["name"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    revalidate: ["/", "/katalog"],
  },
  materials: {
    key: "materials",
    table: "materials",
    title: "Material",
    singular: "Material",
    description: "Harga per meter material dipakai langsung oleh kalkulator.",
    fields: [
      { name: "name", label: "Nama material", type: "text", required: true },
      { name: "slug", label: "Slug", type: "slug", from: "name" },
      { name: "price_per_meter", label: "Harga per meter (Rp)", type: "money", required: true },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "image_url", label: "Foto", type: "image", full: true, folder: "materials" },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "image_url", label: "", type: "image" },
      { name: "name", label: "Material" },
      { name: "price_per_meter", label: "Harga / meter", type: "money" },
      { name: "sort_order", label: "Urutan" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["name"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    revalidate: ["/", "/kalkulator", "/bahan-warna", "/katalog"],
  },
  hardware: {
    key: "hardware",
    table: "hardware",
    title: "Hardware",
    singular: "Hardware",
    description: "Opsi hardware kalkulator (centang 'Opsi kalkulator').",
    fields: [
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "price", label: "Harga (Rp)", type: "money", required: true },
      {
        name: "price_unit",
        label: "Satuan harga",
        type: "select",
        options: [
          { value: "per_meter", label: "Per meter panjang" },
          { value: "fixed", label: "Harga tetap / paket" },
        ],
        default: "per_meter",
      },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "is_calculator_option", label: "Opsi kalkulator", type: "boolean", default: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "name", label: "Nama" },
      { name: "price", label: "Harga", type: "money" },
      { name: "price_unit", label: "Satuan", type: "badge" },
      { name: "is_calculator_option", label: "Kalkulator", type: "boolean" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["name"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    revalidate: ["/kalkulator"],
  },
  price_settings: {
    key: "price_settings",
    table: "price_settings",
    title: "Harga Kalkulator",
    singular: "Item Harga",
    description:
      "Jenis Produk: harga = pengali (1 = normal) + tinggi standar. Finishing: harga = persen dari material. Top Table: Rp per meter. Aksesoris: Rp per unit. Biaya Tambahan: Rp, otomatis ditambahkan.",
    fields: [
      { name: "group", label: "Grup", type: "select", options: PRICE_GROUPS, required: true },
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "price", label: "Harga / Persen / Pengali", type: "number", required: true, min: 0, step: 0.01, help: "Rupiah, persen (finishing), atau pengali (jenis produk)" },
      {
        name: "unit",
        label: "Satuan",
        type: "select",
        options: [
          { value: "per_meter", label: "Rp per meter" },
          { value: "fixed", label: "Rp tetap / unit" },
          { value: "percent", label: "Persen dari material" },
          { value: "multiplier", label: "Pengali harga material" },
        ],
        default: "fixed",
      },
      { name: "meta", label: "Tinggi standar (m) — khusus jenis produk", type: "height_meta", step: 0.05, min: 0, max: 5 },
      { name: "description", label: "Keterangan", type: "textarea", full: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "group", label: "Grup", type: "badge" },
      { name: "name", label: "Nama" },
      { name: "price", label: "Harga", type: "percent_or_money" },
      { name: "unit", label: "Satuan", type: "badge" },
    ],
    orderBy: [
      { column: "group", ascending: true },
      { column: "sort_order", ascending: true },
    ],
    searchable: ["name"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    filter: { name: "group", label: "Grup", options: PRICE_GROUPS },
    revalidate: ["/kalkulator"],
  },
  hpl_colors: {
    key: "hpl_colors",
    table: "hpl_colors",
    title: "Warna HPL",
    singular: "Warna HPL",
    fields: [
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "code", label: "Kode HPL", type: "text", required: true },
      { name: "brand", label: "Brand", type: "text" },
      { name: "category", label: "Kategori", type: "select", options: opts(HPL_CATS), default: "Wood" },
      { name: "hex", label: "Warna dasar", type: "color", default: "#D9C7A7" },
      { name: "image_url", label: "Foto sampel", type: "image", full: true, folder: "hpl" },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "hex", label: "", type: "color" },
      { name: "name", label: "Nama" },
      { name: "code", label: "Kode" },
      { name: "brand", label: "Brand" },
      { name: "category", label: "Kategori", type: "badge" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["name", "code", "brand"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    filter: { name: "category", label: "Kategori", options: opts(HPL_CATS) },
    revalidate: ["/bahan-warna"],
  },
  duco_colors: {
    key: "duco_colors",
    table: "duco_colors",
    title: "Warna Cat Duco",
    singular: "Warna Duco",
    fields: [
      { name: "name", label: "Nama", type: "text", required: true },
      { name: "code", label: "Kode warna", type: "text", required: true },
      { name: "category", label: "Kategori", type: "select", options: opts(DUCO_CATS), default: "White" },
      { name: "finish", label: "Finish", type: "select", options: opts(["Glossy", "Matte", "Satin"]), default: "Matte" },
      { name: "hex", label: "Warna", type: "color", default: "#FFFFFF" },
      { name: "image_url", label: "Foto", type: "image", full: true, folder: "duco" },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "hex", label: "", type: "color" },
      { name: "name", label: "Nama" },
      { name: "code", label: "Kode" },
      { name: "category", label: "Kategori", type: "badge" },
      { name: "finish", label: "Finish", type: "badge" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["name", "code"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    filter: { name: "category", label: "Kategori", options: opts(DUCO_CATS) },
    revalidate: ["/bahan-warna"],
  },
  portfolio: {
    key: "portfolio",
    table: "portfolio",
    title: "Portfolio",
    singular: "Project",
    fields: [
      { name: "title", label: "Nama project", type: "text", required: true, full: true },
      { name: "slug", label: "Slug", type: "slug", from: "title" },
      { name: "category", label: "Kategori", type: "select", options: opts(PORTFOLIO_CATS), default: "Kitchen Set" },
      { name: "location", label: "Lokasi", type: "text" },
      { name: "year", label: "Tahun", type: "number", min: 1990, max: 2100, step: 1 },
      { name: "material", label: "Material", type: "text" },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "images", label: "Foto project", type: "images", full: true, folder: "portfolio" },
      { name: "video_url", label: "Video (upload / YouTube / Vimeo)", type: "video", full: true, folder: "portfolio" },
      sortOrder,
      isPublished,
    ],
    columns: [
      { name: "images", label: "", type: "image" },
      { name: "title", label: "Project" },
      { name: "category", label: "Kategori", type: "badge" },
      { name: "location", label: "Lokasi" },
      { name: "year", label: "Tahun" },
      { name: "source", label: "Sumber", type: "badge" },
    ],
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "created_at", ascending: false },
    ],
    searchable: ["title", "location"],
    toggle: { name: "is_published", on: "Published", off: "Unpublished" },
    filter: { name: "category", label: "Kategori", options: opts(PORTFOLIO_CATS) },
    revalidate: ["/", "/portfolio"],
  },
  videos: {
    key: "videos",
    table: "videos",
    title: "Video",
    singular: "Video",
    fields: [
      { name: "title", label: "Judul", type: "text", required: true, full: true },
      { name: "video_url", label: "Video URL / upload", type: "video", required: true, full: true, folder: "videos", help: "YouTube, Vimeo, atau upload MP4/WebM (maks. 50 MB)" },
      { name: "thumbnail_url", label: "Thumbnail (opsional, otomatis untuk YouTube/Vimeo)", type: "image", full: true, folder: "videos" },
      { name: "category", label: "Kategori", type: "text", default: "Project" },
      {
        name: "source",
        label: "Sumber",
        type: "select",
        options: [
          { value: "youtube", label: "YouTube" },
          { value: "vimeo", label: "Vimeo" },
          { value: "upload", label: "Upload admin" },
          { value: "customer", label: "Customer" },
        ],
        default: "youtube",
      },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      sortOrder,
      isPublished,
    ],
    columns: [
      { name: "thumbnail_url", label: "", type: "image" },
      { name: "title", label: "Judul" },
      { name: "category", label: "Kategori", type: "badge" },
      { name: "source", label: "Sumber", type: "badge" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["title"],
    toggle: { name: "is_published", on: "Published", off: "Unpublished" },
    revalidate: ["/", "/video"],
  },
  reviews: {
    key: "reviews",
    table: "reviews",
    title: "Review Manual",
    singular: "Review",
    description: "Dipakai sebagai fallback jika Google Places API belum aktif, dan untuk testimoni customer yang di-approve.",
    fields: [
      { name: "author_name", label: "Nama customer", type: "text", required: true },
      { name: "rating", label: "Rating (1-5)", type: "number", min: 1, max: 5, step: 1, default: 5, required: true },
      { name: "review_date", label: "Tanggal", type: "date" },
      {
        name: "source",
        label: "Sumber",
        type: "select",
        options: [
          { value: "manual", label: "Manual" },
          { value: "google_manual", label: "Disalin dari Google" },
          { value: "customer", label: "Customer submission" },
        ],
        default: "manual",
      },
      { name: "content", label: "Isi review", type: "textarea", required: true, full: true },
      { name: "author_photo_url", label: "Foto profil", type: "image", full: true, folder: "reviews" },
      sortOrder,
      isPublished,
    ],
    columns: [
      { name: "author_name", label: "Nama" },
      { name: "rating", label: "Rating", type: "rating" },
      { name: "content", label: "Review" },
      { name: "review_date", label: "Tanggal", type: "date" },
      { name: "source", label: "Sumber", type: "badge" },
    ],
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "review_date", ascending: false },
    ],
    searchable: ["author_name", "content"],
    toggle: { name: "is_published", on: "Published", off: "Hidden" },
    revalidate: ["/", "/review"],
  },
  home_sections: {
    key: "home_sections",
    table: "home_sections",
    title: "Section Homepage",
    singular: "Section",
    description:
      "Atur urutan (panah), tampil/sembunyi (ikon mata), dan teks setiap section di homepage. Kosongkan judul untuk memakai teks bawaan.",
    canCreate: false,
    canDelete: false,
    reorderable: true,
    fields: [
      { name: "eyebrow", label: "Label kecil (eyebrow)", type: "text" },
      { name: "title", label: "Judul section", type: "text" },
      { name: "description", label: "Deskripsi", type: "textarea", full: true },
      { name: "cta_label", label: "Label tombol", type: "text" },
      { name: "cta_url", label: "Link tombol", type: "url", placeholder: "/katalog", help: "Diawali / untuk halaman website atau https://" },
      { name: "item_limit", label: "Jumlah item ditampilkan", type: "number", min: 1, max: 24, step: 1, default: 6, required: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "key", label: "Section", type: "badge", labels: HOME_SECTION_LABELS },
      { name: "title", label: "Judul" },
      { name: "item_limit", label: "Item" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["title", "key"],
    toggle: { name: "is_active", on: "Tampil", off: "Disembunyikan" },
    revalidate: ["/"],
  },
  features: {
    key: "features",
    table: "features",
    title: "Poin Konten",
    singular: "Poin",
    description:
      "Statistik di bawah hero, langkah proses kerja, keunggulan homepage, dan nilai di halaman Tentang Kami. Statistik hero memakai kolom Nilai (mis. 4.9, 1 Thn, Gratis).",
    reorderable: true,
    fields: [
      { name: "section", label: "Ditampilkan di", type: "select", options: FEATURE_SECTION_OPTIONS, required: true },
      { name: "icon", label: "Ikon", type: "select", options: [...FEATURE_ICONS], default: "sparkles", required: true },
      { name: "title", label: "Judul / label", type: "text", required: true },
      { name: "value", label: "Nilai (khusus statistik hero)", type: "text", placeholder: "1 Thn", help: "Kosongkan nilai pada statistik berikon Bintang untuk menampilkan rating review otomatis." },
      { name: "description", label: "Deskripsi singkat", type: "textarea", full: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "section", label: "Bagian", type: "badge", labels: Object.fromEntries(FEATURE_SECTION_OPTIONS.map((o) => [o.value, o.label])) },
      { name: "title", label: "Judul" },
      { name: "value", label: "Nilai" },
      { name: "description", label: "Deskripsi" },
    ],
    orderBy: [
      { column: "section", ascending: true },
      { column: "sort_order", ascending: true },
    ],
    searchable: ["title", "description"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    filter: { name: "section", label: "Bagian", options: FEATURE_SECTION_OPTIONS },
    revalidate: ["/", "/tentang"],
  },
  faqs: {
    key: "faqs",
    table: "faqs",
    title: "FAQ",
    singular: "FAQ",
    description: "Pertanyaan umum yang tampil di homepage (juga dikirim ke Google sebagai structured data FAQ).",
    reorderable: true,
    fields: [
      { name: "question", label: "Pertanyaan", type: "text", required: true, full: true },
      { name: "answer", label: "Jawaban", type: "textarea", required: true, full: true },
      sortOrder,
      isActive,
    ],
    columns: [
      { name: "question", label: "Pertanyaan" },
      { name: "answer", label: "Jawaban" },
    ],
    orderBy: [{ column: "sort_order", ascending: true }],
    searchable: ["question", "answer"],
    toggle: { name: "is_active", on: "Aktif", off: "Nonaktif" },
    revalidate: ["/"],
  },
  survey_requests: {
    key: "survey_requests",
    table: "survey_requests",
    title: "Request Survey",
    singular: "Request Survey",
    canCreate: false,
    fields: [
      {
        name: "status",
        label: "Status",
        type: "select",
        options: opts(["new", "contacted", "scheduled", "done", "cancelled"]),
      },
      { name: "preferred_date", label: "Tanggal survey", type: "date" },
      { name: "notes", label: "Catatan", type: "textarea", full: true },
    ],
    columns: [
      { name: "created_at", label: "Masuk", type: "date" },
      { name: "name", label: "Nama" },
      { name: "phone", label: "WhatsApp" },
      { name: "address", label: "Alamat" },
      { name: "furniture_type", label: "Jenis" },
      { name: "preferred_date", label: "Tgl diinginkan", type: "date" },
      { name: "estimate_total", label: "Estimasi", type: "money" },
      { name: "status", label: "Status", type: "badge" },
    ],
    orderBy: [{ column: "created_at", ascending: false }],
    searchable: ["name", "phone", "address"],
    filter: { name: "status", label: "Status", options: opts(["new", "contacted", "scheduled", "done", "cancelled"]) },
    revalidate: [],
  },
  contact_messages: {
    key: "contact_messages",
    table: "contact_messages",
    title: "Pesan Kontak",
    singular: "Pesan",
    canCreate: false,
    fields: [{ name: "status", label: "Status", type: "select", options: opts(["new", "read", "replied", "archived"]) }],
    columns: [
      { name: "created_at", label: "Masuk", type: "date" },
      { name: "name", label: "Nama" },
      { name: "phone", label: "WhatsApp" },
      { name: "email", label: "Email" },
      { name: "furniture_type", label: "Jenis" },
      { name: "estimate_total", label: "Estimasi", type: "money" },
      { name: "message", label: "Pesan" },
      { name: "status", label: "Status", type: "badge" },
    ],
    orderBy: [{ column: "created_at", ascending: false }],
    searchable: ["name", "email", "phone", "message"],
    filter: { name: "status", label: "Status", options: opts(["new", "read", "replied", "archived"]) },
    revalidate: [],
  },
};

export type ResourceKey = keyof typeof RESOURCES;

/**
 * Konstanta modul ERP (data murni — aman untuk client & server).
 * Nilai mengikuti constraint di supabase/migrations/20261114*_erp_*.sql.
 */

type Opt = { value: string; label: string; tone?: string };
const find = <T extends Opt>(list: readonly T[], v: string | null | undefined) => list.find((x) => x.value === v);
export const labelOf = (list: readonly Opt[], v: string | null | undefined) => find(list, v)?.label ?? v ?? "-";
export const toneOf = (list: readonly Opt[], v: string | null | undefined) => find(list, v)?.tone ?? "bg-charcoal-900/5 text-charcoal-700 ring-charcoal-900/10";

const T = {
  green: "bg-green-50 text-green-800 ring-green-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  orange: "bg-orange-50 text-orange-800 ring-orange-200",
  gray: "bg-charcoal-900/5 text-charcoal-700 ring-charcoal-900/10",
  navy: "bg-[#17263C]/10 text-[#17263C] ring-[#17263C]/20",
  army: "bg-[#4B5138]/10 text-[#4B5138] ring-[#4B5138]/25",
};
export const TONES = T;

export const BUDGET_CATEGORIES = [
  { value: "material", label: "Bahan baku" },
  { value: "labor", label: "Upah pekerja" },
  { value: "workshop", label: "Operasional workshop" },
  { value: "transport", label: "Transportasi" },
  { value: "installation", label: "Pemasangan" },
  { value: "utilities", label: "Listrik & utilitas" },
  { value: "marketing", label: "Pemasaran" },
  { value: "admin", label: "Administrasi" },
  { value: "contingency", label: "Cadangan tak terduga" },
  { value: "profit", label: "Laba proyek" },
] as const;
export const EXPENSE_CATEGORIES = BUDGET_CATEGORIES.filter((c) => c.value !== "profit");
/** Kategori anggaran yang dihitung dari persentase nilai kontrak (default di Pengaturan ERP). */
export const PERCENT_BUDGET_KEYS = ["workshop", "transport", "installation", "utilities", "marketing", "admin", "contingency"] as const;

export const LEDGER_CATEGORIES = [
  { value: "customer_payment", label: "Pembayaran konsumen", dir: "in" },
  { value: "capital_in", label: "Setoran modal", dir: "in" },
  { value: "other_income", label: "Pendapatan lain", dir: "in" },
  { value: "transfer_in", label: "Transfer masuk", dir: "in" },
  { value: "material_purchase", label: "Pembelian material (supplier)", dir: "out" },
  { value: "material", label: "Material langsung", dir: "out" },
  { value: "labor", label: "Tenaga kerja lepas", dir: "out" },
  { value: "salary", label: "Gaji pegawai", dir: "out" },
  { value: "employee_loan", label: "Kasbon / pinjaman pegawai", dir: "out" },
  { value: "workshop", label: "Operasional workshop", dir: "out" },
  { value: "transport", label: "Transportasi", dir: "out" },
  { value: "installation", label: "Pemasangan", dir: "out" },
  { value: "utilities", label: "Listrik & utilitas", dir: "out" },
  { value: "marketing", label: "Pemasaran", dir: "out" },
  { value: "admin", label: "Administrasi", dir: "out" },
  { value: "contingency", label: "Biaya tak terduga", dir: "out" },
  { value: "other_expense", label: "Pengeluaran lain", dir: "out" },
  { value: "owner_withdrawal", label: "Prive / ambil keuntungan", dir: "out" },
  { value: "transfer_out", label: "Transfer keluar", dir: "out" },
] as const;
/** Kategori yang boleh dipilih saat input transaksi manual (sisanya dibuat otomatis oleh sistem). */
export const MANUAL_LEDGER_CATEGORIES = LEDGER_CATEGORIES.filter(
  (c) => !["customer_payment", "material_purchase", "salary", "employee_loan", "transfer_in", "transfer_out"].includes(c.value),
);
export const LEDGER_SOURCES: Record<string, string> = {
  manual: "Manual",
  order_payment: "Pembayaran order",
  purchase_payment: "Bayar supplier",
  project_expense: "Biaya proyek",
  employee_loan: "Kasbon",
  payroll: "Gaji",
  transfer: "Transfer",
};

export const ACCOUNT_KINDS = [
  { value: "cash", label: "Kas tunai" },
  { value: "bank", label: "Rekening bank" },
  { value: "ewallet", label: "E-wallet" },
] as const;

export const PO_STATUSES = [
  { value: "draft", label: "Draft", tone: T.gray },
  { value: "ordered", label: "Dipesan", tone: T.amber },
  { value: "received", label: "Diterima", tone: T.green },
  { value: "cancelled", label: "Batal", tone: T.red },
] as const;

export const STOCK_STATUSES = [
  { value: "available", label: "Tersedia", tone: T.green },
  { value: "allocated", label: "Dialokasikan", tone: T.navy },
  { value: "partial", label: "Sebagian digunakan", tone: T.amber },
  { value: "depleted", label: "Habis digunakan", tone: T.gray },
  { value: "damaged", label: "Rusak", tone: T.red },
  { value: "returned", label: "Dikembalikan", tone: T.violet },
] as const;

export const MOVEMENT_TYPES = [
  { value: "in", label: "Barang masuk", tone: T.green, sign: 1 },
  { value: "usage", label: "Dipakai proyek", tone: T.orange, sign: -1 },
  { value: "return_from_project", label: "Sisa proyek kembali", tone: T.sky, sign: 1 },
  { value: "damaged", label: "Rusak / terbuang", tone: T.red, sign: -1 },
  { value: "return_supplier", label: "Retur ke supplier", tone: T.violet, sign: -1 },
  { value: "adjustment_plus", label: "Penyesuaian (+)", tone: T.navy, sign: 1 },
  { value: "adjustment_minus", label: "Penyesuaian (−)", tone: T.navy, sign: -1 },
] as const;
export const ADJUST_TYPES = MOVEMENT_TYPES.filter((m) => ["adjustment_plus", "adjustment_minus", "damaged", "return_supplier"].includes(m.value));

export const USAGE_KINDS = [
  { value: "used", label: "Dipakai", tone: T.orange },
  { value: "damaged", label: "Rusak / terbuang", tone: T.red },
  { value: "returned", label: "Sisa kembali ke stok", tone: T.sky },
] as const;

export const PROCUREMENT_STATUSES = [
  { value: "fulfilled", label: "Terpenuhi", tone: T.green },
  { value: "ordered", label: "Sudah dipesan", tone: T.sky },
  { value: "in_stock", label: "Ada di gudang", tone: T.navy },
  { value: "partial", label: "Sebagian", tone: T.amber },
  { value: "to_buy", label: "Perlu dibeli", tone: T.red },
  { value: "untracked", label: "Tidak dilacak", tone: T.gray },
] as const;

export const SCHEDULE_STATUSES = [
  { value: "on_track", label: "Sesuai jadwal", tone: T.green },
  { value: "near_deadline", label: "Mendekati target", tone: T.amber },
  { value: "behind", label: "Progres tertinggal", tone: T.amber },
  { value: "late", label: "Terlambat", tone: T.red },
  { value: "done", label: "Selesai", tone: T.green },
  { value: "no_schedule", label: "Belum dijadwalkan", tone: T.gray },
  { value: "cancelled", label: "Batal", tone: T.gray },
] as const;

export const INDICATORS: Record<string, { label: string; dot: string; ring: string }> = {
  green: { label: "Sesuai anggaran & jadwal", dot: "bg-green-500", ring: "ring-green-200" },
  yellow: { label: "Mendekati batas anggaran / target", dot: "bg-amber-400", ring: "ring-amber-200" },
  red: { label: "Melewati anggaran / terlambat", dot: "bg-red-500", ring: "ring-red-200" },
  gray: { label: "Tidak aktif", dot: "bg-charcoal-700/30", ring: "ring-charcoal-900/10" },
};

export const STAGE_STATUSES = [
  { value: "pending", label: "Belum mulai", tone: T.gray },
  { value: "in_progress", label: "Dikerjakan", tone: T.amber },
  { value: "done", label: "Selesai", tone: T.green },
  { value: "skipped", label: "Dilewati", tone: T.gray },
] as const;

export const EMPLOYEE_STATUSES = [
  { value: "active", label: "Aktif", tone: T.green },
  { value: "inactive", label: "Nonaktif", tone: T.gray },
  { value: "resigned", label: "Keluar", tone: T.red },
] as const;

export const PAY_TYPES = [
  { value: "daily", label: "Harian" },
  { value: "monthly", label: "Bulanan" },
  { value: "project", label: "Per proyek (borongan)" },
] as const;

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Hadir", short: "H", tone: T.green },
  { value: "leave", label: "Izin", short: "I", tone: T.sky },
  { value: "sick", label: "Sakit", short: "S", tone: T.violet },
  { value: "off", label: "Libur", short: "L", tone: T.gray },
  { value: "absent", label: "Tidak hadir", short: "A", tone: T.red },
] as const;

export const DEDUCTION_CATEGORIES = [
  { value: "rokok", label: "Pembelian rokok" },
  { value: "makan_minum", label: "Makan / minum" },
  { value: "kerusakan", label: "Ganti rugi kerusakan" },
  { value: "lainnya", label: "Potongan lainnya" },
] as const;
export const DEDUCTION_STATUSES = [
  { value: "pending", label: "Belum dipotong", tone: T.amber },
  { value: "deducted", label: "Sudah dipotong", tone: T.green },
  { value: "cancelled", label: "Dibatalkan", tone: T.gray },
] as const;

export const PAYROLL_STATUSES = [
  { value: "draft", label: "Draft", tone: T.gray },
  { value: "approved", label: "Disetujui", tone: T.amber },
  { value: "paid", label: "Dibayar", tone: T.green },
] as const;

export const PAYROLL_ITEM_CATEGORIES = [
  { value: "base", label: "Gaji pokok / upah", type: "earning" },
  { value: "incentive", label: "Insentif", type: "earning" },
  { value: "allowance", label: "Tunjangan", type: "earning" },
  { value: "commission", label: "Komisi", type: "earning" },
  { value: "project_pay", label: "Upah proyek", type: "earning" },
  { value: "overtime", label: "Lembur", type: "earning" },
  { value: "other_earning", label: "Pendapatan lain", type: "earning" },
  { value: "deduction", label: "Potongan", type: "deduction" },
  { value: "loan", label: "Cicilan kasbon", type: "deduction" },
] as const;

export const DOC_TYPES = [
  { value: "ktp", label: "KTP" },
  { value: "kk", label: "Kartu Keluarga" },
  { value: "npwp", label: "NPWP" },
  { value: "bpjs", label: "BPJS" },
  { value: "kontrak", label: "Kontrak kerja" },
  { value: "ijazah", label: "Ijazah" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export const SUPPLIER_CATEGORIES = ["Kayu & panel", "HPL & finishing", "Hardware & aksesoris", "Cat & kimia", "Kaca & aluminium", "Toko bangunan", "Lainnya"];

export const MATERIAL_UNITS = ["lembar", "pcs", "set", "kg", "liter", "kaleng", "meter", "roll", "batang", "box", "pack", "m²"];

/** Variabel formula template material (dipakai di form proyek & editor template). */
export const FORMULA_VARS = [
  { key: "panjang", label: "Panjang (m)", step: 0.01 },
  { key: "tinggi", label: "Tinggi (m)", step: 0.01 },
  { key: "kedalaman", label: "Kedalaman (m)", step: 0.01 },
  { key: "kabinet_atas", label: "Jumlah kabinet atas", step: 1 },
  { key: "kabinet_bawah", label: "Jumlah kabinet bawah", step: 1 },
  { key: "laci", label: "Jumlah laci", step: 1 },
  { key: "pintu", label: "Jumlah pintu", step: 1 },
] as const;
export const PROJECT_TEXT_SPECS = [
  { key: "material", label: "Jenis material" },
  { key: "finishing", label: "Jenis finishing" },
  { key: "aksesoris", label: "Aksesoris" },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
export const round2 = r2;
export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const fmtQty = (n: number | string | null | undefined) => num(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });

/** Ringkas spesifikasi jsonb → "Ketebalan 18 mm · Ukuran 122 x 244". */
export function specSummary(specs: Record<string, unknown> | null | undefined, defs?: { key: string; label: string; unit?: string | null }[]) {
  if (!specs) return "";
  return Object.entries(specs)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => {
      const d = defs?.find((x) => x.key === k);
      return `${d?.label ?? k.replace(/_/g, " ")} ${v}${d?.unit ? ` ${d.unit}` : ""}`;
    })
    .join(" · ");
}

/** Format Rupiah Indonesia: 6600000 → "Rp 6.600.000" */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(Number(value)))}`;
}

export function formatDateID(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

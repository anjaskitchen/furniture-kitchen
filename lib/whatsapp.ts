import { formatRupiah } from "./format";

/** Normalisasi nomor Indonesia ke format internasional tanpa "+": 0812… → 62812… */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/** WhatsApp click-to-chat dengan pre-filled message. */
export function whatsappLink(number: string | null | undefined, message: string): string {
  const phone = normalizePhone(number);
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function productInquiryMessage(productName: string, url?: string) {
  return `Halo, saya tertarik dengan ${productName}.\nSaya ingin konsultasi mengenai ukuran dan harga.${url ? `\n\n${url}` : ""}`;
}

export interface EstimateMessageData {
  productType: string;
  material: string;
  length: number;
  height?: number;
  finishing?: string | null;
  hardware?: string | null;
  topTable?: string | null;
  accessories?: string[];
  total: number;
}

export function estimateMessage(d: EstimateMessageData) {
  const lines = [
    "Halo, saya ingin konsultasi custom furniture.",
    "",
    "Jenis:",
    d.productType,
    "",
    "Material:",
    d.material,
    "",
    "Panjang:",
    `${d.length} meter`,
  ];
  if (d.height) lines.push("", "Tinggi:", `${d.height} meter`);
  if (d.finishing) lines.push("", "Finishing:", d.finishing);
  if (d.hardware) lines.push("", "Hardware:", d.hardware);
  if (d.topTable) lines.push("", "Top Table:", d.topTable);
  if (d.accessories?.length) lines.push("", "Tambahan:", d.accessories.join(", "));
  lines.push("", "Estimasi harga:", formatRupiah(d.total), "", "Mohon informasi lebih lanjut.");
  return lines.join("\n");
}

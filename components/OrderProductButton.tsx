"use client";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./icons";
import { trackInquiry } from "./ViewTracker";

export function OrderProductButton({ productId, productName, whatsapp, message, label = "Pesan Produk Ini", className = "btn-whatsapp w-full !py-4" }: {
  productId: string;
  productName: string;
  whatsapp: string | null;
  message: string;
  label?: string;
  className?: string;
}) {
  return (
    <a href={whatsappLink(whatsapp, message)} target="_blank" rel="noopener noreferrer" onClick={() => trackInquiry(productId, productName)} className={className}>
      <WhatsAppIcon size={18} /> {label}
    </a>
  );
}

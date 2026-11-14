"use client";
import { Copy, Download, MessageCircle, Monitor, Printer, Smartphone } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";

/** Cetak / simpan PDF dengan nama file = nomor invoice. */
export function PrintInvoiceButtons({ fileName, primary = true }: { fileName: string; primary?: boolean }) {
  const print = () => {
    const prev = document.title;
    document.title = fileName;
    window.print();
    setTimeout(() => (document.title = prev), 1000);
  };
  return (
    <>
      <button type="button" onClick={print} className="btn-outline btn-sm bg-white !py-2.5">
        <Printer className="h-4 w-4" /> Cetak
      </button>
      <button type="button" onClick={print} className={primary ? "btn-primary btn-sm !py-2.5" : "btn-outline btn-sm bg-white !py-2.5"} title='Pilih tujuan "Simpan sebagai PDF" pada dialog cetak'>
        <Download className="h-4 w-4" /> Simpan PDF
      </button>
    </>
  );
}

/** Kirim invoice ke konsumen lewat WhatsApp Web / aplikasi, atau salin link invoice. */
export function SendInvoiceWhatsapp({ web, app, link, text, hasPhone }: { web: string; app: string; link: string; text: string; hasPhone: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const copy = async (value: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(msg);
    } catch {
      toast("Gagal menyalin — salin manual dari kolom pesan", "error");
    }
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-whatsapp btn-sm !py-2.5" aria-expanded={open}>
        <MessageCircle className="h-4 w-4" /> Kirim ke WhatsApp
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl bg-white p-4 text-left text-sm shadow-soft ring-1 ring-charcoal-900/10">
          {!hasPhone && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Nomor WhatsApp konsumen belum diisi di order — pilih kontak penerima di WhatsApp.</p>}
          <div className="grid gap-2">
            <a href={web} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm w-full !justify-start !py-2.5" onClick={() => setOpen(false)}>
              <Monitor className="h-4 w-4" /> Buka di WhatsApp Web
            </a>
            <a href={app} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm w-full !justify-start !py-2.5" onClick={() => setOpen(false)}>
              <Smartphone className="h-4 w-4" /> Aplikasi WhatsApp (HP)
            </a>
            <button type="button" className="btn-outline btn-sm w-full !justify-start !py-2.5" onClick={() => copy(text, "Pesan invoice disalin")}>
              <Copy className="h-4 w-4" /> Salin pesan
            </button>
            {link && (
              <button type="button" className="btn-outline btn-sm w-full !justify-start !py-2.5" onClick={() => copy(link, "Link invoice disalin")}>
                <Copy className="h-4 w-4" /> Salin link invoice
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-charcoal-700/70">
            Pesan berisi ringkasan tagihan, rekening transfer, dan link invoice yang bisa dibuka konsumen tanpa login lalu disimpan sebagai PDF.
          </p>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-charcoal-700">Lihat isi pesan</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-cream-50 p-2 font-sans">{text}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

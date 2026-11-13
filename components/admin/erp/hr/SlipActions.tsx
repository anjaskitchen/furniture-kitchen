"use client";
import { Download, Printer } from "lucide-react";

/** Cetak slip, atau simpan sebagai PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF"). */
export function SlipActions({ fileName }: { fileName: string }) {
  const print = () => {
    const prev = document.title;
    document.title = fileName;
    window.print();
    setTimeout(() => (document.title = prev), 1000);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={print} className="btn-outline btn-sm bg-white !py-2.5">
        <Printer className="h-4 w-4" /> Cetak slip
      </button>
      <button type="button" onClick={print} className="btn-primary btn-sm !py-2.5" title='Pada dialog cetak, pilih tujuan "Simpan sebagai PDF"'>
        <Download className="h-4 w-4" /> Export / download PDF
      </button>
    </div>
  );
}

import { CheckCircle2 } from "lucide-react";
import { TrackedLink } from "../TrackedLink";
import { WhatsAppIcon } from "../icons";

export function FormSuccess({ title, message, whatsappHref, demo }: { title: string; message: string; whatsappHref?: string; demo?: boolean }) {
  return (
    <div className="flex flex-col items-center py-6 text-center" role="status">
      <CheckCircle2 className="h-14 w-14 text-[#1FAF38]" />
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-charcoal-700 dark:text-cream-200/70">{message}</p>
      {demo && <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">Mode demo: database belum dikonfigurasi, data tidak disimpan.</p>}
      {whatsappHref && (
        <TrackedLink event="whatsapp_click" eventParams={{ location: "form_success" }} href={whatsappHref} className="btn-whatsapp mt-6">
          <WhatsAppIcon size={18} /> Lanjutkan via WhatsApp
        </TrackedLink>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

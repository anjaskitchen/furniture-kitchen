"use client";
import { CalendarCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { whatsappLink } from "@/lib/whatsapp";
import { useToast } from "../Toast";
import { FieldError, FormSuccess } from "./FormSuccess";

export interface SurveyDefaults {
  furniture_type?: string;
  approx_size?: string;
  notes?: string;
  estimate_total?: number;
  estimate_detail?: unknown;
}

/** Request Survey: simpan database, notifikasi admin, konfirmasi, opsi WhatsApp. */
export function SurveyForm({ defaults = {}, whatsapp, furnitureTypes }: { defaults?: SurveyDefaults; whatsapp: string | null; furnitureTypes: string[] }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ demo: boolean; name: string; date: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = {
      ...data,
      ...(defaults.estimate_total ? { estimate_total: defaults.estimate_total } : {}),
      ...(defaults.estimate_detail ? { estimate_detail: JSON.stringify(defaults.estimate_detail) } : {}),
    };
    try {
      const res = await fetch("/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) setErrors(json.fieldErrors);
        toast(json.error ?? "Gagal mengirim request", "error");
        return;
      }
      trackEvent("survey_request", { furniture: data.furniture_type });
      setDone({ demo: Boolean(json.demo), name: data.name, date: data.preferred_date });
    } catch {
      toast("Koneksi bermasalah, coba lagi.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <FormSuccess
        title="Request survey diterima!"
        message={`Terima kasih ${done.name}. Kami akan mengonfirmasi jadwal survey${done.date ? ` sekitar tanggal ${done.date}` : ""} melalui WhatsApp.`}
        demo={done.demo}
        whatsappHref={whatsappLink(whatsapp, `Halo, saya ${done.name}. Saya sudah mengirim request survey${done.date ? ` untuk tanggal ${done.date}` : ""} di website.`)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <label className="label" htmlFor="s-name">Nama *</label>
        <input id="s-name" name="name" required className="input" autoComplete="name" />
        <FieldError message={errors.name} />
      </div>
      <div>
        <label className="label" htmlFor="s-phone">Nomor WhatsApp *</label>
        <input id="s-phone" name="phone" required inputMode="tel" className="input" autoComplete="tel" placeholder="08xx" />
        <FieldError message={errors.phone} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="s-address">Alamat lokasi *</label>
        <textarea id="s-address" name="address" required rows={2} className="input" autoComplete="street-address" />
        <FieldError message={errors.address} />
      </div>
      <div>
        <label className="label" htmlFor="s-date">Tanggal yang diinginkan</label>
        <input id="s-date" name="preferred_date" type="date" min={today} className="input" />
        <FieldError message={errors.preferred_date} />
      </div>
      <div>
        <label className="label" htmlFor="s-type">Jenis furniture</label>
        <select id="s-type" name="furniture_type" className="input" defaultValue={defaults.furniture_type ?? ""}>
          <option value="">Pilih...</option>
          {[...new Set([...(defaults.furniture_type ? [defaults.furniture_type] : []), ...furnitureTypes])].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="s-size">Ukuran perkiraan</label>
        <input id="s-size" name="approx_size" className="input" defaultValue={defaults.approx_size} placeholder="cth. panjang 3 m" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="s-notes">Catatan</label>
        <textarea id="s-notes" name="notes" rows={3} className="input" defaultValue={defaults.notes} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Kirim Request Survey
      </button>
    </form>
  );
}

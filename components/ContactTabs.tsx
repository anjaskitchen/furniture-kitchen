"use client";
import { CalendarCheck, Mail, PencilRuler } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ContactForm } from "./forms/ContactForm";
import { SurveyForm } from "./forms/SurveyForm";

type Tab = "form-email" | "request-survey" | "request-design";
const TABS: { id: Tab; label: string; icon: typeof Mail }[] = [
  { id: "form-email", label: "Email", icon: Mail },
  { id: "request-survey", label: "Request Survey", icon: CalendarCheck },
  { id: "request-design", label: "Request Design", icon: PencilRuler },
];

export function ContactTabs({ whatsapp, furnitureTypes, product, productId }: { whatsapp: string | null; furnitureTypes: string[]; product?: string; productId?: string }) {
  const [tab, setTab] = useState<Tab>("form-email");
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) {
        setTab(h);
        document.getElementById("contact-forms")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div id="contact-forms" className="card scroll-mt-24 p-5 sm:p-8">
      {/* anchor target untuk link #form-email, #request-survey, #request-design */}
      {TABS.map((t) => (
        <span key={t.id} id={t.id} className="block scroll-mt-28" />
      ))}
      <div className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-cream-100 p-1 dark:bg-charcoal-800" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              history.replaceState(null, "", `#${id}`);
            }}
            className={cn("flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-semibold transition sm:text-sm", tab === id ? "bg-white shadow-card dark:bg-charcoal-950" : "text-charcoal-700 dark:text-cream-200/70")}
          >
            <Icon className="hidden h-4 w-4 sm:block" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "form-email" && (
          <ContactForm
            whatsapp={whatsapp}
            furnitureTypes={furnitureTypes}
            defaults={product ? { message: `Halo, saya tertarik dengan ${product}. Saya ingin konsultasi mengenai ukuran dan harga.`, product_id: productId } : {}}
          />
        )}
        {tab === "request-survey" && <SurveyForm whatsapp={whatsapp} furnitureTypes={furnitureTypes} defaults={product ? { notes: `Tertarik dengan: ${product}` } : {}} />}
        {tab === "request-design" && (
          <ContactForm
            key="design"
            whatsapp={whatsapp}
            furnitureTypes={furnitureTypes}
            defaults={{ message: "Halo, saya ingin request desain custom. Berikut kebutuhan saya:\n- Ruangan:\n- Ukuran:\n- Gaya/warna yang disukai:\n- Budget:" }}
          />
        )}
      </div>
    </div>
  );
}

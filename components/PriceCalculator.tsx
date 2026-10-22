"use client";
import { Calculator, CalendarCheck, Info, Mail, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { calculateEstimate, EstimateError, type EstimateResult, type PricingConfig } from "@/lib/calculator";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { estimateMessage, whatsappLink } from "@/lib/whatsapp";
import { ContactForm } from "./forms/ContactForm";
import { SurveyForm } from "./forms/SurveyForm";
import { WhatsAppIcon } from "./icons";
import { Modal } from "./Modal";

export const DISCLAIMER =
  "Harga yang ditampilkan merupakan estimasi awal. Harga final dapat berubah setelah pengukuran lokasi, desain, spesifikasi material, dan kesepakatan pekerjaan.";

function Step({ n, title, children, hint }: { n: number; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="border-b border-charcoal-900/5 pb-7 last:border-0 dark:border-white/10">
      <legend className="mb-4 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-charcoal-900 text-xs font-bold text-cream-50 dark:bg-cream-100 dark:text-charcoal-900">{n}</span>
        <span className="font-display text-lg font-semibold">{title}</span>
      </legend>
      {hint && <p className="-mt-2 mb-4 text-xs text-charcoal-700/80 dark:text-cream-200/60">{hint}</p>}
      {children}
    </fieldset>
  );
}

function OptionButton({ active, onClick, children, sub }: { active: boolean; onClick: () => void; children: React.ReactNode; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-[3.25rem] flex-col items-start justify-center rounded-xl border px-4 py-3 text-left text-sm transition",
        active
          ? "border-charcoal-900 bg-charcoal-900 text-cream-50 shadow-card dark:border-cream-100 dark:bg-cream-100 dark:text-charcoal-900"
          : "border-charcoal-900/10 bg-white hover:border-wood-500 dark:border-white/10 dark:bg-charcoal-900",
      )}
    >
      <span className="font-semibold">{children}</span>
      {sub && <span className={cn("mt-0.5 text-xs", active ? "opacity-80" : "text-charcoal-700/70 dark:text-cream-200/60")}>{sub}</span>}
    </button>
  );
}

function NumberField({ id, label, value, onChange, min = 0, max = 50, step = 0.1, required }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  const bump = (d: number) => {
    const n = Math.min(max, Math.max(min, Math.round(((Number(value) || 0) + d) * 10) / 10));
    onChange(String(n));
  };
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {required && "*"}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-charcoal-900/15 bg-white focus-within:border-wood-500 focus-within:ring-2 focus-within:ring-wood-500/20 dark:border-white/15 dark:bg-charcoal-900">
        <button type="button" onClick={() => bump(-0.5)} className="px-4 text-charcoal-700 hover:bg-cream-100 dark:text-cream-200 dark:hover:bg-charcoal-800" aria-label={`Kurangi ${label}`}>
          <Minus className="h-4 w-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent px-2 py-3 text-center text-lg font-semibold focus:outline-none"
          placeholder="0"
        />
        <span className="flex items-center pr-3 text-sm text-charcoal-700/70 dark:text-cream-200/60">m</span>
        <button type="button" onClick={() => bump(0.5)} className="px-4 text-charcoal-700 hover:bg-cream-100 dark:text-cream-200 dark:hover:bg-charcoal-800" aria-label={`Tambah ${label}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PriceCalculator({ config, whatsapp }: { config: PricingConfig; whatsapp: string | null }) {
  const defaults = useMemo(
    () => ({
      productType: config.productTypes[0]?.id ?? "",
      material: config.materials[0]?.id ?? "",
      length: "3",
      height: "",
      finishing: config.finishings[0]?.id ?? "",
      hardware: config.hardware[0]?.id ?? "",
      topTable: config.topTables[0]?.id ?? "",
    }),
    [config],
  );
  const [state, setState] = useState(defaults);
  const [accessories, setAccessories] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<"email" | "survey" | null>(null);
  const started = useRef(false);
  const completed = useRef(false);

  const set = <K extends keyof typeof state>(key: K, value: (typeof state)[K]) => {
    if (!started.current) {
      started.current = true;
      trackEvent("calculator_started");
    }
    setState((s) => ({ ...s, [key]: value }));
  };

  const { result, error } = useMemo((): { result: EstimateResult | null; error: string | null } => {
    if (!state.length || Number(state.length) <= 0) return { result: null, error: "Isi panjang terlebih dahulu" };
    try {
      return {
        result: calculateEstimate(
          {
            productType: state.productType,
            material: state.material,
            length: Number(state.length),
            height: state.height ? Number(state.height) : undefined,
            finishing: state.finishing || undefined,
            hardware: state.hardware || undefined,
            topTable: state.topTable || undefined,
            accessories: Object.entries(accessories).map(([id, qty]) => ({ id, qty })),
          },
          config,
        ),
        error: null,
      };
    } catch (e) {
      return { result: null, error: e instanceof EstimateError ? e.message : "Terjadi kesalahan perhitungan" };
    }
  }, [state, accessories, config]);

  useEffect(() => {
    if (result && started.current && !completed.current) {
      const t = setTimeout(() => {
        completed.current = true;
        trackEvent("calculator_completed", { total: result.totalEstimate, product: result.labels.productType });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [result]);

  if (!config.productTypes.length || !config.materials.length) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold">Kalkulator belum dikonfigurasi.</p>
        <p className="mt-2 text-sm text-charcoal-700">Admin perlu menambahkan jenis produk dan material di Admin → Harga.</p>
      </div>
    );
  }

  const material = config.materials.find((m) => m.id === state.material);
  const productType = config.productTypes.find((p) => p.id === state.productType);
  const messageData = result && {
    productType: result.labels.productType,
    material: result.labels.material,
    length: Number(state.length),
    height: state.height ? Number(state.height) : undefined,
    finishing: result.labels.finishing,
    hardware: result.labels.hardware,
    topTable: result.labels.topTable,
    accessories: result.labels.accessories,
    total: result.totalEstimate,
  };
  const sizeText = `${state.length} m${state.height ? ` x ${state.height} m` : ""}`;
  const furnitureTypes = config.productTypes.map((p) => p.name);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form className="card space-y-7 p-5 sm:p-8 lg:col-span-7" onSubmit={(e) => e.preventDefault()}>
        <Step n={1} title="Jenis produk">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {config.productTypes.map((p) => (
              <OptionButton key={p.id} active={state.productType === p.id} onClick={() => set("productType", p.id)}>
                {p.name}
              </OptionButton>
            ))}
          </div>
        </Step>

        <Step n={2} title="Material">
          <div className="grid gap-2 sm:grid-cols-3">
            {config.materials.map((m) => (
              <OptionButton key={m.id} active={state.material === m.id} onClick={() => set("material", m.id)} sub={`${formatRupiah(m.price_per_meter)} / meter`}>
                {m.name}
              </OptionButton>
            ))}
          </div>
        </Step>

        <Step
          n={3}
          title="Ukuran"
          hint={
            productType?.meta?.standard_height
              ? `Harga per meter panjang berlaku untuk tinggi standar ${productType.meta.standard_height} m. Tinggi di atas standar dihitung proporsional.`
              : undefined
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField id="length" label="Panjang" value={state.length} onChange={(v) => set("length", v)} min={0} max={50} required />
            <NumberField id="height" label="Tinggi (opsional)" value={state.height} onChange={(v) => set("height", v)} min={0} max={5} />
          </div>
        </Step>

        {config.finishings.length > 0 && (
          <Step n={4} title="Finishing">
            <div className="grid grid-cols-3 gap-2">
              {config.finishings.map((f) => (
                <OptionButton key={f.id} active={state.finishing === f.id} onClick={() => set("finishing", f.id)} sub={Number(f.price) ? `+${f.price}%` : "Termasuk"}>
                  {f.name}
                </OptionButton>
              ))}
            </div>
          </Step>
        )}

        {config.topTables.length > 0 && (
          <Step n={5} title="Top table">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {config.topTables.map((t) => (
                <OptionButton
                  key={t.id}
                  active={state.topTable === t.id}
                  onClick={() => set("topTable", t.id)}
                  sub={Number(t.price) ? `${formatRupiah(t.price)} / m` : /custom/i.test(t.name) ? "Konsultasi" : undefined}
                >
                  {t.name}
                </OptionButton>
              ))}
            </div>
          </Step>
        )}

        {config.hardware.length > 0 && (
          <Step n={6} title="Hardware">
            <div className="grid grid-cols-3 gap-2">
              {config.hardware.map((h) => (
                <OptionButton
                  key={h.id}
                  active={state.hardware === h.id}
                  onClick={() => set("hardware", h.id)}
                  sub={Number(h.price) ? `${formatRupiah(h.price)}${h.price_unit === "per_meter" ? " / m" : ""}` : "Termasuk"}
                >
                  {h.name}
                </OptionButton>
              ))}
            </div>
          </Step>
        )}

        {config.accessories.length > 0 && (
          <Step n={7} title="Opsi tambahan" hint="Pilih satu atau lebih. Atur jumlah jika perlu.">
            <div className="grid gap-2 sm:grid-cols-2">
              {config.accessories.map((a) => {
                const qty = accessories[a.id];
                const active = qty !== undefined;
                return (
                  <div key={a.id} className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition", active ? "border-wood-500 bg-cream-100 dark:bg-charcoal-800" : "border-charcoal-900/10 dark:border-white/10")}>
                    <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          if (!started.current) {
                            started.current = true;
                            trackEvent("calculator_started");
                          }
                          setAccessories((s) => {
                            const next = { ...s };
                            if (e.target.checked) next[a.id] = 1;
                            else delete next[a.id];
                            return next;
                          });
                        }}
                        className="h-5 w-5 rounded accent-wood-500"
                      />
                      <span>
                        <span className="font-semibold">{a.name}</span>
                        <span className="block text-xs text-charcoal-700/70 dark:text-cream-200/60">{Number(a.price) ? formatRupiah(a.price) : "Konsultasi"}</span>
                      </span>
                    </label>
                    {active && Number(a.price) > 0 && (
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded-full p-1.5 hover:bg-white dark:hover:bg-charcoal-900" onClick={() => setAccessories((s) => ({ ...s, [a.id]: Math.max(1, (s[a.id] ?? 1) - 1) }))} aria-label={`Kurangi ${a.name}`}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                        <button type="button" className="rounded-full p-1.5 hover:bg-white dark:hover:bg-charcoal-900" onClick={() => setAccessories((s) => ({ ...s, [a.id]: Math.min(20, (s[a.id] ?? 1) + 1) }))} aria-label={`Tambah ${a.name}`}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Step>
        )}

        <button
          type="button"
          onClick={() => {
            setState(defaults);
            setAccessories({});
          }}
          className="inline-flex items-center gap-2 text-sm text-charcoal-700 hover:text-wood-600 dark:text-cream-200/70"
        >
          <RotateCcw className="h-4 w-4" /> Reset kalkulator
        </button>
      </form>

      <aside className="lg:col-span-5" id="hasil-estimasi" aria-live="polite">
        <div className="overflow-hidden rounded-3xl bg-charcoal-900 text-cream-50 shadow-soft lg:sticky lg:top-28">
          <div className="p-6 sm:p-8">
            <p className="eyebrow !text-bronze-300">Estimasi Harga</p>
            {result ? (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-cream-200/60">Jenis</dt>
                    <dd className="font-semibold">{result.labels.productType}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-200/60">Material</dt>
                    <dd className="font-semibold">{result.labels.material}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-200/60">Harga dasar</dt>
                    <dd className="font-semibold">{formatRupiah(result.basePrice)} / meter</dd>
                  </div>
                  <div>
                    <dt className="text-cream-200/60">Panjang</dt>
                    <dd className="font-semibold">
                      {state.length} meter{state.height ? ` · tinggi ${state.height} m` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream-200/60">Rincian</p>
                  <ul className="space-y-3 text-sm">
                    {result.lines.map((l) => (
                      <li key={l.key} className="flex justify-between gap-4">
                        <span>
                          <span className="block">{l.label}</span>
                          <span className="block text-xs text-cream-200/50">{l.detail}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{l.amount ? formatRupiah(l.amount) : l.key === "additional" ? "Gratis" : "Termasuk"}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                  <span className="text-sm text-cream-200/70">Total estimasi</span>
                  <span className="font-display text-3xl font-bold tabular-nums text-bronze-300 sm:text-4xl">{formatRupiah(result.totalEstimate)}</span>
                </div>
                {result.hasCustomItems && <p className="mt-3 text-xs text-bronze-300">* Opsi custom belum termasuk — harga dikonfirmasi saat konsultasi.</p>}
              </>
            ) : (
              <div className="mt-6 flex items-center gap-3 text-sm text-cream-200/70">
                <Calculator className="h-5 w-5" /> {error}
              </div>
            )}
          </div>

          <div className="space-y-3 bg-charcoal-950/60 p-6 sm:p-8">
            {messageData ? (
              <a
                href={whatsappLink(whatsapp, estimateMessage(messageData))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("whatsapp_click", { location: "calculator", total: messageData.total })}
                className="btn-whatsapp w-full !py-4"
              >
                <WhatsAppIcon size={18} /> Pesan via WhatsApp
              </a>
            ) : (
              <button disabled className="btn-whatsapp w-full !py-4">
                <WhatsAppIcon size={18} /> Pesan via WhatsApp
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={!result} onClick={() => setModal("email")} className="btn border border-white/20 text-cream-50 hover:bg-white hover:text-charcoal-900">
                <Mail className="h-4 w-4" /> Pesan via Email
              </button>
              <button type="button" disabled={!result} onClick={() => setModal("survey")} className="btn border border-white/20 text-cream-50 hover:bg-white hover:text-charcoal-900">
                <CalendarCheck className="h-4 w-4" /> Request Survey
              </button>
            </div>
            <p className="flex gap-2 pt-2 text-xs leading-relaxed text-cream-200/60">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {DISCLAIMER}
            </p>
          </div>
        </div>
      </aside>

      <Modal open={modal === "email"} onClose={() => setModal(null)} title="Kirim estimasi via Email" size="lg">
        {result && (
          <ContactForm
            whatsapp={whatsapp}
            furnitureTypes={furnitureTypes}
            defaults={{
              furniture_type: result.labels.productType,
              size: sizeText,
              material: material?.name,
              estimate_total: result.totalEstimate,
              message: messageData ? estimateMessage(messageData) : undefined,
              estimate_detail: messageData,
            }}
          />
        )}
      </Modal>
      <Modal open={modal === "survey"} onClose={() => setModal(null)} title="Request survey & pengukuran" size="lg">
        {result && (
          <SurveyForm
            whatsapp={whatsapp}
            furnitureTypes={furnitureTypes}
            defaults={{
              furniture_type: result.labels.productType,
              approx_size: sizeText,
              estimate_total: result.totalEstimate,
              notes: `Estimasi kalkulator: ${formatRupiah(result.totalEstimate)} (${result.labels.material}${result.labels.finishing ? `, finishing ${result.labels.finishing}` : ""})`,
              estimate_detail: messageData,
            }}
          />
        )}
      </Modal>
    </div>
  );
}

"use client";
import { ArrowLeftRight, Minus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteCashAccount, deleteTransaction, saveCashAccount, saveErpSettings, saveTransaction, transferFunds } from "@/app/admin/erp/finance-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/Toast";
import type { CashAccount, LedgerRow } from "@/lib/erp/data";
import { ACCOUNT_KINDS, BUDGET_CATEGORIES, labelOf, LEDGER_CATEGORIES, LEDGER_SOURCES, MANUAL_LEDGER_CATEGORIES, PERCENT_BUDGET_KEYS } from "@/lib/erp/constants";
import type { Option } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { Badge, DataTable, Field, FormActions, IconButton, MoneyInput, SearchBox, Stat, useAction } from "./kit";

type TxnForm = { id: string | null; txn_date: string; account_id: string; category: string; amount: number; project_id: string; description: string; reference: string };

export function LedgerManager({ rows, accounts, projects }: { rows: LedgerRow[]; accounts: Option[]; projects: Option[] }) {
  const { run, pending, errors } = useAction();
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState("");
  const [dir, setDir] = useState("");
  const [cat, setCat] = useState("");
  const [f, setF] = useState<TxnForm | null>(null);
  const [tr, setTr] = useState<{ txn_date: string; from_account: string; to_account: string; amount: number; description: string } | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!acc || r.account_id === acc) &&
        (!dir || r.direction === dir) &&
        (!cat || r.category === cat) &&
        (!s || [r.txn_number, r.description, r.reference, r.order_number, r.account_name, labelOf(LEDGER_CATEGORIES, r.category)].join(" ").toLowerCase().includes(s)),
    );
  }, [rows, q, acc, dir, cat]);
  const tin = list.filter((r) => r.direction === "in" && r.category !== "transfer_in").reduce((a, r) => a + r.amount, 0);
  const tout = list.filter((r) => r.direction === "out" && r.category !== "transfer_out").reduce((a, r) => a + r.amount, 0);

  const openNew = (direction: "in" | "out") =>
    setF({ id: null, txn_date: jakartaToday(), account_id: accounts.find((a) => a.sub === "cash")?.value ?? accounts[0]?.value ?? "", category: direction === "in" ? "capital_in" : "workshop", amount: 0, project_id: "", description: "", reference: "" });

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Kas masuk" value={formatRupiah(tin)} tone="good" />
        <Stat label="Kas keluar" value={formatRupiah(tout)} tone="bad" />
        <Stat label="Arus kas bersih" value={formatRupiah(tin - tout)} tone={tin - tout < 0 ? "bad" : "good"} />
      </div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari no. transaksi, keterangan, order..." />
        <div className="grid grid-cols-3 gap-2 xl:flex">
          <select className="input !py-2.5 xl:w-44" value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Akun">
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select className="input !py-2.5 xl:w-36" value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Arah">
            <option value="">Masuk & keluar</option>
            <option value="in">Kas masuk</option>
            <option value="out">Kas keluar</option>
          </select>
          <select className="input !py-2.5 xl:w-52" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
            <option value="">Semua kategori</option>
            {LEDGER_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline btn-sm !py-2.5" onClick={() => openNew("in")}>
            <Plus className="h-4 w-4" /> Masuk
          </button>
          <button className="btn-primary btn-sm !py-2.5" onClick={() => openNew("out")}>
            <Minus className="h-4 w-4" /> Keluar
          </button>
          <button className="btn-outline btn-sm !py-2.5" title="Transfer antar akun" onClick={() => setTr({ txn_date: jakartaToday(), from_account: accounts[0]?.value ?? "", to_account: accounts[1]?.value ?? "", amount: 0, description: "" })}>
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <DataTable
        rows={list}
        dense
        empty="Belum ada transaksi pada periode ini."
        columns={[
          { key: "txn_date", label: "Tanggal", render: (r) => <span className="whitespace-nowrap">{formatDateShort(r.txn_date)}<span className="block text-xs text-charcoal-700/50">{r.txn_number}</span></span> },
          {
            key: "description",
            label: "Keterangan",
            render: (r) => (
              <span>
                {r.description ?? "-"}
                <span className="block text-xs text-charcoal-700/60">
                  {labelOf(LEDGER_CATEGORIES, r.category)} · <Badge className="!py-0 !text-[10px]">{LEDGER_SOURCES[r.source_type] ?? r.source_type}</Badge>
                  {r.project_id && (
                    <Link href={`/admin/proyek/${r.project_id}`} className="ml-1 underline">
                      {r.order_number ?? "proyek"}
                    </Link>
                  )}
                </span>
              </span>
            ),
          },
          { key: "account_name", label: "Akun" },
          {
            key: "amount",
            label: "Jumlah",
            align: "right",
            render: (r) => <span className={cn("font-semibold", r.direction === "in" ? "text-green-700" : "text-red-600")}>{r.direction === "in" ? "+" : "−"}{formatRupiah(r.amount)}</span>,
          },
          { key: "user_label", label: "Oleh", render: (r) => <span className="text-xs">{r.user_label ?? "Sistem"}</span>, hideMobile: true },
        ]}
        actions={(r) =>
          r.source_type === "manual" || r.source_type === "transfer" ? (
            <>
              {r.source_type === "manual" && (
                <IconButton label="Edit" onClick={() => setF({ id: r.id, txn_date: r.txn_date, account_id: r.account_id, category: r.category, amount: r.amount, project_id: r.project_id ?? "", description: r.description ?? "", reference: r.reference ?? "" })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              )}
              <IconButton label="Hapus" danger onClick={() => run(() => deleteTransaction(r.id), { confirm: r.source_type === "transfer" ? "Hapus transfer ini (kedua sisi)?" : "Hapus transaksi ini?", success: "Transaksi dihapus" })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          ) : null
        }
      />
      <p className="mt-3 text-xs text-charcoal-700/70">
        Transaksi otomatis (pembayaran order, bayar supplier, biaya proyek, kasbon, gaji) diubah dari menu sumbernya agar tidak tercatat ganda.
      </p>

      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit transaksi" : "Catat transaksi kas"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveTransaction(f), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Kategori" required error={errors.category}>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <optgroup label="Kas masuk">
                  {MANUAL_LEDGER_CATEGORIES.filter((c) => c.dir === "in").map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Kas keluar">
                  {MANUAL_LEDGER_CATEGORIES.filter((c) => c.dir === "out").map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Tanggal" required>
              <input type="date" className="input" value={f.txn_date} onChange={(e) => setF({ ...f, txn_date: e.target.value })} />
            </Field>
            <Field label="Jumlah" required error={errors.amount}>
              <MoneyInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} />
            </Field>
            <Field label="Akun kas" required error={errors.account_id}>
              <select className="input" value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Keterangan" required error={errors.description} className="sm:col-span-2">
              <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="mis. Bayar listrik workshop Oktober" />
            </Field>
            <Field label="Terkait proyek (opsional)" hint="Biaya langsung proyek lebih baik dicatat dari halaman proyek → Anggaran & Biaya.">
              <select className="input" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
                <option value="">Biaya umum perusahaan</option>
                {projects.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="No. referensi / bukti">
              <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      <AdminModal open={tr !== null} onClose={() => setTr(null)} title="Transfer antar akun">
        {tr && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => transferFunds(tr), { onOk: () => setTr(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Dari akun" required>
              <select className="input" value={tr.from_account} onChange={(e) => setTr({ ...tr, from_account: e.target.value })}>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ke akun" required error={errors.to_account}>
              <select className="input" value={tr.to_account} onChange={(e) => setTr({ ...tr, to_account: e.target.value })}>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jumlah" required error={errors.amount}>
              <MoneyInput value={tr.amount} onChange={(n) => setTr({ ...tr, amount: n })} />
            </Field>
            <Field label="Tanggal" required>
              <input type="date" className="input" value={tr.txn_date} onChange={(e) => setTr({ ...tr, txn_date: e.target.value })} />
            </Field>
            <Field label="Keterangan" className="sm:col-span-2">
              <input className="input" value={tr.description} onChange={(e) => setTr({ ...tr, description: e.target.value })} placeholder="mis. Setor tunai ke bank" />
            </Field>
            <FormActions onCancel={() => setTr(null)} pending={pending} label="Catat transfer" />
          </form>
        )}
      </AdminModal>
    </div>
  );
}

type AccForm = { id: string | null; name: string; kind: string; account_number: string; opening_balance: number; opening_date: string; is_default: boolean; is_active: boolean; notes: string };

export function AccountsManager({ accounts }: { accounts: CashAccount[] }) {
  const toast = useToast();
  const { run, pending, errors } = useAction();
  const [f, setF] = useState<AccForm | null>(null);
  const total = accounts.filter((a) => a.is_active).reduce((s, a) => s + a.balance, 0);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm">
          Total saldo kas: <strong className="tabular-nums">{formatRupiah(total)}</strong>
        </p>
        <button className="btn-primary !py-2.5" onClick={() => setF({ id: null, name: "", kind: "bank", account_number: "", opening_balance: 0, opening_date: jakartaToday(), is_default: false, is_active: true, notes: "" })}>
          <Plus className="h-4 w-4" /> Akun kas
        </button>
      </div>
      <DataTable
        rows={accounts}
        columns={[
          { key: "name", label: "Akun", render: (a) => <span><span className="font-semibold">{a.name}</span> {a.is_default && <Badge tone="bg-[#17263C]/10 text-[#17263C] ring-[#17263C]/20">Default</Badge>} {!a.is_active && <Badge>Nonaktif</Badge>}<span className="block text-xs text-charcoal-700/60">{labelOf(ACCOUNT_KINDS, a.kind)}{a.account_number ? ` · ${a.account_number}` : ""}</span></span> },
          { key: "opening_balance", label: "Saldo awal", align: "right", render: (a) => <span>{formatRupiah(a.opening_balance)}<span className="block text-xs text-charcoal-700/60">{formatDateShort(a.opening_date)}</span></span> },
          { key: "balance", label: "Saldo sekarang", align: "right", render: (a) => <strong className={a.balance < 0 ? "text-red-600" : ""}>{formatRupiah(a.balance)}</strong> },
        ]}
        actions={(a) => (
          <>
            <IconButton label="Edit" onClick={() => setF({ ...a, account_number: a.account_number ?? "", notes: a.notes ?? "" })}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Hapus"
              danger
              onClick={() =>
                run(() => deleteCashAccount(a.id), {
                  confirm: `Hapus akun ${a.name}? Akun yang sudah punya transaksi hanya dinonaktifkan.`,
                  onOk: (r) => toast("data" in r && r.data === "archived" ? "Akun dinonaktifkan" : "Akun dihapus"),
                  success: "Selesai",
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />
      <p className="mt-3 text-xs text-charcoal-700/70">Pembayaran konsumen tunai otomatis masuk ke akun kas tunai default, selain tunai ke rekening bank default.</p>
      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit akun kas" : "Tambah akun kas"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveCashAccount(f), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama akun" required error={errors.name}>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mis. BCA Operasional" />
            </Field>
            <Field label="Jenis" required>
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {ACCOUNT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="No. rekening">
              <input className="input" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} />
            </Field>
            <Field label="Saldo awal" error={errors.opening_balance}>
              <MoneyInput value={f.opening_balance} onChange={(n) => setF({ ...f, opening_balance: n })} />
            </Field>
            <Field label="Per tanggal">
              <input type="date" className="input" value={f.opening_date} onChange={(e) => setF({ ...f, opening_date: e.target.value })} />
            </Field>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} className="accent-wood-500" /> Akun default untuk jenis ini
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="accent-wood-500" /> Aktif
              </label>
            </div>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}

export function ErpSettingsForm({ initial }: { initial: { budget_defaults: Record<string, number>; project_stages: string[]; company_signatory: string | null } }) {
  const { run, pending } = useAction();
  const [pct, setPct] = useState<Record<string, string>>(() => Object.fromEntries(PERCENT_BUDGET_KEYS.map((k) => [k, String(initial.budget_defaults[k] ?? 0)])));
  const [stages, setStages] = useState(initial.project_stages.join("\n"));
  const [sign, setSign] = useState(initial.company_signatory ?? "");
  const sum = Object.values(pct).reduce((a, b) => a + (Number(b.replace(",", ".")) || 0), 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          saveErpSettings({
            budget_defaults: Object.fromEntries(Object.entries(pct).map(([k, v]) => [k, v.replace(",", ".") || "0"])),
            project_stages: stages.split("\n").map((s) => s.trim()).filter(Boolean),
            company_signatory: sign,
          }),
        );
      }}
      className="grid gap-6 lg:grid-cols-2"
    >
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
        <h2 className="font-display text-lg font-semibold">Pembagian anggaran default</h2>
        <p className="mb-4 text-xs text-charcoal-700/70">Persentase dari nilai kontrak, dipakai tombol &quot;Susun otomatis&quot; di anggaran proyek. Bahan baku = total RAB, upah = estimasi pekerja, laba = sisanya.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERCENT_BUDGET_KEYS.map((k) => (
            <Field key={k} label={labelOf(BUDGET_CATEGORIES, k)}>
              <div className="relative">
                <input className="input pr-8" type="number" min={0} max={100} step="any" value={pct[k]} onChange={(e) => setPct({ ...pct, [k]: e.target.value })} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-charcoal-700/60">%</span>
              </div>
            </Field>
          ))}
        </div>
        <p className={cn("mt-3 text-sm", sum >= 100 ? "text-red-600" : "text-charcoal-700")}>Total biaya persentase: {sum.toLocaleString("id-ID")}% dari kontrak</p>
      </section>
      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
        <Field label="Tahapan default proyek baru" hint="Satu tahapan per baris. Berlaku untuk proyek yang dibuat setelah disimpan.">
          <textarea className="input font-mono text-sm" rows={10} value={stages} onChange={(e) => setStages(e.target.value)} />
        </Field>
        <Field label="Penandatangan slip gaji (nama)" hint="Muncul di kolom tanda tangan perusahaan pada slip.">
          <input className="input" value={sign} onChange={(e) => setSign(e.target.value)} />
        </Field>
        <p className="text-xs text-charcoal-700/70">
          Nama, alamat & logo perusahaan di slip gaji diambil dari{" "}
          <Link href="/admin/settings" className="underline">
            Pengaturan Website
          </Link>
          .
        </p>
      </section>
      <div className="flex justify-end lg:col-span-2">
        <button className="btn-primary" disabled={pending}>
          <Save className="h-4 w-4" /> Simpan pengaturan
        </button>
      </div>
    </form>
  );
}

import { Banknote, FileSpreadsheet, HandCoins, Landmark, PiggyBank, Receipt, ShoppingCart, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BudgetBars, MonthlyChart } from "@/components/admin/erp/charts";
import { AccountsManager, ErpSettingsForm, LedgerManager } from "@/components/admin/erp/FinanceManagers";
import { TabLinks } from "@/components/admin/erp/kit";
import { OwnerOnly } from "@/components/admin/erp/OwnerOnly";
import { PeriodPicker } from "@/components/admin/orders/PeriodPicker";
import { BreakdownList, KpiCard, Panel } from "@/components/admin/orders/ui";
import { getCurrentUser } from "@/lib/admin/auth";
import { BUDGET_CATEGORIES, labelOf, LEDGER_CATEGORIES } from "@/lib/erp/constants";
import { cashAccountOptions, getCashAccounts, getErpSettings, getFinanceReport, getLedger, listProjects, projectOptions } from "@/lib/erp/data";
import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah, resolvePeriod } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Keuangan" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["ringkasan", "kas", "akun", "pengaturan"] as const;

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return <OwnerOnly title="Keuangan" />;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof TABS)[number]) : "ringkasan";
  const period = resolvePeriod(sp);
  const sb = await createClient();
  const qs = new URLSearchParams();
  if (period.preset === "custom") {
    qs.set("from", period.from);
    qs.set("to", period.to);
  } else qs.set("preset", period.preset);

  return (
    <>
      <AdminHeader
        title="Keuangan & Profitabilitas"
        description="Pisahkan uang masuk, modal kerja, biaya operasional, kewajiban, dan laba perusahaan."
        action={
          <Link href={`/admin/keuangan/export?${qs.toString()}`} className="btn-outline btn-sm bg-white !py-2.5" prefetch={false}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Link>
        }
      />
      <TabLinks
        base={`/admin/keuangan?${qs.toString()}`}
        active={tab}
        tabs={[
          { key: "ringkasan", label: "Dashboard keuangan" },
          { key: "kas", label: "Buku kas" },
          { key: "akun", label: "Akun kas" },
          { key: "pengaturan", label: "Pengaturan anggaran" },
        ]}
      />
      {(tab === "ringkasan" || tab === "kas") && (
        <div className="mb-6">
          <PeriodPicker preset={period.preset} from={period.from} to={period.to} rangeLabel={period.label} />
        </div>
      )}
      {tab === "ringkasan" && <Overview from={period.from} to={period.to} sb={sb} />}
      {tab === "kas" && <Ledger from={period.from} to={period.to} sb={sb} />}
      {tab === "akun" && <AccountsManager accounts={await getCashAccounts(sb)} />}
      {tab === "pengaturan" && <ErpSettingsForm initial={await getErpSettings(sb)} />}
    </>
  );
}

async function Ledger({ from, to, sb }: { from: string; to: string; sb: Awaited<ReturnType<typeof createClient>> }) {
  const [rows, accounts, projects] = await Promise.all([getLedger(from, to, sb), cashAccountOptions(sb), projectOptions(sb)]);
  return <LedgerManager rows={rows} accounts={accounts} projects={projects} />;
}

async function Overview({ from, to, sb }: { from: string; to: string; sb: Awaited<ReturnType<typeof createClient>> }) {
  const [r, projects] = await Promise.all([getFinanceReport(from, to, sb), listProjects(sb)]);
  if (!r) return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">Laporan keuangan gagal dimuat. Pastikan migrasi database sudah dijalankan.</p>;
  const n = (v: unknown) => Number(v) || 0;
  const allocTotal = r.fund_allocation.reduce((a, x) => a + n(x.allocated), 0);
  const spentTotal = r.fund_allocation.filter((x) => x.category !== "profit").reduce((a, x) => a + n(x.spent), 0);
  const active = projects.filter((p) => p.is_active && p.has_budget).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total omzet" value={formatCompactRupiah(n(r.revenue))} icon={TrendingUp} sub={`${r.orders} order deal`} emphasis hint="Nilai order terkonfirmasi berdasarkan tanggal order" />
        <KpiCard label="Laba kotor proyek" value={formatCompactRupiah(n(r.gross_profit))} icon={PiggyBank} sub={`estimasi ${formatCompactRupiah(n(r.estimated_profit))}`} hint="Nilai kontrak − biaya langsung (material, upah, transport, pemasangan) untuk order periode ini" />
        <KpiCard label="Laba operasional" value={formatCompactRupiah(n(r.operating_profit))} icon={Landmark} sub={`overhead ${formatCompactRupiah(n(r.overhead) + n(r.payroll_unallocated))}`} hint="Laba kotor − biaya overhead perusahaan − gaji yang tidak dibebankan ke proyek" />
        <KpiCard label="Saldo kas" value={formatCompactRupiah(n(r.cash_balance))} icon={Wallet} sub="per akhir periode" />
        <KpiCard label="DP diterima" value={formatCompactRupiah(n(r.customer_payments.dp))} icon={HandCoins} sub={`termin ${formatCompactRupiah(n(r.customer_payments.termin))}`} />
        <KpiCard label="Pelunasan" value={formatCompactRupiah(n(r.customer_payments.pelunasan))} icon={Banknote} sub={`total masuk ${formatCompactRupiah(n(r.customer_payments.total))}`} />
        <KpiCard label="Pembelian material" value={formatCompactRupiah(n(r.purchases))} icon={ShoppingCart} sub={`dibayar ${formatCompactRupiah(n(r.purchases_paid))}`} />
        <KpiCard label="Upah pekerja" value={formatCompactRupiah(n(r.labor_total))} icon={Users} sub={`gaji dibayar ${formatCompactRupiah(n(r.payroll_paid))}`} />
        <KpiCard label="Biaya operasional" value={formatCompactRupiah(n(r.operational))} icon={Receipt} hint="Pengeluaran workshop, transport, pemasangan, listrik, pemasaran, administrasi, dll." />
        <KpiCard label="Piutang konsumen" value={formatCompactRupiah(n(r.receivables))} sub={`${r.receivables_orders} order belum lunas`} hint="Sisa tagihan semua order deal (per hari ini)" />
        <KpiCard label="Utang supplier" value={formatCompactRupiah(n(r.payables))} sub={`${r.payables_orders} PO belum lunas`} />
        <KpiCard label="Kasbon pegawai" value={formatCompactRupiah(n(r.loans_outstanding))} sub="piutang ke pegawai" />
      </div>

      <Panel title="Tren 12 bulan: omzet, pengeluaran & laba">
        <MonthlyChart
          data={r.series}
          series={[
            { key: "revenue", label: "Omzet", color: "#17263C", type: "bar" },
            { key: "cash_out", label: "Pengeluaran (kas keluar)", color: "#C9A27E", type: "bar" },
            { key: "gross_profit", label: "Laba kotor proyek", color: "#4B5138", type: "line" },
          ]}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Alokasi dana proyek berjalan">
          <p className="mb-3 text-xs text-charcoal-700">
            Uang konsumen yang sudah diterima untuk proyek aktif ({formatRupiah(n(r.active_received))}) dibagi sesuai anggaran tiap proyek. Ini rencana penggunaan uang, bukan pengeluaran.
          </p>
          {r.fund_allocation.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-charcoal-700">
                  <tr className="border-b border-charcoal-900/10">
                    <th className="py-2">Dana</th>
                    <th className="py-2 text-right">Dialokasikan</th>
                    <th className="py-2 text-right">Dibelanjakan</th>
                    <th className="py-2 text-right">Tersedia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-900/5">
                  {r.fund_allocation.map((f) => {
                    const left = n(f.allocated) - n(f.spent);
                    return (
                      <tr key={f.category}>
                        <td className="py-2">{labelOf(BUDGET_CATEGORIES, f.category)}</td>
                        <td className="py-2 text-right tabular-nums">{formatRupiah(n(f.allocated))}</td>
                        <td className="py-2 text-right tabular-nums">{f.category === "profit" ? "-" : formatRupiah(n(f.spent))}</td>
                        <td className={cn("py-2 text-right tabular-nums font-medium", left < 0 ? "text-red-600" : "text-green-700")}>{formatRupiah(left)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-charcoal-900/10 font-semibold">
                  <tr>
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{formatRupiah(allocTotal)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRupiah(spentTotal)}</td>
                    <td className="py-2 text-right tabular-nums">{formatRupiah(allocTotal - spentTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              {n(r.active_received) - allocTotal > 1 && <p className="mt-2 text-xs text-amber-700">{formatRupiah(n(r.active_received) - allocTotal)} uang masuk belum dialokasikan (proyek belum punya anggaran).</p>}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-charcoal-700/70">Belum ada proyek aktif dengan anggaran. Susun anggaran di halaman proyek → Anggaran & Biaya.</p>
          )}
        </Panel>
        <Panel title="Anggaran vs realisasi proyek aktif">
          <BudgetBars rows={active.map((p) => ({ id: p.id, label: `${p.order_number} · ${p.title}`, budget: p.budget_cost_total, actual: p.actual_total_cost, href: `/admin/proyek/${p.id}?tab=anggaran` }))} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Pengeluaran per kategori">
          <BreakdownList rows={r.expense_by_category.map((x) => ({ label: labelOf(LEDGER_CATEGORIES, x.category), value: n(x.amount) }))} empty="Belum ada pengeluaran" />
        </Panel>
        <Panel title="Pemasukan per kategori">
          <BreakdownList rows={r.income_by_category.map((x) => ({ label: labelOf(LEDGER_CATEGORIES, x.category), value: n(x.amount) }))} empty="Belum ada pemasukan" />
        </Panel>
        <Panel title="Saldo per akun">
          <ul className="space-y-2 text-sm">
            {r.accounts.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span>{a.name}</span>
                <span className={cn("font-semibold tabular-nums", n(a.balance) < 0 && "text-red-600")}>{formatRupiah(n(a.balance))}</span>
              </li>
            ))}
            <li className="flex justify-between gap-2 border-t border-charcoal-900/10 pt-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(n(r.cash_balance))}</span>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel title="Ringkasan laba rugi periode">
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Omzet (nilai kontrak order deal)", n(r.revenue)],
            ["Biaya langsung proyek (realisasi)", -n(r.direct_cost)],
            ["Laba kotor proyek", n(r.gross_profit), true],
            ["Biaya overhead (tanpa proyek)", -n(r.overhead)],
            ["Gaji tidak terbebankan ke proyek", -n(r.payroll_unallocated)],
            ["Laba operasional", n(r.operating_profit), true],
          ].map(([k, v, bold]) => (
            <div key={String(k)} className={cn("flex justify-between gap-3 border-b border-dashed border-charcoal-900/10 py-1.5", bold && "font-bold")}>
              <dt>{k}</dt>
              <dd className={cn("tabular-nums", Number(v) < 0 && "text-red-600")}>{formatRupiah(Number(v))}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-charcoal-700/70">
          Laba tidak dihitung dari sisa uang DP — biaya proyek dihitung dari material yang benar-benar dipakai, upah sesuai absensi & slip, dan biaya langsung yang tercatat. Proyek yang belum selesai
          akan terus bertambah biayanya hingga selesai.
        </p>
      </Panel>
    </div>
  );
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { numify, numifyAll } from "./server";
import type { Employee, InventoryLot, MaterialCategory, MaterialItem, Movement, Option, PaySettings, ProjectRow, PurchaseItem, PurchaseOrder, Requirement, Supplier, SupplierProduct } from "./types";

type SB = Awaited<ReturnType<typeof createClient>>;
const log = (where: string, error: { message: string } | null) => error && console.error(`[erp:${where}]`, error.message);

// ---------------------------------------------------------------------------
// MASTER: kategori, bahan, supplier
// ---------------------------------------------------------------------------
export async function getCategories(sb?: SB): Promise<MaterialCategory[]> {
  sb ??= await createClient();
  const [cats, specs, items] = await Promise.all([
    sb.from("material_categories").select("*").order("sort_order").order("name"),
    sb.from("material_specifications").select("*").order("sort_order"),
    sb.from("material_items").select("category_id").is("deleted_at", null),
  ]);
  log("categories", cats.error);
  const count = new Map<string, number>();
  for (const i of items.data ?? []) count.set(i.category_id as string, (count.get(i.category_id as string) ?? 0) + 1);
  return (cats.data ?? []).map((c) => ({
    ...(c as MaterialCategory),
    specs: (specs.data ?? []).filter((s) => s.category_id === c.id) as MaterialCategory["specs"],
    items_count: count.get(c.id as string) ?? 0,
  }));
}

export async function getMaterialItems(sb?: SB, opts: { activeOnly?: boolean } = {}): Promise<MaterialItem[]> {
  sb ??= await createClient();
  let q = sb.from("material_stock_view").select("*").is("deleted_at", null).order("name").limit(3000);
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  log("items", error);
  return numifyAll<MaterialItem>(data);
}

export async function getSuppliers(sb?: SB): Promise<Supplier[]> {
  sb ??= await createClient();
  const [sup, prods, pos] = await Promise.all([
    sb.from("suppliers").select("*").is("deleted_at", null).order("name"),
    sb.from("supplier_products").select("supplier_id"),
    sb.from("purchase_orders").select("supplier_id"),
  ]);
  log("suppliers", sup.error);
  const pc = new Map<string, number>();
  for (const p of prods.data ?? []) pc.set(p.supplier_id as string, (pc.get(p.supplier_id as string) ?? 0) + 1);
  const oc = new Map<string, number>();
  for (const p of pos.data ?? []) oc.set(p.supplier_id as string, (oc.get(p.supplier_id as string) ?? 0) + 1);
  return (sup.data ?? []).map((s) => ({ ...(s as Supplier), products_count: pc.get(s.id as string) ?? 0, po_count: oc.get(s.id as string) ?? 0 }));
}

export async function getSupplierProducts(sb?: SB, filter?: { supplierId?: string; itemId?: string }): Promise<SupplierProduct[]> {
  sb ??= await createClient();
  let q = sb
    .from("supplier_products")
    .select("*, suppliers!inner(name, whatsapp, is_active, deleted_at), material_items!inner(name, code, unit, deleted_at, material_categories(name))")
    .is("suppliers.deleted_at", null)
    .is("material_items.deleted_at", null)
    .order("price")
    .limit(5000);
  if (filter?.supplierId) q = q.eq("supplier_id", filter.supplierId);
  if (filter?.itemId) q = q.eq("material_item_id", filter.itemId);
  const { data, error } = await q;
  log("supplier_products", error);
  return (data ?? []).map((r) => {
    const s = r.suppliers as unknown as { name: string; whatsapp: string | null; is_active: boolean };
    const m = r.material_items as unknown as { name: string; code: string; unit: string; material_categories: { name: string } | null };
    return numify<SupplierProduct>({
      ...r,
      suppliers: undefined,
      material_items: undefined,
      supplier_name: s.name,
      supplier_whatsapp: s.whatsapp,
      supplier_active: s.is_active,
      item_name: m.name,
      item_code: m.code,
      item_unit: m.unit,
      category_name: m.material_categories?.name ?? "",
    });
  });
}

export async function supplierOptions(sb?: SB): Promise<Option[]> {
  sb ??= await createClient();
  const { data } = await sb.from("suppliers").select("id, name, code, is_active").is("deleted_at", null).order("name");
  return (data ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id as string, label: s.name as string, sub: s.code as string }));
}

export async function projectOptions(sb?: SB, opts: { activeOnly?: boolean } = {}): Promise<Option[]> {
  sb ??= await createClient();
  let q = sb.from("projects_view").select("id, order_number, title, customer_name, order_status").order("order_date", { ascending: false }).limit(500);
  if (opts.activeOnly) q = q.in("order_status", ["quotation", "confirmed", "production", "installation"]);
  const { data } = await q;
  return (data ?? []).map((p) => ({ value: p.id as string, label: `${p.order_number} · ${p.title}`, sub: p.customer_name as string }));
}

export async function cashAccountOptions(sb?: SB): Promise<Option[]> {
  sb ??= await createClient();
  const { data } = await sb.from("cash_accounts").select("id, name, kind, is_active").eq("is_active", true).order("kind").order("name");
  return (data ?? []).map((a) => ({ value: a.id as string, label: a.name as string, sub: a.kind as string }));
}

export async function employeeOptions(sb?: SB, opts: { activeOnly?: boolean } = { activeOnly: true }): Promise<Option[]> {
  sb ??= await createClient();
  let q = sb.from("employees").select("id, full_name, employee_number, status, positions(name)").is("deleted_at", null).order("full_name");
  if (opts.activeOnly) q = q.eq("status", "active");
  const { data } = await q;
  return (data ?? []).map((e) => ({
    value: e.id as string,
    label: e.full_name as string,
    sub: [(e.positions as unknown as { name: string } | null)?.name, e.employee_number].filter(Boolean).join(" · "),
  }));
}

// ---------------------------------------------------------------------------
// PEMBELIAN & STOK
// ---------------------------------------------------------------------------

function mapPo(r: Record<string, unknown>): PurchaseOrder {
  const s = r.suppliers as { name: string; whatsapp: string | null } | null;
  const p = r.projects as { orders: { order_number: string; title: string } | null } | null;
  const items = r.purchase_order_items as { count: number }[] | undefined;
  return numify<PurchaseOrder>({
    ...r,
    suppliers: undefined,
    projects: undefined,
    purchase_order_items: undefined,
    supplier_name: s?.name ?? "-",
    supplier_whatsapp: s?.whatsapp ?? null,
    project_label: p?.orders ? `${p.orders.order_number} · ${p.orders.title}` : null,
    items_count: items?.[0]?.count ?? 0,
  });
}

const PO_SELECT = "*, suppliers(name, whatsapp), projects(orders(order_number, title)), purchase_order_items(count)";

export async function listPurchaseOrders(f: { status?: string; q?: string; supplier?: string; project?: string; from?: string; to?: string }) {
  const sb = await createClient();
  let q = sb.from("purchase_orders").select(PO_SELECT).order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (f.status) q = q.eq("status", f.status);
  if (f.supplier) q = q.eq("supplier_id", f.supplier);
  if (f.project) q = q.eq("project_id", f.project);
  if (f.from) q = q.gte("order_date", f.from);
  if (f.to) q = q.lte("order_date", f.to);
  if (f.q) {
    const term = f.q.replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
    if (term) q = q.or(`po_number.ilike.%${term}%,invoice_number.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  const { data, error } = await q;
  log("purchase_orders", error);
  return (data ?? []).map((r) => mapPo(r));
}

export async function getPurchaseOrder(id: string) {
  const sb = await createClient();
  const [po, items, payments] = await Promise.all([
    sb.from("purchase_orders").select(PO_SELECT).eq("id", id).maybeSingle(),
    sb.from("purchase_order_items").select("*, material_items(name, code)").eq("purchase_order_id", id).order("sort_order"),
    sb.from("purchase_payments").select("*, cash_accounts(name)").eq("purchase_order_id", id).order("paid_at"),
  ]);
  if (!po.data) return null;
  return {
    po: mapPo(po.data),
    items: (items.data ?? []).map((r) => {
      const m = r.material_items as unknown as { name: string; code: string };
      return numify<PurchaseItem>({ ...r, material_items: undefined, item_name: m.name, item_code: m.code });
    }),
    payments: (payments.data ?? []).map((r) =>
      numify<{ id: string; paid_at: string; amount: number; account_id: string; account_name: string; reference: string | null; note: string | null }>({
        ...r,
        cash_accounts: undefined,
        account_name: (r.cash_accounts as unknown as { name: string } | null)?.name ?? "-",
      }),
    ),
  };
}

export async function getInventoryLots(sb?: SB, f: { item?: string; activeOnly?: boolean } = {}): Promise<InventoryLot[]> {
  sb ??= await createClient();
  let q = sb.from("inventory_view").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
  if (f.item) q = q.eq("material_item_id", f.item);
  if (f.activeOnly) q = q.gt("qty_on_hand", 0);
  const { data, error } = await q;
  log("inventory", error);
  return numifyAll<InventoryLot>(data);
}

export async function getMovements(sb?: SB, f: { inventory?: string; project?: string; limit?: number } = {}): Promise<Movement[]> {
  sb ??= await createClient();
  let q = sb
    .from("inventory_movements")
    .select("*, inventory(stock_code, unit, material_items(name)), projects(orders(order_number)), users(full_name, username, email)")
    .order("created_at", { ascending: false })
    .limit(f.limit ?? 300);
  if (f.inventory) q = q.eq("inventory_id", f.inventory);
  if (f.project) q = q.eq("project_id", f.project);
  const { data, error } = await q;
  log("movements", error);
  return (data ?? []).map((r) => {
    const inv = r.inventory as unknown as { stock_code: string; unit: string; material_items: { name: string } };
    const u = r.users as unknown as { full_name: string | null; username: string | null; email: string } | null;
    return numify<Movement>({
      ...r,
      inventory: undefined,
      projects: undefined,
      users: undefined,
      stock_code: inv.stock_code,
      unit: inv.unit,
      item_name: inv.material_items.name,
      order_number: (r.projects as unknown as { orders: { order_number: string } } | null)?.orders?.order_number ?? null,
      user_label: u ? u.full_name || u.username || u.email : null,
    });
  });
}

// ---------------------------------------------------------------------------
// PROYEK
// ---------------------------------------------------------------------------
export async function listProjects(sb?: SB): Promise<ProjectRow[]> {
  sb ??= await createClient();
  const { data, error } = await sb.from("projects_view").select("*").order("order_date", { ascending: false }).limit(1000);
  log("projects", error);
  return numifyAll<ProjectRow>(data);
}

export interface Allocation {
  id: string;
  inventory_id: string;
  stock_code: string;
  item_name: string;
  material_item_id: string;
  unit: string;
  unit_cost: number;
  qty_allocated: number;
  qty_consumed: number;
  qty_released: number;
  remaining: number;
  notes: string | null;
  created_at: string;
}
export interface Usage {
  id: string;
  inventory_id: string;
  stock_code: string;
  item_name: string;
  unit: string;
  kind: string;
  qty: number;
  unit_cost: number;
  usage_date: string;
  notes: string | null;
}
export interface Budget {
  category: string;
  amount: number;
  notes: string | null;
}
export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  account_id: string;
  account_name: string;
  vendor: string | null;
  receipt_url: string | null;
}
export interface Stage {
  id: string;
  stage_name: string;
  sort_order: number;
  status: string;
  start_date: string | null;
  target_date: string | null;
  actual_end_date: string | null;
  progress: number;
  notes: string | null;
  photos: string[];
}
export interface Worker {
  id: string;
  employee_id: string;
  full_name: string;
  employee_number: string;
  position_name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_days: number;
  agreed_amount: number;
  notes: string | null;
  daily_rate: number | null;
  pay_type: string | null;
  days_worked: number;
}
export interface Template {
  id: string;
  name: string;
  work_type: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  items: {
    id: string;
    material_item_id: string | null;
    name: string;
    formula: string;
    waste_pct: number;
    round_up: boolean;
    unit: string;
    notes: string | null;
    sort_order: number;
  }[];
}

export async function getTemplates(sb?: SB): Promise<Template[]> {
  sb ??= await createClient();
  const { data, error } = await sb.from("material_templates").select("*, material_template_items(*)").order("sort_order").order("name");
  log("templates", error);
  return (data ?? []).map((t) => ({
    ...(t as unknown as Template),
    items: numifyAll<Template["items"][number]>((t.material_template_items as Record<string, unknown>[]) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getProjectDetail(id: string) {
  const sb = await createClient();
  const [project, reqs, allocs, usage, budgets, expenses, stages, workers, attendance] = await Promise.all([
    sb.from("projects_view").select("*").eq("id", id).maybeSingle(),
    sb.from("project_requirements_view").select("*").eq("project_id", id).order("sort_order").order("created_at"),
    sb.from("project_material_allocations").select("*, inventory(stock_code, unit, unit_cost, material_item_id, material_items(name))").eq("project_id", id).order("created_at"),
    sb.from("project_material_usage").select("*, inventory(stock_code, unit, material_items(name))").eq("project_id", id).order("usage_date", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("project_budgets").select("category, amount, notes").eq("project_id", id),
    sb.from("project_expenses").select("*, cash_accounts(name)").eq("project_id", id).order("expense_date", { ascending: false }),
    sb.from("project_timelines").select("*").eq("project_id", id).order("sort_order").order("created_at"),
    sb.from("project_workers").select("*, employees(full_name, employee_number, positions(name))").eq("project_id", id).order("created_at"),
    sb.from("employee_attendance").select("employee_id, days_worked, work_date").eq("project_id", id).eq("status", "present"),
  ]);
  if (!project.data) return null;
  const empIds = (workers.data ?? []).map((w) => w.employee_id as string);
  const rates = empIds.length ? await sb.from("employee_rates").select("employee_id, daily_rate, pay_type").in("employee_id", empIds) : { data: [] };
  const daysBy = new Map<string, number>();
  for (const a of attendance.data ?? []) daysBy.set(a.employee_id as string, (daysBy.get(a.employee_id as string) ?? 0) + Number(a.days_worked));

  return {
    project: numify<ProjectRow>(project.data),
    requirements: numifyAll<Requirement>(reqs.data),
    allocations: (allocs.data ?? []).map((a) => {
      const inv = a.inventory as unknown as { stock_code: string; unit: string; unit_cost: string; material_item_id: string; material_items: { name: string } };
      const r = numify<Allocation>({ ...a, inventory: undefined, stock_code: inv.stock_code, unit: inv.unit, unit_cost: inv.unit_cost, material_item_id: inv.material_item_id, item_name: inv.material_items.name });
      return { ...r, unit_cost: Number(r.unit_cost), remaining: r.qty_allocated - r.qty_consumed - r.qty_released };
    }),
    usage: (usage.data ?? []).map((u) => {
      const inv = u.inventory as unknown as { stock_code: string; unit: string; material_items: { name: string } };
      return numify<Usage>({ ...u, inventory: undefined, stock_code: inv.stock_code, unit: inv.unit, item_name: inv.material_items.name });
    }),
    budgets: numifyAll<Budget>(budgets.data),
    expenses: (expenses.data ?? []).map((e) => numify<Expense>({ ...e, cash_accounts: undefined, account_name: (e.cash_accounts as unknown as { name: string } | null)?.name ?? "-" })),
    stages: numifyAll<Stage>(stages.data),
    workers: (workers.data ?? []).map((w) => {
      const e = w.employees as unknown as { full_name: string; employee_number: string; positions: { name: string } | null };
      const r = (rates.data ?? []).find((x) => x.employee_id === w.employee_id);
      return numify<Worker>({
        ...w,
        employees: undefined,
        full_name: e.full_name,
        employee_number: e.employee_number,
        position_name: e.positions?.name ?? null,
        daily_rate: r ? Number(r.daily_rate) : null,
        pay_type: (r?.pay_type as string) ?? null,
        days_worked: daysBy.get(w.employee_id as string) ?? 0,
      });
    }),
    attendanceDays: [...daysBy.values()].reduce((a, b) => a + b, 0),
  };
}

export async function getErpSettings(sb?: SB) {
  sb ??= await createClient();
  const { data } = await sb.from("settings").select("budget_defaults, project_stages, company_signatory, business_name, address, logo_url, whatsapp_number").eq("id", true).maybeSingle();
  return {
    budget_defaults: ((data?.budget_defaults as Record<string, number>) ?? {}) as Record<string, number>,
    project_stages: (data?.project_stages as string[]) ?? [],
    company_signatory: (data?.company_signatory as string | null) ?? null,
    business_name: (data?.business_name as string) ?? "Mandiri Furniture",
    address: (data?.address as string | null) ?? null,
    logo_url: (data?.logo_url as string | null) ?? null,
    whatsapp_number: (data?.whatsapp_number as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// SDM
// ---------------------------------------------------------------------------
function mapEmployee(r: Record<string, unknown>): Employee {
  return { ...(r as unknown as Employee), position_name: (r.positions as { name: string } | null)?.name ?? null };
}

export async function listEmployees(sb?: SB, opts: { includeArchived?: boolean } = {}): Promise<Employee[]> {
  sb ??= await createClient();
  let q = sb.from("employees").select("*, positions(name)").order("status").order("full_name");
  if (!opts.includeArchived) q = q.is("deleted_at", null);
  const { data, error } = await q;
  log("employees", error);
  return (data ?? []).map((r) => mapEmployee(r));
}

export async function getPositions(sb?: SB) {
  sb ??= await createClient();
  const [{ data }, { data: emps }] = await Promise.all([sb.from("positions").select("*").order("sort_order").order("name"), sb.from("employees").select("position_id").is("deleted_at", null)]);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    sort_order: Number(p.sort_order),
    is_active: Boolean(p.is_active),
    employees: (emps ?? []).filter((e) => e.position_id === p.id).length,
  }));
}

export async function getPaySettingsMap(sb?: SB) {
  sb ??= await createClient();
  const { data } = await sb.from("employee_pay_settings").select("*");
  return new Map(numifyAll<PaySettings>(data).map((p) => [p.employee_id, p]));
}

/** Signed URL (1 jam) untuk file di bucket privat hr-private. */
export async function signHrFiles(paths: string[], sb?: SB) {
  const clean = [...new Set(paths.filter(Boolean))];
  if (!clean.length) return {} as Record<string, string>;
  sb ??= await createClient();
  const { data } = await sb.storage.from("hr-private").createSignedUrls(clean, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
  return out;
}

export interface AttendanceRow {
  id: string;
  employee_id: string;
  work_date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  days_worked: number;
  project_id: string | null;
  notes: string | null;
  order_number?: string | null;
  updated_at: string;
  created_at: string;
}
export interface PayrollRow {
  id: string;
  slip_number: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  pay_type: string;
  days_worked: number;
  daily_rate: number;
  base_amount: number;
  total_earnings: number;
  total_deductions: number;
  net_amount: number;
  status: string;
  payment_date: string | null;
  account_id: string | null;
  notes: string | null;
  full_name?: string;
  employee_number?: string;
  position_name?: string | null;
}
export interface PayrollItemRow {
  id: string;
  item_type: string;
  category: string;
  description: string;
  amount: number;
  deduction_id: string | null;
  loan_id: string | null;
  project_id: string | null;
  sort_order: number;
}
export interface DeductionRow {
  id: string;
  employee_id: string;
  deduction_date: string;
  category: string;
  name: string;
  amount: number;
  notes: string | null;
  status: string;
  payroll_id: string | null;
  full_name?: string;
}
export interface LoanRow {
  id: string;
  loan_number: string;
  employee_id: string;
  loan_date: string;
  kind: string;
  amount: number;
  installment_amount: number;
  repaid_amount: number;
  outstanding: number;
  account_id: string;
  notes: string | null;
  full_name?: string;
}
export interface EmployeeDoc {
  id: string;
  doc_type: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string | null;
}

export async function getEmployeeDetail(id: string, isOwner: boolean) {
  const sb = await createClient();
  const [emp, attendance, workers] = await Promise.all([
    sb.from("employees").select("*, positions(name)").eq("id", id).maybeSingle(),
    sb.from("employee_attendance").select("*, projects(orders(order_number))").eq("employee_id", id).order("work_date", { ascending: false }).limit(120),
    sb.from("project_workers").select("*, projects(id, orders(order_number, title, status))").eq("employee_id", id).order("created_at", { ascending: false }),
  ]);
  if (!emp.data) return null;
  const owner = isOwner
    ? await Promise.all([
        sb.from("employee_pay_settings").select("*").eq("employee_id", id).maybeSingle(),
        sb.from("employee_documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
        sb.from("payroll").select("*").eq("employee_id", id).order("period_end", { ascending: false }).limit(60),
        sb.from("employee_deductions").select("*").eq("employee_id", id).order("deduction_date", { ascending: false }).limit(100),
        sb.from("employee_loans").select("*").eq("employee_id", id).order("loan_date", { ascending: false }),
      ])
    : null;
  const employee = mapEmployee(emp.data);
  const docs = (owner?.[1].data ?? []) as Omit<EmployeeDoc, "url">[];
  const urls = isOwner ? await signHrFiles([employee.photo_path ?? "", ...docs.map((d) => d.file_path)], sb) : {};
  return {
    employee,
    photoUrl: employee.photo_path ? (urls[employee.photo_path] ?? null) : null,
    pay: owner?.[0].data ? numify<PaySettings>(owner[0].data) : null,
    documents: docs.map((d) => ({ ...d, url: urls[d.file_path] ?? null })) as EmployeeDoc[],
    payrolls: numifyAll<PayrollRow>(owner?.[2].data),
    deductions: numifyAll<DeductionRow>(owner?.[3].data),
    loans: numifyAll<LoanRow>(owner?.[4].data),
    attendance: (attendance.data ?? []).map((a) =>
      numify<AttendanceRow>({ ...a, projects: undefined, order_number: (a.projects as unknown as { orders: { order_number: string } } | null)?.orders?.order_number ?? null }),
    ),
    projects: (workers.data ?? []).map((w) => {
      const pr = w.projects as unknown as { id: string; orders: { order_number: string; title: string; status: string } };
      return { id: pr.id, order_number: pr.orders.order_number, title: pr.orders.title, status: pr.orders.status, role: (w.role as string | null) ?? null };
    }),
  };
}

export async function getAttendance(from: string, to: string, sb?: SB): Promise<AttendanceRow[]> {
  sb ??= await createClient();
  const { data, error } = await sb.from("employee_attendance").select("*").gte("work_date", from).lte("work_date", to).limit(10000);
  log("attendance", error);
  return numifyAll<AttendanceRow>(data);
}

export async function listPayroll(from: string, to: string, sb?: SB): Promise<PayrollRow[]> {
  sb ??= await createClient();
  const { data, error } = await sb
    .from("payroll")
    .select("*, employees(full_name, employee_number, positions(name))")
    .lte("period_start", to)
    .gte("period_end", from)
    .order("period_end", { ascending: false })
    .limit(1000);
  log("payroll", error);
  return (data ?? []).map((r) => {
    const e = r.employees as unknown as { full_name: string; employee_number: string; positions: { name: string } | null };
    return numify<PayrollRow>({ ...r, employees: undefined, full_name: e.full_name, employee_number: e.employee_number, position_name: e.positions?.name ?? null });
  });
}

export async function getPayroll(id: string) {
  const sb = await createClient();
  const [p, items] = await Promise.all([
    sb.from("payroll").select("*, employees(full_name, employee_number, phone, positions(name)), cash_accounts(name)").eq("id", id).maybeSingle(),
    sb.from("payroll_items").select("*").eq("payroll_id", id).order("sort_order"),
  ]);
  if (!p.data) return null;
  const e = p.data.employees as unknown as { full_name: string; employee_number: string; phone: string | null; positions: { name: string } | null };
  return {
    payroll: numify<PayrollRow & { phone: string | null; account_name: string | null }>({
      ...p.data,
      employees: undefined,
      cash_accounts: undefined,
      full_name: e.full_name,
      employee_number: e.employee_number,
      phone: e.phone,
      position_name: e.positions?.name ?? null,
      account_name: (p.data.cash_accounts as unknown as { name: string } | null)?.name ?? null,
    }),
    items: numifyAll<PayrollItemRow>(items.data),
  };
}

export async function listDeductions(sb?: SB): Promise<DeductionRow[]> {
  sb ??= await createClient();
  const { data } = await sb.from("employee_deductions").select("*, employees(full_name)").order("deduction_date", { ascending: false }).limit(500);
  return (data ?? []).map((r) => numify<DeductionRow>({ ...r, employees: undefined, full_name: (r.employees as unknown as { full_name: string }).full_name }));
}

export async function listLoans(sb?: SB): Promise<LoanRow[]> {
  sb ??= await createClient();
  const { data } = await sb.from("employee_loans").select("*, employees(full_name)").order("loan_date", { ascending: false }).limit(500);
  return (data ?? []).map((r) => numify<LoanRow>({ ...r, employees: undefined, full_name: (r.employees as unknown as { full_name: string }).full_name }));
}

// ---------------------------------------------------------------------------
// KEUANGAN
// ---------------------------------------------------------------------------
export interface FinanceReport {
  range: { from: string; to: string };
  revenue: number;
  orders: number;
  customer_payments: { dp: number; termin: number; pelunasan: number; other: number; total: number };
  purchases: number;
  purchases_paid: number;
  payroll_gross: number;
  payroll_paid: number;
  labor_direct: number;
  labor_total: number;
  operational: number;
  cash_in: number;
  cash_out: number;
  direct_cost: number;
  gross_profit: number;
  estimated_profit: number;
  overhead: number;
  payroll_unallocated: number;
  operating_profit: number;
  cash_balance: number;
  accounts: { id: string; name: string; kind: string; balance: number }[];
  receivables: number;
  receivables_orders: number;
  payables: number;
  payables_orders: number;
  loans_outstanding: number;
  expense_by_category: { category: string; amount: number }[];
  income_by_category: { category: string; amount: number }[];
  fund_allocation: { category: string; budget: number; allocated: number; spent: number }[];
  active_received: number;
  series: { month: string; revenue: number; cash_in: number; cash_out: number; gross_profit: number; material_usage: number; payroll: number }[];
}

export async function getFinanceReport(from: string, to: string, sb?: SB): Promise<FinanceReport | null> {
  sb ??= await createClient();
  const { data, error } = await sb.rpc("finance_report", { p_from: from, p_to: to });
  if (error) {
    console.error("[finance_report]", error.message);
    return null;
  }
  return data as FinanceReport;
}

export interface LedgerRow {
  id: string;
  txn_number: string;
  txn_date: string;
  account_id: string;
  account_name: string;
  direction: "in" | "out";
  amount: number;
  category: string;
  project_id: string | null;
  order_id: string | null;
  order_number: string | null;
  source_type: string;
  source_id: string | null;
  description: string | null;
  reference: string | null;
  user_label: string | null;
  created_at: string;
}

export async function getLedger(from: string, to: string, sb?: SB): Promise<LedgerRow[]> {
  sb ??= await createClient();
  const { data, error } = await sb
    .from("financial_transactions")
    .select("*, cash_accounts(name), orders(order_number), users(full_name, username, email)")
    .gte("txn_date", from)
    .lte("txn_date", to)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3000);
  log("ledger", error);
  return (data ?? []).map((r) => {
    const u = r.users as unknown as { full_name: string | null; username: string | null; email: string } | null;
    return numify<LedgerRow>({
      ...r,
      cash_accounts: undefined,
      orders: undefined,
      users: undefined,
      account_name: (r.cash_accounts as unknown as { name: string } | null)?.name ?? "-",
      order_number: (r.orders as unknown as { order_number: string } | null)?.order_number ?? null,
      user_label: u ? u.full_name || u.username || u.email : null,
    });
  });
}

export interface CashAccount {
  id: string;
  name: string;
  kind: string;
  account_number: string | null;
  opening_balance: number;
  opening_date: string;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  balance: number;
}

export async function getCashAccounts(sb?: SB): Promise<CashAccount[]> {
  sb ??= await createClient();
  const { data, error } = await sb.from("cash_accounts_view").select("*").order("kind").order("name");
  log("cash_accounts", error);
  return numifyAll<CashAccount>(data);
}

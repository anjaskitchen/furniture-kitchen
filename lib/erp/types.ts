/** Tipe baris ERP (angka sudah dikonversi lewat numify). */

export interface SpecDef {
  id: string;
  category_id: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "select";
  options: string[];
  unit: string | null;
  is_required: boolean;
  sort_order: number;
}

export interface MaterialCategory {
  id: string;
  name: string;
  description: string | null;
  default_unit: string;
  sort_order: number;
  is_active: boolean;
  specs: SpecDef[];
  items_count?: number;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  address: string | null;
  whatsapp: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  products_count: number;
  po_count: number;
  created_at: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  material_item_id: string;
  supplier_sku: string | null;
  price: number;
  unit: string | null;
  price_updated_at: string;
  notes: string | null;
  is_active: boolean;
  supplier_name: string;
  supplier_whatsapp: string | null;
  supplier_active: boolean;
  item_name: string;
  item_code: string;
  item_unit: string;
  category_name: string;
}

export interface MaterialItem {
  id: string;
  code: string;
  category_id: string;
  category_name: string;
  name: string;
  brand: string | null;
  specs: Record<string, string>;
  unit: string;
  min_stock: number;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  qty_on_hand: number;
  qty_allocated: number;
  qty_available: number;
  stock_value: number;
  is_low_stock: boolean;
  best_price: number | null;
  best_supplier_id: string | null;
  best_supplier_name: string | null;
  supplier_count: number;
}

export interface InventoryLot {
  id: string;
  stock_code: string;
  material_item_id: string;
  item_code: string;
  item_name: string;
  brand: string | null;
  category_id: string;
  category_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  po_number: string | null;
  invoice_number: string | null;
  purchase_date: string;
  qty_in: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  location: string | null;
  specs: Record<string, string>;
  photo_url: string | null;
  notes: string | null;
  qty_on_hand: number;
  qty_allocated: number;
  qty_available: number;
  qty_used: number;
  qty_damaged: number;
  qty_returned: number;
  stock_value: number;
  stock_status: string;
}

export interface Movement {
  id: string;
  inventory_id: string;
  movement_type: string;
  qty: number;
  project_id: string | null;
  reference_type: string;
  reference_id: string;
  reason: string | null;
  moved_at: string;
  created_at: string;
  stock_code: string;
  item_name: string;
  unit: string;
  order_number: string | null;
  user_label: string | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_whatsapp: string | null;
  project_id: string | null;
  project_label: string | null;
  order_date: string;
  invoice_number: string | null;
  status: string;
  expected_date: string | null;
  received_at: string | null;
  due_date: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  items_count: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  material_item_id: string;
  item_name: string;
  item_code: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  project_id: string | null;
  sort_order: number;
}

export interface ProjectRow {
  id: string;
  order_id: string;
  work_type: string | null;
  specs: Record<string, string | number>;
  manager_id: string | null;
  manager_name: string | null;
  template_id: string | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  estimated_days: number | null;
  progress: number;
  notes: string | null;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  title: string;
  category: string | null;
  order_status: string;
  paid_amount: number;
  balance: number;
  payment_due_date: string | null;
  is_booked: boolean;
  is_active: boolean;
  actual_days: number | null;
  planned_days: number | null;
  expected_progress: number;
  contract_value: number;
  budget_material: number;
  budget_labor: number;
  budget_other: number;
  budget_profit: number;
  budget_cost_total: number;
  has_budget: boolean;
  rab_total: number;
  material_used_cost: number;
  material_direct: number;
  material_actual: number;
  labor_days: number;
  labor_attendance_cost: number;
  labor_project_pay: number;
  labor_direct: number;
  labor_actual: number;
  labor_estimate: number;
  other_actual: number;
  actual_total_cost: number;
  actual_profit: number;
  estimated_profit: number;
  schedule_status: string;
  budget_status: string;
  indicator: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  material_item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  category_name: string | null;
  name: string;
  spec_text: string | null;
  qty: number;
  unit: string;
  est_unit_price: number;
  est_total: number;
  preferred_supplier_id: string | null;
  source: string;
  notes: string | null;
  sort_order: number;
  covered_qty: number;
  allocated_remaining: number;
  used_qty: number;
  on_order_qty: number;
  stock_available: number;
  still_needed: number;
  shortage_qty: number;
  procurement_status: string;
  recommended_supplier_id: string | null;
  recommended_supplier_name: string | null;
  recommended_price: number | null;
  best_price: number | null;
}

export interface Employee {
  id: string;
  employee_number: string;
  full_name: string;
  photo_path: string | null;
  gender: string | null;
  birth_place: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  position_id: string | null;
  position_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  deleted_at: string | null;
}

export interface PaySettings {
  employee_id: string;
  pay_type: string;
  daily_wage: number;
  monthly_salary: number;
  working_days_per_month: number;
  default_allowance: number;
  default_incentive: number;
  commission_note: string | null;
}

export interface Option {
  value: string;
  label: string;
  sub?: string;
}

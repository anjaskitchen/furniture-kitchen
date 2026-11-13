"use server";

import { z } from "zod";
import { check, run, zDate, zId, zMoney, zOptDate, zOptId, zOptText, zPositive, zText } from "@/lib/erp/server";

const PATHS = ["/admin/pegawai", "/admin/absensi", "/admin/penggajian", "/admin/proyek", "/admin/keuangan", "/admin"];

// ---------------------------------------------------------------------------
// PEGAWAI
// ---------------------------------------------------------------------------
const phone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .refine((v) => !v || /^[+\d\s()-]{8,}$/.test(v), "Nomor HP tidak valid")
  .transform((v) => v || null);

const employeeSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  full_name: zText("Nama lengkap", 2, 120),
  gender: z.union([z.enum(["L", "P"]), z.literal(""), z.null()]).transform((v) => v || null),
  birth_place: zOptText(80),
  birth_date: zOptDate,
  address: zOptText(500),
  phone,
  emergency_contact_name: zOptText(120),
  emergency_contact_relation: zOptText(60),
  emergency_contact_phone: phone,
  position_id: zOptId,
  start_date: zOptDate,
  end_date: zOptDate,
  status: z.enum(["active", "inactive", "resigned"]),
  notes: zOptText(2000),
});

export async function saveEmployee(input: unknown) {
  return run({ schema: employeeSchema, input, revalidate: PATHS, message: "Data pegawai disimpan" }, async (sb, { id, ...d }) => {
    if (id) {
      check(await sb.from("employees").update(d).eq("id", id));
      return id;
    }
    return (check(await sb.from("employees").insert(d).select("id").single()) as { id: string }).id;
  });
}

/** Pegawai yang punya riwayat (absensi, gaji, kasbon, proyek) hanya dinonaktifkan & diarsipkan. */
export async function deleteEmployee(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS }, async (sb, eid) => {
    const counts = await Promise.all(
      ["employee_attendance", "payroll", "employee_loans", "employee_deductions", "project_workers"].map((t) => sb.from(t).select("id", { count: "exact", head: true }).eq("employee_id", eid)),
    );
    if (counts.some((c) => (c.count ?? 0) > 0)) {
      check(await sb.from("employees").update({ status: "inactive", deleted_at: new Date().toISOString() }).eq("id", eid));
      return "archived";
    }
    const { data: docs } = await sb.from("employee_documents").select("file_path").eq("employee_id", eid);
    const { data: emp } = await sb.from("employees").select("photo_path").eq("id", eid).maybeSingle();
    const files = [...(docs ?? []).map((d) => d.file_path as string), emp?.photo_path as string].filter(Boolean);
    if (files.length) await sb.storage.from("hr-private").remove(files);
    check(await sb.from("employees").delete().eq("id", eid));
    return "deleted";
  });
}

export async function restoreEmployee(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Pegawai diaktifkan kembali" }, async (sb, eid) => {
    check(await sb.from("employees").update({ status: "active", deleted_at: null }).eq("id", eid));
  });
}

export async function setEmployeePhoto(input: unknown) {
  const schema = z.object({ id: zId, path: z.string().max(500).nullable() });
  return run({ owner: true, schema, input, revalidate: ["/admin/pegawai"], message: "Foto pegawai diperbarui" }, async (sb, d) => {
    const { data: emp } = await sb.from("employees").select("photo_path").eq("id", d.id).maybeSingle();
    if (emp?.photo_path && emp.photo_path !== d.path) await sb.storage.from("hr-private").remove([emp.photo_path as string]);
    check(await sb.from("employees").update({ photo_path: d.path }).eq("id", d.id));
  });
}

const paySchema = z.object({
  employee_id: zId,
  pay_type: z.enum(["daily", "monthly", "project"]),
  daily_wage: zMoney("Upah harian"),
  monthly_salary: zMoney("Gaji bulanan"),
  working_days_per_month: z.coerce.number().int().min(1).max(31),
  default_allowance: zMoney("Tunjangan"),
  default_incentive: zMoney("Insentif"),
  commission_note: zOptText(300),
});

export async function savePaySettings(input: unknown) {
  return run({ owner: true, schema: paySchema, input, revalidate: PATHS, message: "Pengaturan gaji disimpan" }, async (sb, d) => {
    check(await sb.from("employee_pay_settings").upsert({ ...d, updated_at: new Date().toISOString() }, { onConflict: "employee_id" }));
  });
}

const docSchema = z.object({
  employee_id: zId,
  doc_type: z.enum(["ktp", "kk", "npwp", "bpjs", "kontrak", "ijazah", "lainnya"]),
  file_path: z.string().min(5).max(500).refine((p) => !p.includes(".."), "Path tidak valid"),
  file_name: z.string().min(1).max(200),
  mime_type: zOptText(100),
  size_bytes: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
});

export async function addEmployeeDocument(input: unknown) {
  return run({ owner: true, schema: docSchema, input, revalidate: ["/admin/pegawai"], message: "Dokumen tersimpan (privat)" }, async (sb, d) => {
    if (!d.file_path.startsWith(`employees/${d.employee_id}/`)) throw new Error("Lokasi file tidak sesuai pegawai");
    check(await sb.from("employee_documents").insert(d));
  });
}

export async function deleteEmployeeDocument(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: ["/admin/pegawai"], message: "Dokumen dihapus" }, async (sb, did) => {
    const { data } = await sb.from("employee_documents").select("file_path").eq("id", did).maybeSingle();
    if (data?.file_path) await sb.storage.from("hr-private").remove([data.file_path as string]);
    check(await sb.from("employee_documents").delete().eq("id", did));
  });
}

// ---------------------------------------------------------------------------
// JABATAN
// ---------------------------------------------------------------------------
const positionSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: zText("Nama jabatan", 1, 80),
  description: zOptText(300),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(true),
});
export async function savePosition(input: unknown) {
  return run({ schema: positionSchema, input, revalidate: ["/admin/pegawai"], message: "Jabatan disimpan" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("positions").update(d).eq("id", id));
    else check(await sb.from("positions").insert(d));
  });
}
export async function deletePosition(id: string) {
  return run({ schema: zId, input: id, revalidate: ["/admin/pegawai"], message: "Jabatan dihapus" }, async (sb, pid) => {
    const { count } = await sb.from("employees").select("id", { count: "exact", head: true }).eq("position_id", pid);
    if (count) throw new Error(`Jabatan masih dipakai ${count} pegawai. Nonaktifkan saja atau pindahkan pegawainya.`);
    check(await sb.from("positions").delete().eq("id", pid));
  });
}

// ---------------------------------------------------------------------------
// ABSENSI
// ---------------------------------------------------------------------------
const time = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "Jam tidak valid")
  .transform((v) => v || null);

const attendanceSchema = z.object({
  date: zDate,
  rows: z
    .array(
      z.object({
        employee_id: zId,
        status: z.enum(["present", "leave", "sick", "off", "absent"]),
        check_in: time,
        check_out: time,
        days_worked: z.coerce.number().min(0).max(2),
        project_id: zOptId,
        notes: zOptText(300),
      }),
    )
    .max(500),
  remove: z.array(zId).max(500).default([]),
});

export async function saveAttendance(input: unknown) {
  return run({ schema: attendanceSchema, input, revalidate: PATHS, message: "Absensi disimpan" }, async (sb, d) => {
    if (d.rows.length) {
      const rows = d.rows.map((r) => ({ ...r, work_date: d.date, days_worked: r.status === "present" ? r.days_worked : 0, project_id: r.status === "present" ? r.project_id : null }));
      check(await sb.from("employee_attendance").upsert(rows, { onConflict: "employee_id,work_date" }));
    }
    if (d.remove.length) check(await sb.from("employee_attendance").delete().eq("work_date", d.date).in("employee_id", d.remove));
    return d.rows.length;
  });
}

/** Riwayat koreksi absensi (dari audit log; khusus admin utama). */
export async function getAttendanceHistory(attendanceId: string) {
  return run({ owner: true, schema: zId, input: attendanceId }, async (sb, id) => {
    const { data } = await sb.from("audit_logs").select("action, old_data, new_data, created_at, users(full_name, username, email)").eq("table_name", "employee_attendance").eq("record_id", id).order("created_at", { ascending: false });
    return (data ?? []).map((r) => {
      const u = r.users as unknown as { full_name: string | null; username: string | null; email: string } | null;
      return {
        action: r.action as string,
        at: r.created_at as string,
        by: u ? u.full_name || u.username || u.email : "Sistem",
        before: (r.old_data as { status?: string; days_worked?: number } | null) ?? null,
        after: (r.new_data as { status?: string; days_worked?: number } | null) ?? null,
      };
    });
  });
}

// ---------------------------------------------------------------------------
// POTONGAN & KASBON (admin utama)
// ---------------------------------------------------------------------------
const deductionSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  employee_id: z.string({ message: "Pilih pegawai" }).uuid("Pilih pegawai"),
  deduction_date: zDate,
  category: z.enum(["rokok", "makan_minum", "kerusakan", "lainnya"]),
  name: zText("Nama potongan", 1, 120),
  amount: zPositive("Nominal", 100_000_000),
  notes: zOptText(300),
});

export async function saveDeduction(input: unknown) {
  return run({ owner: true, schema: deductionSchema, input, revalidate: PATHS, message: "Potongan dicatat" }, async (sb, { id, ...d }) => {
    if (id) {
      const { data } = await sb.from("employee_deductions").select("status").eq("id", id).maybeSingle();
      if (data?.status === "deducted") throw new Error("Potongan sudah masuk slip gaji. Hapus dari slip (draft) dulu.");
      check(await sb.from("employee_deductions").update(d).eq("id", id));
    } else check(await sb.from("employee_deductions").insert(d));
  });
}

export async function deleteDeduction(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Potongan dihapus" }, async (sb, did) => {
    const { data } = await sb.from("employee_deductions").select("status").eq("id", did).maybeSingle();
    if (data?.status === "deducted") throw new Error("Potongan sudah masuk slip gaji. Hapus dari slip (draft) dulu.");
    check(await sb.from("employee_deductions").delete().eq("id", did));
  });
}

const loanSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    employee_id: z.string({ message: "Pilih pegawai" }).uuid("Pilih pegawai"),
    loan_date: zDate,
    kind: z.enum(["kasbon", "pinjaman"]),
    amount: zPositive("Nominal", 1_000_000_000),
    installment_amount: zPositive("Cicilan per gajian", 1_000_000_000),
    account_id: z.string({ message: "Pilih akun kas" }).uuid("Pilih akun kas"),
    notes: zOptText(300),
  })
  .refine((l) => l.installment_amount <= l.amount, { path: ["installment_amount"], message: "Cicilan tidak boleh melebihi nominal" });

export async function saveLoan(input: unknown) {
  return run({ owner: true, schema: loanSchema, input, revalidate: PATHS, message: "Kasbon dicatat & kas keluar tercatat" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("employee_loans").update(d).eq("id", id));
    else check(await sb.from("employee_loans").insert(d));
  });
}

export async function deleteLoan(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Kasbon dihapus" }, async (sb, lid) => {
    const { count } = await sb.from("payroll_items").select("id", { count: "exact", head: true }).eq("loan_id", lid);
    if (count) throw new Error("Kasbon sudah dicicil lewat slip gaji, tidak bisa dihapus");
    check(await sb.from("employee_loans").delete().eq("id", lid));
  });
}

// ---------------------------------------------------------------------------
// PENGGAJIAN (admin utama)
// ---------------------------------------------------------------------------
const genSchema = z.object({ employee_ids: z.array(zId).min(1, "Pilih minimal 1 pegawai").max(500), start: zDate, end: zDate }).refine((g) => g.end >= g.start, { path: ["end"], message: "Periode tidak valid" });

export async function generatePayrolls(input: unknown) {
  return run({ owner: true, schema: genSchema, input, revalidate: PATHS }, async (sb, d) => {
    const done: string[] = [];
    const failed: string[] = [];
    for (const id of d.employee_ids) {
      const { data, error } = await sb.rpc("generate_payroll", { p_employee: id, p_start: d.start, p_end: d.end });
      if (error) failed.push(error.message);
      else done.push(data as string);
    }
    return { done: done.length, failed };
  });
}

const itemSchema = z.object({
  payroll_id: zId,
  category: z.enum(["base", "incentive", "allowance", "commission", "project_pay", "overtime", "other_earning", "deduction"]),
  description: zText("Keterangan", 1, 200),
  amount: zPositive("Nominal", 1_000_000_000),
  project_id: zOptId,
});

export async function addPayrollItem(input: unknown) {
  return run({ owner: true, schema: itemSchema, input, revalidate: PATHS, message: "Rincian slip ditambahkan" }, async (sb, d) => {
    const { count } = await sb.from("payroll_items").select("id", { count: "exact", head: true }).eq("payroll_id", d.payroll_id);
    check(await sb.from("payroll_items").insert({ ...d, item_type: d.category === "deduction" ? "deduction" : "earning", sort_order: (count ?? 0) + 1 }));
  });
}

export async function deletePayrollItem(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Rincian dihapus" }, async (sb, iid) => {
    check(await sb.from("payroll_items").delete().eq("id", iid));
  });
}

export async function setPayrollStatus(input: unknown) {
  const schema = z.object({ id: zId, status: z.enum(["draft", "approved", "paid"]), date: zOptDate, account_id: zOptId });
  return run({ owner: true, schema, input, revalidate: PATHS }, async (sb, d) => {
    const { error } = await sb.rpc("set_payroll_status", { p_id: d.id, p_status: d.status, p_date: d.date, p_account: d.account_id });
    if (error) throw new Error(error.message);
  });
}

export async function updatePayrollNotes(input: unknown) {
  return run({ owner: true, schema: z.object({ id: zId, notes: zOptText(500) }), input, revalidate: PATHS, message: "Catatan slip disimpan" }, async (sb, d) => {
    check(await sb.from("payroll").update({ notes: d.notes }).eq("id", d.id));
  });
}

export async function deletePayroll(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Slip dihapus — potongan & cicilan kembali ke status belum dipotong" }, async (sb, pid) => {
    check(await sb.from("payroll").delete().eq("id", pid));
  });
}

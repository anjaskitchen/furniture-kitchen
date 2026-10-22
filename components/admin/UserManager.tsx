"use client";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAdminUser, deleteAdminUser, setUserRole } from "@/app/admin/actions";
import { formatDateID } from "@/lib/format";
import type { AppUser, Role } from "@/types";
import { useToast } from "../Toast";
import { AdminModal } from "./AdminModal";

export function UserManager({ users, meId, isSuperAdmin }: { users: AppUser[]; meId: string; isSuperAdmin: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Berhasil") : (r.error ?? "Gagal"), r.ok ? "success" : "error");
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div>
      {isSuperAdmin ? (
        <button onClick={() => setOpen(true)} className="btn-primary mb-6">
          <UserPlus className="h-4 w-4" /> Tambah Admin
        </button>
      ) : (
        <p className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Hanya role admin yang dapat mengelola user.</p>
      )}
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-cream-50 text-left text-xs uppercase tracking-wider text-charcoal-700">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Dibuat</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-900/5">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.email}{u.id === meId && <span className="ml-2 text-xs text-wood-600">(Anda)</span>}</td>
                <td className="px-4 py-3">{u.full_name || "-"}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Role ${u.email}`}
                    disabled={!isSuperAdmin || u.id === meId || pending}
                    value={u.role}
                    onChange={(e) => run(() => setUserRole(u.id, e.target.value as Role))}
                    className="input !w-auto !py-1.5"
                  >
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="customer">customer (tanpa akses)</option>
                  </select>
                </td>
                <td className="px-4 py-3">{formatDateID(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {isSuperAdmin && u.id !== meId && (
                    <button onClick={() => confirm(`Hapus user ${u.email}?`) && run(() => deleteAdminUser(u.id))} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Hapus user">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminModal open={open} onClose={() => setOpen(false)} title="Tambah admin">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => createAdminUser(Object.fromEntries(fd)), () => setOpen(false));
          }}
        >
          <div>
            <label className="label" htmlFor="u-email">Email</label>
            <input id="u-email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-name">Nama</label>
            <input id="u-name" name="full_name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-pass">Password (min. 10 karakter)</label>
            <input id="u-pass" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="u-role">Role</label>
            <select id="u-role" name="role" className="input" defaultValue="editor">
              <option value="editor">editor — kelola konten & harga</option>
              <option value="admin">admin — akses penuh termasuk user</option>
            </select>
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Buat Admin
          </button>
        </form>
      </AdminModal>
    </div>
  );
}

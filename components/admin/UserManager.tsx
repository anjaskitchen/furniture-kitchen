"use client";
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAdminUser, deleteAdminUser, updateAdminUser, type ActionResult } from "@/app/admin/actions";
import { USERNAME_HINT, visibleEmail } from "@/lib/admin/accounts";
import { formatDateID } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppUser, Role } from "@/types";
import { useToast } from "../Toast";
import { AdminModal } from "./AdminModal";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  customer: "Tanpa akses",
};

type Draft = { username: string; email: string; full_name: string; role: Role; password: string };

const emptyDraft: Draft = { username: "", email: "", full_name: "", role: "editor", password: "" };

export function UserManager({ users, meId, isSuperAdmin }: { users: AppUser[]; meId: string; isSuperAdmin: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [pending, start] = useTransition();

  const isNew = editing === "new";
  const editingSelf = editing !== null && editing !== "new" && editing.id === meId;
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const open = (u: AppUser | "new") => {
    setErrors({});
    setShowPw(false);
    setDraft(
      u === "new"
        ? emptyDraft
        : { username: u.username ?? "", email: visibleEmail(u.email) ?? "", full_name: u.full_name ?? "", role: u.role, password: "" },
    );
    setEditing(u);
  };

  const handle = (r: ActionResult, after?: () => void) => {
    if (r.ok) {
      toast(r.message ?? "Berhasil");
      after?.();
      router.refresh();
    } else {
      setErrors(r.fieldErrors ?? {});
      toast(r.error, "error");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = isNew ? await createAdminUser(draft) : await updateAdminUser((editing as AppUser).id, draft);
      handle(r, () => setEditing(null));
    });
  };

  const remove = (u: AppUser) => {
    if (!confirm(`Hapus akun "${u.username || visibleEmail(u.email) || u.full_name}"? Akun tidak bisa login lagi.`)) return;
    start(async () => handle(await deleteAdminUser(u.id)));
  };

  const canEdit = (u: AppUser) => isSuperAdmin || u.id === meId;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-charcoal-700">
          Login bisa memakai <strong>username</strong> atau <strong>email</strong>. Email tidak wajib — akun cukup memiliki username.
          {!isSuperAdmin && " Anda (editor) hanya dapat mengubah akun sendiri."}
        </p>
        {isSuperAdmin && (
          <button onClick={() => open("new")} className="btn-primary shrink-0 !py-2.5">
            <UserPlus className="h-4 w-4" /> Tambah Akun
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-charcoal-900/5 bg-cream-50 text-xs uppercase tracking-wider text-charcoal-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Username</th>
              <th scope="col" className="px-4 py-3 font-semibold">Email</th>
              <th scope="col" className="px-4 py-3 font-semibold">Nama</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role</th>
              <th scope="col" className="px-4 py-3 font-semibold">Dibuat</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-900/5">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-cream-50/60">
                <td className="px-4 py-3 font-medium">
                  {u.username ?? <span className="text-charcoal-700/50">—</span>}
                  {u.id === meId && <span className="ml-2 rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-semibold text-wood-700">Anda</span>}
                </td>
                <td className="px-4 py-3">{visibleEmail(u.email) ?? <span className="text-charcoal-700/50">tanpa email</span>}</td>
                <td className="px-4 py-3">{u.full_name || "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                      u.role === "admin" ? "bg-charcoal-900 text-cream-50" : u.role === "editor" ? "bg-cream-200 text-charcoal-800" : "bg-red-50 text-red-700",
                    )}
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateID(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit(u) && (
                      <button onClick={() => open(u)} className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" aria-label={`Edit akun ${u.username ?? u.email}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {isSuperAdmin && u.id !== meId && (
                      <button onClick={() => remove(u)} disabled={pending} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Hapus akun ${u.username ?? u.email}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminModal open={editing !== null} onClose={() => setEditing(null)} title={isNew ? "Tambah akun" : editingSelf ? "Akun saya" : "Edit akun"}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
          <div>
            <label className="label" htmlFor="u-username">Username</label>
            <input
              id="u-username"
              className="input"
              value={draft.username}
              onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s+/g, ""))}
              placeholder="contoh: anjasfurniture"
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-charcoal-700/70">{USERNAME_HINT}</p>
            {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
          </div>
          <div>
            <label className="label" htmlFor="u-email">Email <span className="font-normal text-charcoal-700/60">(opsional)</span></label>
            <input id="u-email" type="email" className="input" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="nama@domain.com" />
            <p className="mt-1 text-xs text-charcoal-700/70">Bisa juga dipakai untuk login.</p>
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label className="label" htmlFor="u-name">Nama</label>
            <input id="u-name" className="input" value={draft.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="u-role">Role</label>
            <select id="u-role" className="input" value={draft.role} disabled={!isSuperAdmin || editingSelf} onChange={(e) => set("role", e.target.value)}>
              <option value="admin">Admin — akses penuh termasuk akun</option>
              <option value="editor">Editor — konten, harga & leads</option>
              <option value="customer">Tanpa akses admin</option>
            </select>
            {editingSelf && <p className="mt-1 text-xs text-charcoal-700/70">Role akun sendiri tidak bisa diubah.</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="u-pass">
              {isNew ? "Password" : "Password baru"} {!isNew && <span className="font-normal text-charcoal-700/60">(kosongkan jika tidak diganti)</span>}
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
              <input
                id="u-pass"
                type={showPw ? "text" : "password"}
                className="input !pl-9 !pr-11"
                value={draft.password}
                onChange={(e) => set("password", e.target.value)}
                minLength={8}
                required={isNew}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-charcoal-700 hover:bg-cream-200"
                aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-charcoal-700/70">Minimal 8 karakter.</p>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-charcoal-900/10 pt-4 sm:col-span-2">
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">
              Batal
            </button>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {isNew ? "Buat Akun" : "Simpan"}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}

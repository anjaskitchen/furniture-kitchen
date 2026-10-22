/**
 * Helper akun admin (data murni — aman untuk client).
 * Akun boleh dibuat tanpa email: Supabase Auth tetap butuh alamat email, jadi
 * dipakai alamat internal <username>@akun.internal yang tidak pernah ditampilkan.
 */
export const INTERNAL_EMAIL_DOMAIN = "akun.internal";
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const USERNAME_HINT = "3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip";

export const internalEmail = (username: string) => `${username}@${INTERNAL_EMAIL_DOMAIN}`;
export const isInternalEmail = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`));

/** Email asli untuk ditampilkan, atau null jika akun hanya memakai username. */
export const visibleEmail = (email: string | null | undefined) => (email && !isInternalEmail(email) ? email : null);

export function accountLabel(u: { username?: string | null; email?: string | null; full_name?: string | null }) {
  return u.username || visibleEmail(u.email) || u.full_name || "Akun";
}

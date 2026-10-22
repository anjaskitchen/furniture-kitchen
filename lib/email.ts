import "server-only";

/**
 * Kirim email via Resend (https://resend.com) memakai EMAIL_SERVICE_KEY.
 * Mengembalikan false (tanpa error) jika email belum dikonfigurasi,
 * sehingga data tetap tersimpan di database.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string | null }) {
  const key = process.env.EMAIL_SERVICE_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !opts.to) {
    console.warn("[email] EMAIL_SERVICE_KEY/EMAIL_FROM belum diisi — email dilewati");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("[email] gagal", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] error", e);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Tabel HTML sederhana untuk notifikasi admin. Semua nilai di-escape. */
export function emailTable(title: string, rows: [string, string | number | null | undefined][]) {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 12px;color:#1c1c1c;white-space:pre-wrap">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="color:#1c1c1c">${escapeHtml(title)}</h2><table style="border-collapse:collapse;background:#faf8f3;border-radius:8px">${body}</table></div>`;
}

"use client";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useActionState, useState } from "react";
import { loginAction, type ActionResult } from "@/app/admin/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  // Dikontrol agar username tidak hilang saat password salah (form action me-reset input).
  const [login, setLogin] = useState("");
  const [showPw, setShowPw] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="login" className="label">Username atau email</label>
        <input
          id="login"
          name="login"
          type="text"
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPw ? "text" : "password"} required autoComplete="current-password" className="input !pr-11" />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-charcoal-700 hover:bg-cream-200"
            aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {state && !state.ok && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Masuk
      </button>
    </form>
  );
}

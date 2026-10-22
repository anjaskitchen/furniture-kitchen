"use client";
import { Loader2, LogIn } from "lucide-react";
import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/app/admin/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state && !state.ok && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Masuk
      </button>
    </form>
  );
}

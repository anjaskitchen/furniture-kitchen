"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshGoogleReviews } from "@/app/admin/actions";
import { useToast } from "../Toast";

export function RefreshGoogleReviewsButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn-outline shrink-0"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshGoogleReviews();
          if (r.ok) {
            toast(r.message ?? "Diperbarui");
            router.refresh();
          } else toast(r.error, "error");
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh sekarang
    </button>
  );
}

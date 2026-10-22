"use client";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackEvent, type AnalyticsEvent } from "@/lib/analytics";

/** Link eksternal (WhatsApp/Email) yang mengirim event analytics saat diklik. */
export function TrackedLink({
  event,
  eventParams,
  children,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  event: AnalyticsEvent;
  eventParams?: Record<string, string | number | undefined>;
  children: ReactNode;
}) {
  const external = props.href?.startsWith("http");
  return (
    <a
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(e) => {
        trackEvent(event, eventParams);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}

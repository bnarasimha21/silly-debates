"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Report an analytics event from the browser. Failures are ignored. */
export function trackEvent(name: string, data: Record<string, unknown> = {}) {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...data }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics must never break the page
  }
}

/** Records one `visit` per page view and sets the visitor cookie. */
export function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).host : "";
      if (host && host !== window.location.host) referrer = host;
    } catch {
      // unparsable referrer
    }
    const entryMatch = pathname.match(/^\/e\/([^/]+)/);
    const debateMatch = pathname.match(/^\/d\/([^/]+)/);
    trackEvent("visit", {
      path: pathname,
      referrer,
      ref: params.get("ref") ?? undefined,
      src: params.get("src") ?? undefined,
      entryId: entryMatch?.[1],
      debateId: debateMatch?.[1],
    });
  }, [pathname]);

  return null;
}

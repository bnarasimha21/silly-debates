"use client";

import { useState, useSyncExternalStore } from "react";
import { trackEvent } from "./tracker";

interface ShareButtonsProps {
  /** Path to share, e.g. "/e/abc123". */
  path: string;
  /** Message that goes with the link. */
  text: string;
  entryId?: string;
  debateId?: string;
  /** "full" shows every channel as a button; "compact" is a single small button. */
  variant?: "full" | "compact";
}

const noopSubscribe = () => () => {};

/** True only in browsers that have a native share sheet. */
function useCanNativeShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );
}

function refCode(): string | null {
  const match = document.cookie.match(/(?:^|; )sd_ref=([0-9a-f]{12})/);
  return match ? match[1] : null;
}

/** Absolute share URL, tagged with who shared it and through which channel. */
function buildUrl(path: string, channel: string): string {
  const url = new URL(path, window.location.origin);
  const ref = refCode();
  if (ref) url.searchParams.set("ref", ref);
  url.searchParams.set("src", channel);
  return url.toString();
}

export function ShareButtons({
  path,
  text,
  entryId,
  debateId,
  variant = "full",
}: ShareButtonsProps) {
  const canNativeShare = useCanNativeShare();
  const [copied, setCopied] = useState(false);

  const record = (channel: string) =>
    trackEvent("share_click", { channel, entryId, debateId, path });

  const copy = async () => {
    record("copy");
    try {
      await navigator.clipboard.writeText(buildUrl(path, "copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", buildUrl(path, "copy"));
    }
  };

  const nativeShare = async () => {
    record("native");
    try {
      await navigator.share({ text, url: buildUrl(path, "native") });
    } catch {
      // the person closed the share sheet
    }
  };

  const openWhatsApp = () => {
    record("whatsapp");
    const message = `${text} ${buildUrl(path, "whatsapp")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const openX = () => {
    record("x");
    const params = new URLSearchParams({ text, url: buildUrl(path, "x") });
    window.open(`https://twitter.com/intent/tweet?${params}`, "_blank", "noopener");
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={canNativeShare ? nativeShare : copy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4m0 0L8 6m4-4v13" />
        </svg>
        {copied ? "Link copied" : "Share"}
      </button>
    );
  }

  const button =
    "flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-colors";

  return (
    <div className="flex flex-wrap gap-2">
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={`${button} bg-purple-600 text-white hover:bg-purple-700`}>
          Share
        </button>
      )}
      <button type="button" onClick={openWhatsApp} className={`${button} bg-green-600 text-white hover:bg-green-700`}>
        WhatsApp
      </button>
      <button type="button" onClick={openX} className={`${button} bg-gray-900 text-white hover:bg-gray-700`}>
        Post on X
      </button>
      <button type="button" onClick={copy} className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200`}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}

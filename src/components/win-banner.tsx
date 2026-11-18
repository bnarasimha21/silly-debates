"use client";

import { useSyncExternalStore } from "react";
import { ShareButtons } from "./share-buttons";

interface WinBannerProps {
  entryId: string;
  topic: string;
  label: string;
}

const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

function isDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Shown once to the winner of the latest debate, until they dismiss it. */
export function WinBanner({ entryId, topic, label }: WinBannerProps) {
  const key = `sd_win_seen_${entryId}`;
  // Hidden on the server and until the browser confirms it was not dismissed.
  const dismissed = useSyncExternalStore(subscribe, () => isDismissed(key), () => true);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // storage unavailable; the banner will show again next visit
    }
    listeners.forEach((notify) => notify());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6">
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="font-semibold text-gray-900">You won {label}!</p>
            <p className="text-sm text-gray-600">
              Your answer to &ldquo;{topic}&rdquo; got the most votes. Show it off.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <ShareButtons
          path={`/e/${entryId}`}
          text={`I won ${label} of Silly Debates: "${topic}"`}
          entryId={entryId}
        />
      </div>
    </div>
  );
}

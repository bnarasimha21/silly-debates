"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface VoteButtonProps {
  entryId: string;
  initialVoteCount: number;
  initialHasVoted: boolean;
}

/** Large vote button for the single-entry page. */
export function VoteButton({ entryId, initialVoteCount, initialHasVoted }: VoteButtonProps) {
  const { data: session, status } = useSession();
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const before = { voteCount, hasVoted };
    setHasVoted(!hasVoted);
    setVoteCount(voteCount + (hasVoted ? -1 : 1));

    try {
      const response = hasVoted
        ? await fetch(`/api/votes/${entryId}`, { method: "DELETE" })
        : await fetch("/api/votes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entryId }),
          });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vote failed");
      setHasVoted(data.hasVoted);
      setVoteCount(data.voteCount);
    } catch (err) {
      setHasVoted(before.hasVoted);
      setVoteCount(before.voteCount);
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setBusy(false);
    }
  };

  const countLabel = `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;

  if (status !== "loading" && !session) {
    return (
      <div className="text-center">
        <Link
          href="/auth/signin"
          className="block w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          Sign in to vote
        </Link>
        <p className="text-sm text-gray-500 mt-2">{countLabel} so far</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || status === "loading"}
        className={`w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-60 ${
          hasVoted
            ? "bg-purple-100 text-purple-700 border-2 border-purple-300 hover:bg-purple-200"
            : "bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90"
        }`}
      >
        {hasVoted ? "Voted - tap to undo" : "Vote for this answer"}
      </button>
      <p className="text-sm text-gray-500 mt-2">{countLabel} so far</p>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}

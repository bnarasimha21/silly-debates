"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import type { Debate, Entry, EntryResponse } from "@/types";
import { debateLabel, SEASON_LENGTH } from "@/lib/site";
import { ShareButtons } from "./share-buttons";

interface DebateViewProps {
  initialDebate: Debate | null;
}

type SortOption = "votes" | "newest" | "oldest";

export function DebateView({ initialDebate }: DebateViewProps) {
  const { data: session, status } = useSession();
  const [debate, setDebate] = useState<Debate | null>(initialDebate);
  const [entryContent, setEntryContent] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("votes");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The entry the person just submitted; drives the "share it" dialog.
  const [justSubmitted, setJustSubmitted] = useState<EntryResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  // Loading state while auth is being checked
  const isLoading = status === "loading";

  // Sort entries based on selected option
  const sortedEntries = debate
    ? [...debate.entries].sort((a, b) => {
        switch (sortBy) {
          case "votes":
            return b.voteCount - a.voteCount;
          case "newest":
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          case "oldest":
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          default:
            return 0;
        }
      })
    : [];

  // Handle entry submission
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !debate || isSubmitting) return;

    const content = entryContent.trim();
    if (!content) {
      setSubmitError("Please enter your answer");
      return;
    }

    if (content.length > 280) {
      setSubmitError("Entry must be 280 characters or less");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          debateId: debate.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit entry");
      }

      const newEntry: EntryResponse = await response.json();

      // Update local state with the new entry
      setDebate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          entries: [newEntry, ...prev.entries],
          userHasSubmitted: true,
          userEntryId: newEntry.id,
        };
      });

      setEntryContent("");
      setJustSubmitted(newEntry);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle voting with optimistic UI update
  // One vote per debate - voting on a new entry removes vote from previous
  const handleVote = async (entry: Entry) => {
    if (!session || !debate) return;

    const wasVoted = entry.hasVoted;
    const originalVoteCount = entry.voteCount;

    // Find if user has voted on another entry
    const previouslyVotedEntry = debate.entries.find(
      (e) => e.hasVoted && e.id !== entry.id
    );

    // Optimistic update
    startTransition(() => {
      setDebate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          entries: prev.entries.map((e) => {
            if (e.id === entry.id) {
              // Toggle vote on clicked entry
              return {
                ...e,
                hasVoted: !wasVoted,
                voteCount: wasVoted ? e.voteCount - 1 : e.voteCount + 1,
              };
            } else if (previouslyVotedEntry && e.id === previouslyVotedEntry.id && !wasVoted) {
              // Remove vote from previously voted entry (only when adding new vote)
              return {
                ...e,
                hasVoted: false,
                voteCount: e.voteCount - 1,
              };
            }
            return e;
          }),
        };
      });
    });

    try {
      let response: Response;

      if (wasVoted) {
        // Remove vote
        response = await fetch(`/api/votes/${entry.id}`, {
          method: "DELETE",
        });
      } else {
        // Add vote (server will handle removing previous vote)
        response = await fetch("/api/votes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entryId: entry.id }),
        });
      }

      if (!response.ok) {
        // Revert on error
        throw new Error("Vote failed");
      }

      const data = await response.json();

      // Update with server response to ensure accuracy
      startTransition(() => {
        setDebate((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            entries: prev.entries.map((e) => {
              if (e.id === entry.id) {
                return {
                  ...e,
                  hasVoted: data.hasVoted,
                  voteCount: data.voteCount,
                };
              } else if (data.previousEntryId && e.id === data.previousEntryId) {
                // Update the entry that lost the vote
                return {
                  ...e,
                  hasVoted: false,
                  voteCount: Math.max(0, e.voteCount - 1),
                };
              }
              return e;
            }),
          };
        });
      });
    } catch {
      // Revert optimistic update on error
      startTransition(() => {
        setDebate((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            entries: prev.entries.map((e) => {
              if (e.id === entry.id) {
                return {
                  ...e,
                  hasVoted: wasVoted,
                  voteCount: originalVoteCount,
                };
              } else if (previouslyVotedEntry && e.id === previouslyVotedEntry.id) {
                // Revert the previously voted entry
                return {
                  ...e,
                  hasVoted: true,
                  voteCount: previouslyVotedEntry.voteCount,
                };
              }
              return e;
            }),
          };
        });
      });
    }
  };

  // No active debate
  if (!debate) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎭</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            No Active Debate
          </h1>
          <p className="text-gray-600">
            Check back soon for the next silly debate!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Share prompt shown right after submitting */}
      {justSubmitted && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          onClick={() => setJustSubmitted(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="share-dialog-title" className="text-xl font-bold text-gray-900 mb-1">
              Your answer is live
            </h2>
            <p className="text-gray-600 mb-4">Share it to get votes.</p>
            <p className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-gray-800 mb-4">
              &ldquo;{justSubmitted.content}&rdquo;
            </p>
            <ShareButtons
              path={`/e/${justSubmitted.id}`}
              text={`"${debate.topic}" Vote for my answer on Silly Debates:`}
              entryId={justSubmitted.id}
              debateId={debate.id}
            />
            <button
              type="button"
              onClick={() => setJustSubmitted(null)}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-800"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-block bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-4 py-1 rounded-full text-sm font-medium mb-4">
          {debateLabel(debate.season, debate.dayNumber)} of {SEASON_LENGTH}
        </div>
        <p className="text-lg text-gray-500 mb-4">Today&apos;s Silly Debate</p>
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent text-4xl md:text-5xl font-bold max-w-2xl mx-auto">
          {debate.topic}
        </h1>
      </div>

      {/* Entry Submission */}
      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-12 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      ) : session ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Submit Your Answer
          </h2>
          <form onSubmit={handleSubmitEntry} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={entryContent}
              onChange={(e) => {
                setEntryContent(e.target.value);
                setSubmitError(null);
              }}
              placeholder="Type your silly answer..."
              maxLength={280}
              className="flex-1 min-w-0 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !entryContent.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </form>
          {submitError && (
            <p className="text-sm text-red-500 mt-2">{submitError}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            {280 - entryContent.length} characters remaining. Submit as many answers as you like!
          </p>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-8 text-center">
          <p className="text-gray-700 mb-4">
            Sign in to submit your answer and vote!
          </p>
          <Link
            href="/auth/signin"
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Sign In to Participate
          </Link>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Entries ({debate.entries.length})
          </h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="votes">Most Votes</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-4">🤔</div>
            <p className="text-gray-600">
              No entries yet. Be the first to submit!
            </p>
          </div>
        ) : (
          sortedEntries.map((entry, index) => {
            // Calculate rank based on sorted position (use index directly since array is sorted)
            const rank = sortBy === "votes" ? index + 1 : null;

            return (
              <div
                key={entry.id}
                className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${
                  entry.isOwnEntry
                    ? "border-purple-200 bg-purple-50/30"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Vote Button or Vote Count */}
                  <div className="flex flex-col items-center gap-2 min-w-[80px]">
                    {entry.isOwnEntry ? (
                      // Own entry - just show vote count
                      <>
                        <div className="px-4 py-2 rounded-full bg-purple-50 text-purple-600 font-medium text-sm">
                          Your entry
                        </div>
                        <span className="text-lg font-bold text-purple-600">
                          {entry.voteCount} {entry.voteCount === 1 ? "vote" : "votes"}
                        </span>
                      </>
                    ) : (
                      // Other entries - show vote button
                      <>
                        <button
                          onClick={() => handleVote(entry)}
                          disabled={!session || isPending}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
                            session
                              ? entry.hasVoted
                                ? "bg-purple-600 text-white hover:bg-purple-700"
                                : "bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-600 border border-gray-200 hover:border-purple-300"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                          title={
                            session
                              ? entry.hasVoted
                                ? "Click to remove vote"
                                : "Click to vote"
                              : "Sign in to vote"
                          }
                        >
                          {entry.hasVoted ? (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" fill="none" />
                              </svg>
                              Voted
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Vote
                            </>
                          )}
                        </button>
                        <span className={`text-lg font-bold ${entry.hasVoted ? "text-purple-600" : "text-gray-600"}`}>
                          {entry.voteCount}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Entry Content */}
                  <div className="flex-1">
                    <Link
                      href={`/e/${entry.id}`}
                      className="block text-gray-800 text-lg hover:text-purple-700"
                    >
                      {entry.content}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                      {entry.user.image ? (
                        <Image
                          src={entry.user.image}
                          alt={entry.user.name || "User"}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-medium">
                          {entry.user.name?.[0] || "?"}
                        </div>
                      )}
                      <span className="text-sm text-gray-500">
                        {entry.user.name || "Anonymous"}
                        {entry.isOwnEntry && (
                          <span className="ml-2 text-purple-600 font-medium">
                            (You)
                          </span>
                        )}
                      </span>
                      <span className="ml-auto">
                        <ShareButtons
                          path={`/e/${entry.id}`}
                          text={
                            entry.isOwnEntry
                              ? `"${debate.topic}" Vote for my answer on Silly Debates:`
                              : `"${debate.topic}" This answer on Silly Debates:`
                          }
                          entryId={entry.id}
                          debateId={debate.id}
                          variant="compact"
                        />
                      </span>
                    </div>
                  </div>

                  {/* Rank Badge (only show for top 3 when sorted by votes) */}
                  {rank !== null && rank <= 3 && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        rank === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : rank === 2
                            ? "bg-gray-100 text-gray-600"
                            : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {rank}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Countdown Timer Placeholder */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          Voting closes once a day. The winner is announced on the Results page.
        </p>
      </div>
    </div>
  );
}

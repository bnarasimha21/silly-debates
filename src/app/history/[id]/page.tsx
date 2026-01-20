import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface DebateEntry {
  id: string;
  content: string;
  voteCount: number;
  isWinner: boolean;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface DebateDetails {
  id: string;
  dayNumber: number;
  topic: string;
  closedAt: Date | null;
  winnerCommentary: string | null;
  entries: DebateEntry[];
  totalVotes: number;
}

async function getDebateDetails(id: string): Promise<DebateDetails | null> {
  const debate = await prisma.debate.findUnique({
    where: { id },
    include: {
      entries: {
        where: { approved: true },
        orderBy: { voteCount: "desc" },
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      },
      winningEntry: true,
    },
  });

  if (!debate || debate.status !== "CLOSED") {
    return null;
  }

  const totalVotes = await prisma.vote.count({
    where: {
      entry: {
        debateId: debate.id,
      },
    },
  });

  return {
    id: debate.id,
    dayNumber: debate.dayNumber,
    topic: debate.topic,
    closedAt: debate.closedAt,
    winnerCommentary: debate.winnerCommentary,
    entries: debate.entries.map((entry) => ({
      id: entry.id,
      content: entry.content,
      voteCount: entry.voteCount,
      isWinner: entry.id === debate.winningEntryId,
      user: {
        name: entry.user.name,
        image: entry.user.image,
      },
    })),
    totalVotes,
  };
}

export default async function DebateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debate = await getDebateDetails(id);

  if (!debate) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/history"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to History
      </Link>

      {/* Debate Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full">
            Day {debate.dayNumber}
          </span>
          {debate.closedAt && (
            <span className="text-gray-500 text-sm">
              {new Date(debate.closedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{debate.topic}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{debate.entries.length} entries</span>
          <span className="text-gray-300">|</span>
          <span>{debate.totalVotes} votes</span>
        </div>
      </div>

      {/* AI Commentary */}
      {debate.winnerCommentary && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🤖</span>
            <span className="text-sm font-medium text-purple-700">AI Commentary</span>
          </div>
          <p className="text-gray-700 italic">&ldquo;{debate.winnerCommentary}&rdquo;</p>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">All Entries</h2>

        {debate.entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`bg-white rounded-xl border p-5 ${
              entry.isWinner
                ? "border-yellow-300 shadow-md ring-2 ring-yellow-100"
                : "border-gray-100 shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {entry.isWinner && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                      <span>🏆</span> Winner
                    </span>
                  )}
                  {index === 0 && !entry.isWinner && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
                      #{index + 1}
                    </span>
                  )}
                  {index > 0 && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
                      #{index + 1}
                    </span>
                  )}
                </div>

                <p className="text-gray-800 mb-3">&ldquo;{entry.content}&rdquo;</p>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {entry.user.image && (
                    <img
                      src={entry.user.image}
                      alt=""
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  <span>{entry.user.name || "Anonymous"}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-purple-600">
                  {entry.voteCount}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.voteCount === 1 ? "vote" : "votes"}
                </div>
              </div>
            </div>
          </div>
        ))}

        {debate.entries.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-gray-500">No entries were submitted for this debate.</p>
          </div>
        )}
      </div>
    </div>
  );
}

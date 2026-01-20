import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface ClosedDebate {
  id: string;
  dayNumber: number;
  topic: string;
  winner: string | null;
  winnerName: string | null;
  totalEntries: number;
  totalVotes: number;
}

/**
 * Fetch all closed debates ordered by dayNumber descending
 */
async function getClosedDebates(): Promise<ClosedDebate[]> {
  const debates = await prisma.debate.findMany({
    where: {
      status: "CLOSED",
    },
    orderBy: {
      dayNumber: "desc",
    },
    include: {
      winningEntry: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          entries: true,
        },
      },
    },
  });

  // Get total votes for each debate
  const debatesWithVotes = await Promise.all(
    debates.map(async (debate) => {
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
        winner: debate.winningEntry?.content || null,
        winnerName: debate.winningEntry?.user.name || null,
        totalEntries: debate._count.entries,
        totalVotes,
      };
    })
  );

  return debatesWithVotes;
}

export default async function HistoryPage() {
  const pastDebates = await getClosedDebates();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Debate History</h1>
        <p className="text-gray-600">Browse all past silly debates</p>
      </div>

      {pastDebates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
          <span className="text-6xl mb-4 block">📚</span>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Past Debates Yet
          </h2>
          <p className="text-gray-600">
            Check back after the current debate closes!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pastDebates.map((debate) => (
            <Link
              key={debate.id}
              href={`/history/${debate.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                      Day {debate.dayNumber}
                    </span>
                    <span className="text-gray-400 text-sm">-</span>
                    <span className="text-gray-500 text-sm">
                      {debate.totalEntries} {debate.totalEntries === 1 ? "entry" : "entries"}
                    </span>
                    <span className="text-gray-400 text-sm">-</span>
                    <span className="text-gray-500 text-sm">
                      {debate.totalVotes} {debate.totalVotes === 1 ? "vote" : "votes"}
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    {debate.topic}
                  </h2>

                  {debate.winner && debate.winnerName && (
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">🏆</span>
                      <span className="text-gray-600 text-sm">
                        <span className="font-medium">{debate.winnerName}:</span>{" "}
                        &ldquo;{debate.winner}&rdquo;
                      </span>
                    </div>
                  )}

                  {!debate.winner && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-500 text-sm italic">
                        No winner selected
                      </span>
                    </div>
                  )}
                </div>

                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

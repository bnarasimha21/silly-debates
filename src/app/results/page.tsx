import { prisma } from "@/lib/prisma";
import Image from "next/image";

/**
 * Fetch the most recently closed debate with winner information
 */
async function getLatestResult() {
  const debate = await prisma.debate.findFirst({
    where: {
      status: "CLOSED",
      winningEntryId: { not: null },
    },
    orderBy: {
      closedAt: "desc",
    },
    include: {
      winningEntry: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
      entries: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          entries: true,
        },
      },
    },
  });

  if (!debate || !debate.winningEntry) {
    return null;
  }

  // Calculate total votes across all entries for this debate
  const totalVotesResult = await prisma.vote.count({
    where: {
      entry: {
        debateId: debate.id,
      },
    },
  });

  return {
    topic: debate.topic,
    dayNumber: debate.dayNumber,
    entry: debate.winningEntry.content,
    user: {
      name: debate.winningEntry.user.name || "Anonymous",
      image: debate.winningEntry.user.image,
    },
    voteCount: debate.winningEntry.voteCount,
    totalVotes: totalVotesResult,
    commentary: debate.winnerCommentary,
  };
}

export default async function ResultsPage() {
  const winner = await getLatestResult();

  // No closed debates with winners yet
  if (!winner) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Latest Results
          </h1>
        </div>

        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-12 text-center">
          <span className="text-6xl mb-4 block">🎯</span>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Results Yet
          </h2>
          <p className="text-gray-600">
            The first debate hasn&apos;t concluded yet. Check back after the current debate closes!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Latest Winner
        </h1>
        <p className="text-gray-600">Day {winner.dayNumber} Results</p>
      </div>

      {/* Winner Card */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-200 p-8 mb-8">
        <div className="flex justify-center mb-4">
          <span className="text-6xl">🏆</span>
        </div>

        <h2 className="text-xl text-gray-600 text-center mb-2">
          {winner.topic}
        </h2>

        <p className="text-2xl font-bold text-gray-900 text-center mb-4">
          &ldquo;{winner.entry}&rdquo;
        </p>

        <div className="flex items-center justify-center gap-2 mb-6">
          {winner.user.image ? (
            <Image
              src={winner.user.image}
              alt={winner.user.name}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
              {winner.user.name[0]}
            </div>
          )}
          <span className="text-lg font-medium text-gray-700">
            {winner.user.name}
          </span>
        </div>

        <div className="flex justify-center gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-purple-600">
              {winner.voteCount}
            </div>
            <div className="text-sm text-gray-500">Votes Won</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-600">
              {winner.totalVotes}
            </div>
            <div className="text-sm text-gray-500">Total Votes</div>
          </div>
        </div>
      </div>

      {/* AI Commentary */}
      {winner.commentary && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h3 className="font-semibold text-gray-800">AI Commentary</h3>
          </div>
          <p className="text-gray-600 italic">&ldquo;{winner.commentary}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

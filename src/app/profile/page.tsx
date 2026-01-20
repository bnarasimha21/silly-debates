import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Image from "next/image";

interface UserEntry {
  id: string;
  debateTopic: string;
  content: string;
  voteCount: number;
  isWinner: boolean;
  dayNumber: number;
}

interface UserStats {
  wins: number;
  totalEntries: number;
  totalVotesReceived: number;
  rank: number | null;
}

/**
 * Fetch user profile data including stats and entries
 */
async function getUserProfileData(userId: string): Promise<{
  stats: UserStats;
  entries: UserEntry[];
}> {
  // Fetch user with their entries and related debate info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      winsCount: true,
      entries: {
        orderBy: { createdAt: "desc" },
        include: {
          debate: {
            select: {
              topic: true,
              dayNumber: true,
              winningEntryId: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      stats: { wins: 0, totalEntries: 0, totalVotesReceived: 0, rank: null },
      entries: [],
    };
  }

  // Calculate total votes received across all user's entries
  const totalVotesReceived = user.entries.reduce(
    (sum, entry) => sum + entry.voteCount,
    0
  );

  // Calculate user's rank based on winsCount
  // Only users with at least 1 win are ranked
  let rank: number | null = null;
  if (user.winsCount > 0) {
    const usersWithMoreWins = await prisma.user.count({
      where: {
        winsCount: {
          gt: user.winsCount,
        },
      },
    });
    rank = usersWithMoreWins + 1;
  }

  // Transform entries to the expected format
  const entries: UserEntry[] = user.entries.map((entry) => ({
    id: entry.id,
    debateTopic: entry.debate.topic,
    content: entry.content,
    voteCount: entry.voteCount,
    isWinner: entry.debate.winningEntryId === entry.id,
    dayNumber: entry.debate.dayNumber,
  }));

  return {
    stats: {
      wins: user.winsCount,
      totalEntries: user.entries.length,
      totalVotesReceived,
      rank,
    },
    entries,
  };
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { stats: userStats, entries: userEntries } = await getUserProfileData(
    session.user.id
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center gap-6">
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || "User"}
              width={96}
              height={96}
              className="rounded-full border-4 border-white/30"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold">
              {(session.user?.name?.[0] || session.user?.email?.[0] || "U").toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">
              {session.user?.name && !session.user.name.includes("@")
                ? session.user.name
                : session.user?.email?.split("@")[0] || "User"}
            </h1>
            <p className="text-white/80">{session.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-purple-600">{userStats.wins}</div>
          <div className="text-sm text-gray-500">Wins</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-gray-700">
            {userStats.rank ? `#${userStats.rank}` : "-"}
          </div>
          <div className="text-sm text-gray-500">Rank</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-gray-700">
            {userStats.totalEntries}
          </div>
          <div className="text-sm text-gray-500">Entries</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-gray-700">
            {userStats.totalVotesReceived}
          </div>
          <div className="text-sm text-gray-500">Votes Received</div>
        </div>
      </div>

      {/* User's Entries */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Entries</h2>
        {userEntries.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              You haven&apos;t submitted any entries yet. Join a debate to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {userEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                        Day {entry.dayNumber}
                      </span>
                      {entry.isWinner && (
                        <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                          Winner
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{entry.debateTopic}</p>
                    <p className="text-gray-800 font-medium">
                      &ldquo;{entry.content}&rdquo;
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {entry.voteCount}
                    </div>
                    <div className="text-xs text-gray-500">votes</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

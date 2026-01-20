import { prisma } from "@/lib/prisma";
import Image from "next/image";

interface LeaderboardUser {
  id: string;
  name: string;
  image: string | null;
  wins: number;
  totalVotes: number;
}

/**
 * Fetch users ranked by winsCount with their total votes received
 */
async function getLeaderboard(): Promise<LeaderboardUser[]> {
  // Get users with at least 1 win, ordered by wins
  const usersWithWins = await prisma.user.findMany({
    where: {
      winsCount: {
        gt: 0,
      },
    },
    orderBy: [
      { winsCount: "desc" },
      { createdAt: "asc" }, // Tiebreaker: earlier users first
    ],
    select: {
      id: true,
      name: true,
      image: true,
      winsCount: true,
    },
  });

  // Get total votes received for each user's entries
  const leaderboard = await Promise.all(
    usersWithWins.map(async (user) => {
      const totalVotes = await prisma.vote.count({
        where: {
          entry: {
            userId: user.id,
          },
        },
      });

      return {
        id: user.id,
        name: user.name || "Anonymous",
        image: user.image,
        wins: user.winsCount,
        totalVotes,
      };
    })
  );

  return leaderboard;
}

export default async function LeaderboardPage() {
  const topWinners = await getLeaderboard();

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case 2:
        return "bg-gray-100 text-gray-600 border-gray-300";
      case 3:
        return "bg-orange-100 text-orange-700 border-orange-300";
      default:
        return "bg-white text-gray-600 border-gray-200";
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  };

  // Empty state
  if (topWinners.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboard</h1>
          <p className="text-gray-600">Top debaters of the month</p>
        </div>

        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
          <span className="text-6xl mb-4 block">🏆</span>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Winners Yet
          </h2>
          <p className="text-gray-600">
            The leaderboard will populate as debates conclude and winners are crowned!
          </p>
        </div>
      </div>
    );
  }

  // Get top 3 for podium (with fallbacks for fewer winners)
  const first = topWinners[0];
  const second = topWinners[1];
  const third = topWinners[2];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Leaderboard</h1>
        <p className="text-gray-600">Top debaters of the month</p>
      </div>

      {/* Top 3 Podium */}
      <div className="flex justify-center items-end gap-4 mb-12">
        {/* 2nd Place */}
        <div className="text-center">
          {second ? (
            <>
              {second.image ? (
                <Image
                  src={second.image}
                  alt={second.name}
                  width={80}
                  height={80}
                  className="mx-auto mb-2 rounded-full"
                />
              ) : (
                <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-2xl font-bold">
                  {second.name[0]}
                </div>
              )}
              <div className="text-3xl mb-1">🥈</div>
              <div className="font-semibold text-gray-800">{second.name}</div>
              <div className="text-sm text-gray-500">{second.wins} {second.wins === 1 ? "win" : "wins"}</div>
              <div className="bg-gray-200 h-24 w-24 rounded-t-lg mt-2"></div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl font-bold">
                ?
              </div>
              <div className="text-3xl mb-1">🥈</div>
              <div className="font-semibold text-gray-400">TBD</div>
              <div className="text-sm text-gray-400">- wins</div>
              <div className="bg-gray-200 h-24 w-24 rounded-t-lg mt-2"></div>
            </>
          )}
        </div>

        {/* 1st Place */}
        <div className="text-center">
          {first ? (
            <>
              {first.image ? (
                <Image
                  src={first.image}
                  alt={first.name}
                  width={96}
                  height={96}
                  className="mx-auto mb-2 rounded-full shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                  {first.name[0]}
                </div>
              )}
              <div className="text-4xl mb-1">🥇</div>
              <div className="font-bold text-lg text-gray-800">{first.name}</div>
              <div className="text-sm text-gray-500">{first.wins} {first.wins === 1 ? "win" : "wins"}</div>
              <div className="bg-yellow-200 h-32 w-28 rounded-t-lg mt-2"></div>
            </>
          ) : (
            <>
              <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-3xl font-bold shadow-lg">
                ?
              </div>
              <div className="text-4xl mb-1">🥇</div>
              <div className="font-bold text-lg text-gray-400">TBD</div>
              <div className="text-sm text-gray-400">- wins</div>
              <div className="bg-yellow-200 h-32 w-28 rounded-t-lg mt-2"></div>
            </>
          )}
        </div>

        {/* 3rd Place */}
        <div className="text-center">
          {third ? (
            <>
              {third.image ? (
                <Image
                  src={third.image}
                  alt={third.name}
                  width={80}
                  height={80}
                  className="mx-auto mb-2 rounded-full"
                />
              ) : (
                <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-orange-300 to-orange-400 flex items-center justify-center text-white text-2xl font-bold">
                  {third.name[0]}
                </div>
              )}
              <div className="text-3xl mb-1">🥉</div>
              <div className="font-semibold text-gray-800">{third.name}</div>
              <div className="text-sm text-gray-500">{third.wins} {third.wins === 1 ? "win" : "wins"}</div>
              <div className="bg-orange-200 h-16 w-24 rounded-t-lg mt-2"></div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl font-bold">
                ?
              </div>
              <div className="text-3xl mb-1">🥉</div>
              <div className="font-semibold text-gray-400">TBD</div>
              <div className="text-sm text-gray-400">- wins</div>
              <div className="bg-orange-200 h-16 w-24 rounded-t-lg mt-2"></div>
            </>
          )}
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Rank
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                Player
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                Wins
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
                Total Votes
              </th>
            </tr>
          </thead>
          <tbody>
            {topWinners.map((player, index) => {
              const rank = index + 1;
              return (
                <tr
                  key={player.id}
                  className={`border-b border-gray-50 ${getRankStyle(rank)}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getRankEmoji(rank) && (
                        <span className="text-xl">{getRankEmoji(rank)}</span>
                      )}
                      <span className="font-semibold">#{rank}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {player.image ? (
                        <Image
                          src={player.image}
                          alt={player.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
                          {player.name[0]}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-purple-600">
                    {player.wins}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {player.totalVotes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Knowledge Base Service for Silly Debates
 *
 * This service provides structured access to debate history for the RAG chatbot.
 * It fetches data from PostgreSQL and formats it for AI context.
 */

import { prisma } from "./prisma";
import { SEASON_LENGTH } from "./site";
import type { DebateContext } from "./ai";

/**
 * Fetch comprehensive debate history for RAG context
 */
export async function getDebateHistory(): Promise<DebateContext> {
  // Fetch all debates with winners
  const debates = await prisma.debate.findMany({
    orderBy: { createdAt: "desc" },
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

  // Calculate vote counts for each debate
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
        status: debate.status,
        totalEntries: debate._count.entries,
        totalVotes,
        winner: debate.winningEntry
          ? {
              userName: debate.winningEntry.user.name || "Anonymous",
              entry: debate.winningEntry.content,
              votes: debate.winningEntry.voteCount,
            }
          : undefined,
        commentary: debate.winnerCommentary || undefined,
      };
    })
  );

  // Get overall statistics
  const totalEntries = await prisma.entry.count();
  const totalVotes = await prisma.vote.count();

  // Get top winners
  const topWinners = await prisma.user.findMany({
    where: {
      winsCount: { gt: 0 },
    },
    orderBy: {
      winsCount: "desc",
    },
    take: 10,
    select: {
      name: true,
      winsCount: true,
    },
  });

  return {
    debates: debatesWithVotes,
    stats: {
      totalDebates: debates.filter((d) => d.status === "CLOSED").length,
      totalEntries,
      totalVotes,
      topWinners: topWinners.map((w) => ({
        name: w.name || "Anonymous",
        wins: w.winsCount,
      })),
    },
  };
}

/**
 * Get list of all previous debate topics (for topic generation)
 */
export async function getPreviousTopics(): Promise<string[]> {
  const debates = await prisma.debate.findMany({
    select: {
      topic: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    // Enough history to avoid repeats without growing the prompt forever.
    take: 120,
  });

  return debates.map((d) => d.topic);
}

/**
 * Get the season and day number for the next debate.
 * After the last day of a season, the next debate is Day 1 of a new season.
 */
export async function getNextDebateSlot(): Promise<{ season: number; dayNumber: number }> {
  const lastDebate = await prisma.debate.findFirst({
    orderBy: [{ season: "desc" }, { dayNumber: "desc" }],
    select: { season: true, dayNumber: true },
  });

  if (!lastDebate) return { season: 1, dayNumber: 1 };
  if (lastDebate.dayNumber >= SEASON_LENGTH) {
    return { season: lastDebate.season + 1, dayNumber: 1 };
  }
  return { season: lastDebate.season, dayNumber: lastDebate.dayNumber + 1 };
}

/**
 * Get current active debate
 */
export async function getActiveDebate() {
  return prisma.debate.findFirst({
    where: { status: "ACTIVE" },
    include: {
      entries: {
        where: { approved: true },
        orderBy: { voteCount: "desc" },
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
    },
  });
}

/**
 * Search debates by topic keyword
 */
export async function searchDebates(query: string): Promise<DebateContext["debates"]> {
  const debates = await prisma.debate.findMany({
    where: {
      topic: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "desc" },
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

  return Promise.all(
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
        status: debate.status,
        totalEntries: debate._count.entries,
        totalVotes,
        winner: debate.winningEntry
          ? {
              userName: debate.winningEntry.user.name || "Anonymous",
              entry: debate.winningEntry.content,
              votes: debate.winningEntry.voteCount,
            }
          : undefined,
        commentary: debate.winnerCommentary || undefined,
      };
    })
  );
}

/**
 * Get debate by day number
 */
export async function getDebateByDay(dayNumber: number, season = 1) {
  return prisma.debate.findUnique({
    where: { season_dayNumber: { season, dayNumber } },
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
        where: { approved: true },
        orderBy: { voteCount: "desc" },
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
    },
  });
}

/**
 * Export debate history as JSON for backup/analytics
 */
export async function exportDebateHistory(): Promise<string> {
  const context = await getDebateHistory();
  return JSON.stringify(context, null, 2);
}

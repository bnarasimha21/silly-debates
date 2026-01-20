import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DebateView } from "@/components/debate-view";
import type { Debate } from "@/types";

/**
 * Fetch today's active debate with entries
 * Includes vote status if user is authenticated
 */
async function getTodaysDebate(userId?: string): Promise<Debate | null> {
  const debate = await prisma.debate.findFirst({
    where: {
      status: "ACTIVE",
    },
    include: {
      entries: {
        where: {
          approved: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          votes: userId
            ? {
                where: {
                  userId: userId,
                },
                select: {
                  id: true,
                },
              }
            : false,
        },
        orderBy: {
          voteCount: "desc",
        },
      },
    },
  });

  if (!debate) {
    return null;
  }

  // Transform the response to match our Debate type
  const entriesWithVoteStatus = debate.entries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    voteCount: entry.voteCount,
    createdAt: entry.createdAt.toISOString(),
    user: {
      id: entry.user.id,
      name: entry.user.name,
      image: entry.user.image,
    },
    hasVoted: userId ? (entry.votes as { id: string }[])?.length > 0 : false,
    isOwnEntry: userId ? entry.userId === userId : false,
  }));

  // Check if user already submitted an entry
  const userEntry = userId
    ? debate.entries.find((e) => e.userId === userId)
    : null;

  return {
    id: debate.id,
    topic: debate.topic,
    dayNumber: debate.dayNumber,
    status: debate.status,
    createdAt: debate.createdAt.toISOString(),
    entries: entriesWithVoteStatus,
    userHasSubmitted: !!userEntry,
    userEntryId: userEntry?.id || null,
  };
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch debate data on the server
  const debate = await getTodaysDebate(userId);

  return <DebateView initialDebate={debate} />;
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/debates/today
 * Returns today's active debate with all entries and vote information
 * If user is authenticated, includes whether they voted on each entry
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Get the active debate with entries ordered by vote count
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
      return NextResponse.json(
        { error: "No active debate found" },
        { status: 404 }
      );
    }

    // Transform the response to include hasVoted flag and check for user's entry
    const entriesWithVoteStatus = debate.entries.map((entry) => ({
      id: entry.id,
      content: entry.content,
      voteCount: entry.voteCount,
      createdAt: entry.createdAt,
      user: entry.user,
      hasVoted: userId ? (entry.votes as { id: string }[])?.length > 0 : false,
      isOwnEntry: userId ? entry.userId === userId : false,
    }));

    // Check if user already submitted an entry
    const userEntry = userId
      ? debate.entries.find((e) => e.userId === userId)
      : null;

    return NextResponse.json({
      id: debate.id,
      topic: debate.topic,
      dayNumber: debate.dayNumber,
      status: debate.status,
      createdAt: debate.createdAt,
      entries: entriesWithVoteStatus,
      userHasSubmitted: !!userEntry,
      userEntryId: userEntry?.id || null,
    });
  } catch (error) {
    console.error("Error fetching today's debate:", error);
    return NextResponse.json(
      { error: "Failed to fetch debate" },
      { status: 500 }
    );
  }
}

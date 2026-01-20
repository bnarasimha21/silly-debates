import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWinnerCommentary } from "@/lib/ai";
import {
  uploadDebateToSpaces,
  uploadDebateAsTextToSpaces,
  isSpacesConfigured,
  type DebateKBData,
} from "@/lib/spaces";

// Secret key for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/close-debate
 * Close the current active debate and announce the winner
 *
 * This endpoint should be called by a cron job at the end of each day.
 * It:
 * 1. Closes the active debate
 * 2. Determines the winner (highest votes)
 * 3. Generates AI commentary for the winner
 * 4. Updates the winner's win count
 *
 * Security: Requires CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate cron request
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find the active debate
    const activeDebate = await prisma.debate.findFirst({
      where: { status: "ACTIVE" },
      include: {
        entries: {
          where: { approved: true },
          orderBy: { voteCount: "desc" },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!activeDebate) {
      return NextResponse.json(
        { error: "No active debate to close" },
        { status: 404 }
      );
    }

    // Determine the winner
    const winningEntry = activeDebate.entries[0];

    let winnerCommentary: string | null = null;

    if (winningEntry) {
      // Generate AI commentary for the winner
      try {
        winnerCommentary = await generateWinnerCommentary(
          activeDebate.topic,
          winningEntry.content,
          winningEntry.user.name || "Anonymous",
          winningEntry.voteCount
        );
      } catch (commentaryError) {
        console.error("Failed to generate winner commentary:", commentaryError);
        // Continue without commentary if AI fails
      }

      // Update the winner's win count
      await prisma.user.update({
        where: { id: winningEntry.user.id },
        data: {
          winsCount: { increment: 1 },
        },
      });
    }

    // Close the debate
    const closedDebate = await prisma.debate.update({
      where: { id: activeDebate.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        winningEntryId: winningEntry?.id || null,
        winnerCommentary,
      },
      include: {
        winningEntry: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    });

    // Get total votes for this debate
    const totalVotes = await prisma.vote.count({
      where: {
        entry: {
          debateId: activeDebate.id,
        },
      },
    });

    // Sync to Spaces for Knowledge Base
    if (isSpacesConfigured()) {
      try {
        // Get top entries for KB
        const topEntries = await prisma.entry.findMany({
          where: { debateId: activeDebate.id, approved: true },
          orderBy: { voteCount: "desc" },
          take: 5,
          include: {
            user: { select: { name: true } },
          },
        });

        const runnerUp = topEntries[1] || null;

        const debateKBData: DebateKBData = {
          id: closedDebate.id,
          dayNumber: closedDebate.dayNumber,
          date: closedDebate.closedAt?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
          topic: closedDebate.topic,
          totalEntries: closedDebate._count.entries,
          totalVotes,
          winner: closedDebate.winningEntry
            ? {
                userName: closedDebate.winningEntry.user.name || "Anonymous",
                entry: closedDebate.winningEntry.content,
                votes: closedDebate.winningEntry.voteCount,
              }
            : null,
          runnerUp: runnerUp
            ? {
                userName: runnerUp.user.name || "Anonymous",
                entry: runnerUp.content,
                votes: runnerUp.voteCount,
              }
            : null,
          commentary: closedDebate.winnerCommentary,
          topEntries: topEntries.map((e) => ({
            userName: e.user.name || "Anonymous",
            entry: e.content,
            votes: e.voteCount,
          })),
        };

        // Upload both JSON and text versions for better KB indexing
        await Promise.all([
          uploadDebateToSpaces(debateKBData),
          uploadDebateAsTextToSpaces(debateKBData),
        ]);

        console.log(`Synced debate day ${closedDebate.dayNumber} to Knowledge Base`);
      } catch (spacesError) {
        console.error("Failed to sync to Spaces (non-fatal):", spacesError);
        // Don't fail the request if Spaces sync fails
      }
    }

    return NextResponse.json({
      success: true,
      debate: {
        id: closedDebate.id,
        topic: closedDebate.topic,
        dayNumber: closedDebate.dayNumber,
        closedAt: closedDebate.closedAt,
        totalEntries: closedDebate._count.entries,
        totalVotes,
        winner: closedDebate.winningEntry
          ? {
              id: closedDebate.winningEntry.id,
              entry: closedDebate.winningEntry.content,
              userName: closedDebate.winningEntry.user.name,
              votes: closedDebate.winningEntry.voteCount,
            }
          : null,
        commentary: closedDebate.winnerCommentary,
      },
    });
  } catch (error) {
    console.error("Error closing debate:", error);
    return NextResponse.json(
      { error: "Failed to close debate" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/close-debate
 * Preview what would happen if we close the current debate
 */
export async function GET() {
  try {
    const activeDebate = await prisma.debate.findFirst({
      where: { status: "ACTIVE" },
      include: {
        entries: {
          where: { approved: true },
          orderBy: { voteCount: "desc" },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    });

    if (!activeDebate) {
      return NextResponse.json({
        hasActiveDebate: false,
        message: "No active debate to close",
      });
    }

    const totalVotes = await prisma.vote.count({
      where: {
        entry: {
          debateId: activeDebate.id,
        },
      },
    });

    return NextResponse.json({
      hasActiveDebate: true,
      debate: {
        id: activeDebate.id,
        topic: activeDebate.topic,
        dayNumber: activeDebate.dayNumber,
        createdAt: activeDebate.createdAt,
        totalEntries: activeDebate._count.entries,
        totalVotes,
        topEntries: activeDebate.entries.map((e) => ({
          id: e.id,
          content: e.content,
          votes: e.voteCount,
          userName: e.user.name,
        })),
        potentialWinner: activeDebate.entries[0]
          ? {
              id: activeDebate.entries[0].id,
              content: activeDebate.entries[0].content,
              votes: activeDebate.entries[0].voteCount,
              userName: activeDebate.entries[0].user.name,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error previewing debate close:", error);
    return NextResponse.json(
      { error: "Failed to preview debate close" },
      { status: 500 }
    );
  }
}

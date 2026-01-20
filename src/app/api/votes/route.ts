import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/votes
 * Cast a vote for an entry
 * Requires authentication
 * One vote per user per debate (voting for a new entry removes vote from previous)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to vote" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { entryId } = body;

    // Validate entryId
    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Check if the entry exists and belongs to an active debate
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        debate: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.debate.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This debate is no longer active" },
        { status: 400 }
      );
    }

    const debateId = entry.debate.id;

    // Check if user already voted for this specific entry
    const existingVoteOnThisEntry = await prisma.vote.findUnique({
      where: {
        entryId_userId: {
          entryId: entryId,
          userId: userId,
        },
      },
    });

    if (existingVoteOnThisEntry) {
      return NextResponse.json(
        { error: "You have already voted for this entry" },
        { status: 409 }
      );
    }

    // Check if user has voted on another entry in this debate
    const existingVoteInDebate = await prisma.vote.findFirst({
      where: {
        userId: userId,
        entry: {
          debateId: debateId,
        },
      },
      include: {
        entry: true,
      },
    });

    // Use transaction to handle vote switching
    if (existingVoteInDebate) {
      // Remove old vote and create new one
      const [, , updatedEntry] = await prisma.$transaction([
        // Delete old vote
        prisma.vote.delete({
          where: { id: existingVoteInDebate.id },
        }),
        // Decrement old entry's vote count
        prisma.entry.update({
          where: { id: existingVoteInDebate.entryId },
          data: {
            voteCount: {
              decrement: 1,
            },
          },
        }),
        // Create new vote and increment new entry's vote count
        prisma.entry.update({
          where: { id: entryId },
          data: {
            voteCount: {
              increment: 1,
            },
          },
        }),
        prisma.vote.create({
          data: {
            entryId: entryId,
            userId: userId,
          },
        }),
      ]);

      return NextResponse.json(
        {
          entryId: entryId,
          voteCount: updatedEntry.voteCount,
          hasVoted: true,
          previousEntryId: existingVoteInDebate.entryId,
        },
        { status: 200 }
      );
    } else {
      // No existing vote, create new one
      const [vote, updatedEntry] = await prisma.$transaction([
        prisma.vote.create({
          data: {
            entryId: entryId,
            userId: userId,
          },
        }),
        prisma.entry.update({
          where: { id: entryId },
          data: {
            voteCount: {
              increment: 1,
            },
          },
        }),
      ]);

      return NextResponse.json(
        {
          voteId: vote.id,
          entryId: updatedEntry.id,
          voteCount: updatedEntry.voteCount,
          hasVoted: true,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error casting vote:", error);

    // Handle unique constraint violation (race condition)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "You have already voted for this entry" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}

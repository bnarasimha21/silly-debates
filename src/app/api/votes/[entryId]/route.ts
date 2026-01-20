import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{
    entryId: string;
  }>;
}

/**
 * DELETE /api/votes/[entryId]
 * Remove a vote from an entry
 * Requires authentication
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to remove a vote" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { entryId } = await params;

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

    // Check if user has voted for this entry
    const existingVote = await prisma.vote.findUnique({
      where: {
        entryId_userId: {
          entryId: entryId,
          userId: userId,
        },
      },
    });

    if (!existingVote) {
      return NextResponse.json(
        { error: "You have not voted for this entry" },
        { status: 404 }
      );
    }

    // Delete vote and decrement entry vote count in a transaction
    const [, updatedEntry] = await prisma.$transaction([
      prisma.vote.delete({
        where: {
          id: existingVote.id,
        },
      }),
      prisma.entry.update({
        where: { id: entryId },
        data: {
          voteCount: {
            decrement: 1,
          },
        },
      }),
    ]);

    return NextResponse.json({
      entryId: updatedEntry.id,
      voteCount: updatedEntry.voteCount,
      hasVoted: false,
    });
  } catch (error) {
    console.error("Error removing vote:", error);
    return NextResponse.json(
      { error: "Failed to remove vote" },
      { status: 500 }
    );
  }
}

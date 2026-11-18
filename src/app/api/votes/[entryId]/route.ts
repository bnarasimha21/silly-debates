import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/track";
import { resolveVoter, votesOf } from "@/lib/voter";

interface RouteParams {
  params: Promise<{
    entryId: string;
  }>;
}

/**
 * DELETE /api/votes/[entryId]
 * Remove the caller's vote from an entry (signed-in or anonymous).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const voter = await resolveVoter();
    if (!voter) {
      return NextResponse.json(
        { error: "You have not voted for this entry" },
        { status: 404 }
      );
    }

    const { entryId } = await params;

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: { debateId: true, debate: { select: { status: true } } },
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

    const existingVote = await prisma.vote.findFirst({
      where: { ...votesOf(voter), entryId },
      select: { id: true },
    });
    if (!existingVote) {
      return NextResponse.json(
        { error: "You have not voted for this entry" },
        { status: 404 }
      );
    }

    const [, updatedEntry] = await prisma.$transaction([
      prisma.vote.delete({ where: { id: existingVote.id } }),
      prisma.entry.update({
        where: { id: entryId },
        data: { voteCount: { decrement: 1 } },
        select: { id: true, voteCount: true },
      }),
    ]);

    await track("vote_removed", {
      visitorId: voter.visitorId,
      userId: voter.userId,
      debateId: entry.debateId,
      entryId,
    });

    return NextResponse.json({
      entryId: updatedEntry.id,
      voteCount: updatedEntry.voteCount,
      hasVoted: false,
    });
  } catch (error) {
    console.error("Error removing vote:", error);
    return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
  }
}

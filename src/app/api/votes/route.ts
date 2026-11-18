import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/track";
import {
  ipLimitReached,
  looksAutomated,
  requestIpHash,
  resolveVoter,
  votesOf,
} from "@/lib/voter";

/**
 * POST /api/votes
 * Cast a vote for an entry.
 *
 * Signed-in people vote as their account. Everyone else votes as their
 * anonymous visitor cookie, subject to a per-network limit.
 * One vote per voter per debate: voting for a new entry moves the vote.
 */
export async function POST(request: NextRequest) {
  try {
    const voter = await resolveVoter();
    if (!voter) {
      // The browser has no visitor cookie yet. The client fetches one
      // (POST /api/events) and retries.
      return NextResponse.json(
        { error: "Please enable cookies to vote", code: "no_visitor" },
        { status: 401 }
      );
    }

    if (voter.kind === "visitor" && looksAutomated(request)) {
      return NextResponse.json({ error: "Sign in to vote" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const entryId = body?.entryId;
    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: {
        approved: true,
        userId: true,
        debate: { select: { id: true, status: true } },
      },
    });

    if (!entry || !entry.approved) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (entry.debate.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This debate is no longer active" },
        { status: 400 }
      );
    }
    if (voter.kind === "user" && entry.userId === voter.userId) {
      return NextResponse.json(
        { error: "You can't vote for your own entry" },
        { status: 400 }
      );
    }

    const debateId = entry.debate.id;
    const mine = votesOf(voter);

    const existingVoteOnThisEntry = await prisma.vote.findFirst({
      where: { ...mine, entryId },
      select: { id: true },
    });
    if (existingVoteOnThisEntry) {
      return NextResponse.json(
        { error: "You have already voted for this entry" },
        { status: 409 }
      );
    }

    const ipHash = voter.kind === "visitor" ? requestIpHash(request) : null;
    if (
      voter.kind === "visitor" &&
      (await ipLimitReached(debateId, ipHash, voter.visitorId))
    ) {
      return NextResponse.json(
        {
          error: "Too many votes from your network today. Sign in to vote.",
          code: "ip_limit",
        },
        { status: 429 }
      );
    }

    // The voter's current vote in this debate, if any, moves to the new entry.
    const previous = await prisma.vote.findFirst({
      where: { ...mine, entry: { debateId } },
      select: { id: true, entryId: true },
    });

    const updatedEntry = await prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.vote.delete({ where: { id: previous.id } });
        await tx.entry.update({
          where: { id: previous.entryId },
          data: { voteCount: { decrement: 1 } },
        });
      }
      await tx.vote.create({
        data:
          voter.kind === "user"
            ? { entryId, userId: voter.userId }
            : { entryId, visitorId: voter.visitorId, ipHash },
      });
      return tx.entry.update({
        where: { id: entryId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      });
    });

    await track("vote", {
      visitorId: voter.visitorId,
      userId: voter.userId,
      debateId,
      entryId,
      props: { switched: !!previous, anonymous: voter.kind === "visitor" },
    });

    return NextResponse.json(
      {
        entryId,
        voteCount: updatedEntry.voteCount,
        hasVoted: true,
        ...(previous ? { previousEntryId: previous.entryId } : {}),
      },
      { status: previous ? 200 : 201 }
    );
  } catch (error) {
    console.error("Error casting vote:", error);

    // Two requests raced; the unique index kept the vote single.
    if (error instanceof Error && error.message.includes("Unique constraint failed")) {
      return NextResponse.json(
        { error: "You have already voted for this entry" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}

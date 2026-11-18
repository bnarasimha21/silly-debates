import { prisma } from "./prisma";

/**
 * Pick the winning entry of a debate.
 *
 * Most votes wins. Among entries tied on votes, the one with more votes from
 * signed-in accounts wins; if still tied, the one submitted first.
 */
export async function pickWinner(debateId: string) {
  const top = await prisma.entry.findFirst({
    where: { debateId, approved: true },
    orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
    select: { voteCount: true },
  });
  if (!top) return null;

  const tied = await prisma.entry.findMany({
    where: { debateId, approved: true, voteCount: top.voteCount },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });
  if (tied.length === 1) return tied[0];

  const signedIn = await prisma.vote.groupBy({
    by: ["entryId"],
    where: { entryId: { in: tied.map((e) => e.id) }, userId: { not: null } },
    _count: { _all: true },
  });
  const signedInVotes = new Map(signedIn.map((row) => [row.entryId, row._count._all]));

  // `tied` is already oldest-first, so a stable sort keeps the earliest ahead.
  return [...tied].sort(
    (a, b) => (signedInVotes.get(b.id) ?? 0) - (signedInVotes.get(a.id) ?? 0)
  )[0];
}

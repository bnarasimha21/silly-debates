import { prisma } from "./prisma";
import type { Debate, Entry } from "@/types";

/** Who is looking at the page. Either field may be missing. */
export interface Viewer {
  userId: string | null;
  visitorId: string | null;
}

const userSelect = { id: true, name: true, image: true } as const;

/** Prisma filter matching votes cast by this viewer. Null when there is no identity. */
export function viewerVoteFilter(viewer: Viewer) {
  if (viewer.userId) return { userId: viewer.userId };
  if (viewer.visitorId) return { visitorId: viewer.visitorId };
  return null;
}

/**
 * Load a debate with its approved entries, shaped for the client.
 * Pass an id for a specific debate, or nothing for the active one.
 */
export async function getDebateForViewer(
  viewer: Viewer,
  id?: string
): Promise<Debate | null> {
  const voteFilter = viewerVoteFilter(viewer);
  const debate = await prisma.debate.findFirst({
    where: id ? { id } : { status: "ACTIVE" },
    include: {
      entries: {
        where: { approved: true },
        include: {
          user: { select: userSelect },
          votes: voteFilter ? { where: voteFilter, select: { id: true } } : false,
        },
        orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!debate) return null;

  const entries: Entry[] = debate.entries.map((entry) => ({
    id: entry.id,
    content: entry.content,
    voteCount: entry.voteCount,
    createdAt: entry.createdAt.toISOString(),
    user: entry.user,
    hasVoted: voteFilter ? (entry.votes as { id: string }[]).length > 0 : false,
    isOwnEntry: !!viewer.userId && entry.userId === viewer.userId,
  }));

  const ownEntry = entries.find((e) => e.isOwnEntry);

  return {
    id: debate.id,
    topic: debate.topic,
    season: debate.season,
    dayNumber: debate.dayNumber,
    status: debate.status,
    createdAt: debate.createdAt.toISOString(),
    entries,
    userHasSubmitted: !!ownEntry,
    userEntryId: ownEntry?.id ?? null,
  };
}

export interface EntryPageData {
  entry: Entry;
  isWinner: boolean;
  debate: {
    id: string;
    topic: string;
    season: number;
    dayNumber: number;
    status: "ACTIVE" | "CLOSED";
    entryCount: number;
    winnerCommentary: string | null;
  };
}

/** Load one approved entry with its debate, for the entry page and share cards. */
export async function getEntryForViewer(
  viewer: Viewer,
  id: string
): Promise<EntryPageData | null> {
  const voteFilter = viewerVoteFilter(viewer);
  const entry = await prisma.entry.findUnique({
    where: { id },
    include: {
      user: { select: userSelect },
      votes: voteFilter ? { where: voteFilter, select: { id: true } } : false,
      debate: {
        include: { _count: { select: { entries: { where: { approved: true } } } } },
      },
    },
  });

  if (!entry || !entry.approved) return null;

  return {
    entry: {
      id: entry.id,
      content: entry.content,
      voteCount: entry.voteCount,
      createdAt: entry.createdAt.toISOString(),
      user: entry.user,
      hasVoted: voteFilter ? (entry.votes as { id: string }[]).length > 0 : false,
      isOwnEntry: !!viewer.userId && entry.userId === viewer.userId,
    },
    isWinner: entry.debate.winningEntryId === entry.id,
    debate: {
      id: entry.debate.id,
      topic: entry.debate.topic,
      season: entry.debate.season,
      dayNumber: entry.debate.dayNumber,
      status: entry.debate.status,
      entryCount: entry.debate._count.entries,
      winnerCommentary: entry.debate.winnerCommentary,
    },
  };
}

/** The current viewer, from the session and the visitor cookie. */
export async function getViewer(): Promise<Viewer> {
  const [{ auth }, { getVisitorId }] = await Promise.all([
    import("./auth"),
    import("./visitor"),
  ]);
  const [session, visitorId] = await Promise.all([auth(), getVisitorId()]);
  return { userId: session?.user?.id ?? null, visitorId };
}

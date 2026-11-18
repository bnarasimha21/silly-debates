import { prisma } from "./prisma";
import { debateLabel } from "./site";
import type { CardContent } from "./og";

/** Card content for a single entry, or null if it should not be shown. */
export async function entryCard(id: string): Promise<CardContent | null> {
  const entry = await prisma.entry.findUnique({
    where: { id },
    select: {
      content: true,
      approved: true,
      user: { select: { name: true } },
      debate: {
        select: { topic: true, season: true, dayNumber: true, status: true, winningEntryId: true },
      },
    },
  });
  if (!entry || !entry.approved) return null;

  const day = debateLabel(entry.debate.season, entry.debate.dayNumber);
  const isWinner = entry.debate.winningEntryId === id;
  const open = entry.debate.status === "ACTIVE";

  return {
    label: isWinner ? `Winner · ${day}` : day,
    topic: entry.debate.topic,
    answer: entry.content,
    author: entry.user.name || "Anonymous",
    cta: isWinner ? "Winning answer" : open ? "Vote for this answer" : "See all the answers",
    highlight: isWinner,
  };
}

/** Card content for a debate (by id, or the active one). */
export async function debateCard(id?: string): Promise<CardContent | null> {
  const debate = await prisma.debate.findFirst({
    where: id ? { id } : { status: "ACTIVE" },
    select: {
      topic: true,
      season: true,
      dayNumber: true,
      status: true,
      winningEntry: { select: { content: true, user: { select: { name: true } } } },
    },
  });
  if (!debate) return null;

  const day = debateLabel(debate.season, debate.dayNumber);
  if (debate.status === "CLOSED" && debate.winningEntry) {
    return {
      label: `Winner · ${day}`,
      topic: debate.topic,
      answer: debate.winningEntry.content,
      author: debate.winningEntry.user.name || "Anonymous",
      cta: "See all the answers",
      highlight: true,
    };
  }
  return {
    label: debate.status === "ACTIVE" ? `Today's debate · ${day}` : day,
    topic: debate.topic,
    cta: debate.status === "ACTIVE" ? "Add your answer and vote" : "See the answers",
  };
}

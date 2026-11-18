import { prisma } from "@/lib/prisma";
import { getDebateForViewer, getViewer } from "@/lib/debates";
import { debateLabel } from "@/lib/site";
import { DebateView } from "@/components/debate-view";
import { WinBanner } from "@/components/win-banner";

/**
 * If the signed-in user won the most recent closed debate, return what is
 * needed to prompt them to share the win.
 */
async function getRecentWin(userId: string | null) {
  if (!userId) return null;
  const latest = await prisma.debate.findFirst({
    where: { status: "CLOSED", winningEntryId: { not: null } },
    orderBy: { closedAt: "desc" },
    select: {
      season: true,
      dayNumber: true,
      topic: true,
      winningEntry: { select: { id: true, userId: true } },
    },
  });
  if (!latest?.winningEntry || latest.winningEntry.userId !== userId) return null;
  return {
    entryId: latest.winningEntry.id,
    topic: latest.topic,
    label: debateLabel(latest.season, latest.dayNumber),
  };
}

export default async function HomePage() {
  const viewer = await getViewer();
  const [debate, win] = await Promise.all([
    getDebateForViewer(viewer),
    getRecentWin(viewer.userId),
  ]);

  return (
    <>
      {win && <WinBanner {...win} />}
      <DebateView initialDebate={debate} />
    </>
  );
}

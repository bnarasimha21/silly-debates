import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntryForViewer, getViewer } from "@/lib/debates";
import { debateLabel } from "@/lib/site";
import { ShareButtons } from "@/components/share-buttons";
import { VoteButton } from "@/components/vote-button";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getEntryForViewer({ userId: null, visitorId: null }, id);
  if (!data) return { title: "Answer not found - Silly Debates" };

  const title = `"${data.entry.content}" - Silly Debates`;
  const description =
    data.debate.status === "ACTIVE"
      ? `${data.debate.topic} Vote for this answer or add your own.`
      : `${data.debate.topic} See how this answer did.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", url: `/e/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function EntryPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getEntryForViewer(await getViewer(), id);
  if (!data) notFound();

  const { entry, debate, isWinner } = data;
  const open = debate.status === "ACTIVE";
  const author = entry.user.name || "Anonymous";
  const shareText = entry.isOwnEntry
    ? `"${debate.topic}" Vote for my answer on Silly Debates:`
    : `"${debate.topic}" This answer on Silly Debates:`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <div className="inline-block bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-4 py-1 rounded-full text-sm font-medium mb-3">
          {debateLabel(debate.season, debate.dayNumber)}
        </div>
        <h1 className="text-xl md:text-2xl font-semibold text-gray-700">{debate.topic}</h1>
      </div>

      <div
        className={`bg-white rounded-2xl shadow-sm border p-6 md:p-8 mb-6 ${
          isWinner ? "border-yellow-300 ring-2 ring-yellow-100" : "border-gray-100"
        }`}
      >
        {isWinner && (
          <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded-full mb-3">
            Winner
          </span>
        )}
        <p className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-5">
          &ldquo;{entry.content}&rdquo;
        </p>
        <div className="flex items-center gap-2 mb-6">
          {entry.user.image ? (
            <Image src={entry.user.image} alt="" width={28} height={28} className="rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-medium">
              {author[0]}
            </div>
          )}
          <span className="text-gray-600">
            {author}
            {entry.isOwnEntry && <span className="ml-2 text-purple-600 font-medium">(You)</span>}
          </span>
        </div>

        {open && !entry.isOwnEntry ? (
          <VoteButton
            entryId={entry.id}
            initialVoteCount={entry.voteCount}
            initialHasVoted={entry.hasVoted}
          />
        ) : (
          <p className="text-center text-lg font-semibold text-purple-600">
            {entry.voteCount} {entry.voteCount === 1 ? "vote" : "votes"}
            {!open && <span className="text-gray-500 font-normal"> · voting closed</span>}
          </p>
        )}
      </div>

      {!open && isWinner && debate.winnerCommentary && (
        <p className="text-gray-700 italic bg-purple-50 border border-purple-100 rounded-2xl p-5 mb-6">
          &ldquo;{debate.winnerCommentary}&rdquo;
        </p>
      )}

      <div className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-2">
          {entry.isOwnEntry && open ? "Share your answer to get votes" : "Share this answer"}
        </p>
        <ShareButtons
          path={`/e/${entry.id}`}
          text={shareText}
          entryId={entry.id}
          debateId={debate.id}
        />
        <a
          href={`/e/${entry.id}/story.png`}
          download={`silly-debates-${entry.id}.png`}
          className="inline-block mt-3 text-sm text-purple-600 hover:text-purple-800"
        >
          Download image for stories
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href={open ? "/" : `/d/${debate.id}`}
          className="text-center px-4 py-3 rounded-xl font-medium border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
        >
          See all {debate.entryCount} answers
        </Link>
        <Link
          href="/"
          className="text-center px-4 py-3 rounded-xl font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          {open ? "Add your own answer" : "Play today's debate"}
        </Link>
      </div>
    </div>
  );
}

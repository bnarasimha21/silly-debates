import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { getVisitorId, hashIp } from "./visitor";

/**
 * Who is casting a vote. Signed-in people vote as their user; everyone else
 * votes as their anonymous visitor cookie.
 */
export type Voter =
  | { kind: "user"; userId: string; visitorId: string | null }
  | { kind: "visitor"; userId: null; visitorId: string };

/** Anonymous votes allowed per debate from one network address. */
export const ANON_VOTERS_PER_IP = Number(process.env.ANON_VOTERS_PER_IP) || 10;

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|curl|wget|python|scrapy|httpclient/i;

export async function resolveVoter(): Promise<Voter | null> {
  const [session, visitorId] = await Promise.all([auth(), getVisitorId()]);
  if (session?.user?.id) return { kind: "user", userId: session.user.id, visitorId };
  if (visitorId) return { kind: "visitor", userId: null, visitorId };
  return null;
}

/** Prisma filter for votes that belong to this voter. */
export function votesOf(voter: Voter) {
  return voter.kind === "user" ? { userId: voter.userId } : { visitorId: voter.visitorId };
}

/** True for scripts and crawlers, which may not vote anonymously. */
export function looksAutomated(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") || "";
  return !userAgent || BOT_UA.test(userAgent);
}

/**
 * Hash of the caller's IP, or null when the platform gives us no address.
 * DigitalOcean App Platform sets do-connecting-ip; the others are fallbacks.
 */
export function requestIpHash(request: NextRequest): string | null {
  const ip =
    request.headers.get("do-connecting-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  return ip ? hashIp(ip) : null;
}

/**
 * True when this network address has already produced the allowed number of
 * anonymous voters in the debate (not counting this visitor).
 */
export async function ipLimitReached(
  debateId: string,
  ipHash: string | null,
  visitorId: string
): Promise<boolean> {
  if (!ipHash) return false;
  const others = await prisma.vote.findMany({
    where: {
      ipHash,
      userId: null,
      visitorId: { not: visitorId },
      entry: { debateId },
    },
    distinct: ["visitorId"],
    select: { visitorId: true },
  });
  return others.length >= ANON_VOTERS_PER_IP;
}

/**
 * When someone signs in, hand the votes they cast anonymously in this browser
 * to their account. A vote is dropped instead if it is for their own entry or
 * if the account has already voted in that debate.
 */
export async function mergeVisitorVotes(visitorId: string, userId: string): Promise<void> {
  const anonymous = await prisma.vote.findMany({
    where: { visitorId, userId: null },
    include: { entry: { select: { id: true, userId: true, debateId: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const vote of anonymous) {
    const accountVote = await prisma.vote.findFirst({
      where: { userId, entry: { debateId: vote.entry.debateId } },
      select: { id: true },
    });

    if (vote.entry.userId === userId || accountVote) {
      await prisma.$transaction([
        prisma.vote.delete({ where: { id: vote.id } }),
        prisma.entry.update({
          where: { id: vote.entryId },
          data: { voteCount: { decrement: 1 } },
        }),
      ]);
    } else {
      await prisma.vote.update({
        where: { id: vote.id },
        data: { userId, visitorId: null, ipHash: null },
      });
    }
  }
}

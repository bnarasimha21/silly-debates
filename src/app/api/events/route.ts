import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CLIENT_EVENT_NAMES, track, type EventName } from "@/lib/track";
import { cleanRef, ensureVisitorId, refCodeFor } from "@/lib/visitor";

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|curl|wget|python|scrapy/i;

function short(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

/**
 * POST /api/events
 * Record a browser-reported analytics event and make sure the visitor cookie
 * exists. Body: { name, path?, referrer?, ref?, src?, debateId?, entryId?, channel? }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name as EventName;
  if (!CLIENT_EVENT_NAMES.includes(name)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  // Crawlers and link-preview fetchers are not people; don't count them.
  const userAgent = request.headers.get("user-agent") || "";
  if (!userAgent || BOT_UA.test(userAgent)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const visitorId = await ensureVisitorId();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const debateId = short(body.debateId, 40);
  const entryId = short(body.entryId, 40);

  // A visitor cannot be their own referral.
  const rawRef = cleanRef(body.ref);
  const ref = rawRef && rawRef !== refCodeFor(visitorId) ? rawRef : null;

  const props: Record<string, string> = {};
  for (const key of ["path", "referrer", "src", "channel"] as const) {
    const value = short(body[key], 200);
    if (value) props[key] = value;
  }

  await track(name, { visitorId, userId, debateId, entryId, ref, props });

  // Arriving through someone's shared link is its own event.
  if (name === "visit" && ref) {
    await track("share_landing", { visitorId, userId, debateId, entryId, ref, props });
  }

  return NextResponse.json({ ok: true });
}

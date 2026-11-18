import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Every event name the app records. */
export const EVENT_NAMES = [
  "visit",
  "vote",
  "vote_removed",
  "entry_submit",
  "entry_rejected",
  "share_click",
  "share_landing",
  "signin_start",
  "signin_done",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Events a browser is allowed to report through POST /api/events. */
export const CLIENT_EVENT_NAMES: readonly EventName[] = [
  "visit",
  "share_click",
  "signin_start",
];

export interface TrackContext {
  visitorId?: string | null;
  userId?: string | null;
  debateId?: string | null;
  entryId?: string | null;
  ref?: string | null;
  props?: Record<string, string | number | boolean | null>;
}

/**
 * Record an analytics event. Never throws: analytics must not break a request.
 */
export async function track(name: EventName, ctx: TrackContext = {}): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        name,
        visitorId: ctx.visitorId ?? null,
        userId: ctx.userId ?? null,
        debateId: ctx.debateId ?? null,
        entryId: ctx.entryId ?? null,
        ref: ctx.ref ?? null,
        props: ctx.props ? (ctx.props as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch (error) {
    console.error(`Failed to track "${name}":`, error);
  }
}

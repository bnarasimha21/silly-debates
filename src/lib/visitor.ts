import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Anonymous visitor identity.
 *
 * Every browser gets a signed, httpOnly cookie holding a random id. It is used
 * to attribute analytics events and (later) anonymous votes. A second,
 * readable cookie holds a short prefix of the id that is appended to shared
 * links as `?ref=` so invites can be attributed.
 */

export const VISITOR_COOKIE = "sd_vid";
export const REF_COOKIE = "sd_ref";
const ONE_YEAR = 60 * 60 * 24 * 365;
const REF_LENGTH = 12;

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set");
    }
    return "dev-only-visitor-secret";
  }
  return value;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

function parse(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  return id;
}

/** Short public code derived from a visitor id, used in share links. */
export function refCodeFor(visitorId: string): string {
  return visitorId.replace(/-/g, "").slice(0, REF_LENGTH);
}

/** Read the visitor id, or null if the browser has no valid cookie yet. */
export async function getVisitorId(): Promise<string | null> {
  const store = await cookies();
  return parse(store.get(VISITOR_COOKIE)?.value);
}

/**
 * Read the visitor id, creating the cookies if needed.
 * Only callable where cookies can be set (route handlers, server actions).
 */
export async function ensureVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = parse(store.get(VISITOR_COOKIE)?.value);
  const id = existing ?? randomUUID();
  const base = {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  if (!existing) {
    store.set(VISITOR_COOKIE, `${id}.${sign(id)}`, { ...base, httpOnly: true });
  }
  if (store.get(REF_COOKIE)?.value !== refCodeFor(id)) {
    store.set(REF_COOKIE, refCodeFor(id), { ...base, httpOnly: false });
  }
  return id;
}

/** Validate a `?ref=` value from a URL. */
export function cleanRef(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{12}$/.test(value) ? value : null;
}

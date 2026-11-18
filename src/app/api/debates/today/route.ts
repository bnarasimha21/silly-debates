import { NextResponse } from "next/server";
import { getDebateForViewer, getViewer } from "@/lib/debates";

/**
 * GET /api/debates/today
 * Returns today's active debate with all entries and whether the caller
 * (signed-in or anonymous) has voted on each.
 */
export async function GET() {
  try {
    const debate = await getDebateForViewer(await getViewer());
    if (!debate) {
      return NextResponse.json({ error: "No active debate found" }, { status: 404 });
    }
    return NextResponse.json(debate);
  } catch (error) {
    console.error("Error fetching today's debate:", error);
    return NextResponse.json({ error: "Failed to fetch debate" }, { status: 500 });
  }
}

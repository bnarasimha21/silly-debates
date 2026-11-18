import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDebateTopic } from "@/lib/ai";
import { getPreviousTopics, getNextDebateSlot } from "@/lib/knowledge-base";

// Secret key for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/new-debate
 * Generate and create a new daily debate topic
 *
 * This endpoint should be called by a cron job at the start of each day.
 * It uses AI to generate a unique, fun debate topic.
 *
 * Security: Requires CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate cron request
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    // Fail closed: if CRON_SECRET is not configured, nobody may trigger the cron.
    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if there's already an active debate
    const activeDebate = await prisma.debate.findFirst({
      where: { status: "ACTIVE" },
    });

    if (activeDebate) {
      return NextResponse.json(
        {
          error: "An active debate already exists",
          debate: {
            id: activeDebate.id,
            topic: activeDebate.topic,
            dayNumber: activeDebate.dayNumber,
          },
        },
        { status: 409 }
      );
    }

    // Get previous topics to avoid duplicates
    const previousTopics = await getPreviousTopics();

    // Next slot; rolls into a new season after the last day
    const { season, dayNumber: nextDayNumber } = await getNextDebateSlot();

    // Generate a new topic using AI
    const topic = await generateDebateTopic(previousTopics);

    // Create the new debate
    const debate = await prisma.debate.create({
      data: {
        topic,
        season,
        dayNumber: nextDayNumber,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      debate: {
        id: debate.id,
        topic: debate.topic,
        season: debate.season,
        dayNumber: debate.dayNumber,
        createdAt: debate.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating new debate:", error);
    return NextResponse.json(
      { error: "Failed to create new debate" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/new-debate
 * Check status - useful for debugging
 */
export async function GET() {
  try {
    const activeDebate = await prisma.debate.findFirst({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        topic: true,
        dayNumber: true,
        createdAt: true,
        _count: {
          select: { entries: true },
        },
      },
    });

    const totalDebates = await prisma.debate.count();
    const nextSlot = await getNextDebateSlot();

    return NextResponse.json({
      hasActiveDebate: !!activeDebate,
      activeDebate: activeDebate
        ? {
            id: activeDebate.id,
            topic: activeDebate.topic,
            dayNumber: activeDebate.dayNumber,
            createdAt: activeDebate.createdAt,
            entriesCount: activeDebate._count.entries,
          }
        : null,
      totalDebates,
      nextSeason: nextSlot.season,
      nextDayNumber: nextSlot.dayNumber,
    });
  } catch (error) {
    console.error("Error checking debate status:", error);
    return NextResponse.json(
      { error: "Failed to check debate status" },
      { status: 500 }
    );
  }
}

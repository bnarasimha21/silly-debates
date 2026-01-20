import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moderateContent } from "@/lib/ai";

/**
 * POST /api/entries
 * Submit an entry for the current active debate
 * Requires authentication
 * Users can submit multiple entries per debate
 * Content is moderated by AI before being approved
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to submit an entry" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await request.json();
    const { content, debateId } = body;

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Entry content is required" },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { error: "Entry content cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 280) {
      return NextResponse.json(
        { error: "Entry content must be 280 characters or less" },
        { status: 400 }
      );
    }

    // Get the active debate (or use provided debateId)
    let debate;
    if (debateId) {
      debate = await prisma.debate.findFirst({
        where: {
          id: debateId,
          status: "ACTIVE",
        },
      });
    } else {
      debate = await prisma.debate.findFirst({
        where: {
          status: "ACTIVE",
        },
      });
    }

    if (!debate) {
      return NextResponse.json(
        { error: "No active debate found" },
        { status: 404 }
      );
    }

    // Moderate the content using AI
    const moderationResult = await moderateContent(trimmedContent, debate.topic);

    if (!moderationResult.approved) {
      return NextResponse.json(
        {
          error: "Entry was not approved by moderation",
          reason: moderationResult.reason,
        },
        { status: 400 }
      );
    }

    // Create the entry (approved by moderation)
    const entry = await prisma.entry.create({
      data: {
        content: trimmedContent,
        debateId: debate.id,
        userId: userId,
        approved: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: entry.id,
        content: entry.content,
        voteCount: entry.voteCount,
        createdAt: entry.createdAt,
        user: entry.user,
        hasVoted: false,
        isOwnEntry: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}

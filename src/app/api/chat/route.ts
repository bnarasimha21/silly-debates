import { NextRequest, NextResponse } from "next/server";
import { chatWithKBContext } from "@/lib/ai";
import { getKBContext, isKBConfigured } from "@/lib/gradient-kb";
import { getDebateHistory } from "@/lib/knowledge-base";
import { chatWithContext } from "@/lib/ai";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
}

/**
 * POST /api/chat
 * Send a message to the AI chatbot with RAG context from Gradient KB
 * Falls back to database context if KB is not configured
 * No authentication required - anyone can ask about debate history
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory = [] } = body;

    // Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 500) {
      return NextResponse.json(
        { error: "Message must be 500 characters or less" },
        { status: 400 }
      );
    }

    // Convert conversation history to the format expected by AI
    const formattedHistory = conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    let response: string;

    // Use Gradient KB if configured, otherwise fall back to database
    if (isKBConfigured()) {
      console.log("Using Gradient Knowledge Base for context");
      const kbContext = await getKBContext(trimmedMessage);
      response = await chatWithKBContext(
        trimmedMessage,
        kbContext,
        formattedHistory
      );
    } else {
      console.log("Falling back to database context (KB not configured)");
      const debateContext = await getDebateHistory();
      response = await chatWithContext(
        trimmedMessage,
        debateContext,
        formattedHistory
      );
    }

    return NextResponse.json({
      message: response,
    });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat error details:", errorMessage);
    return NextResponse.json(
      { error: `Failed to process chat message: ${errorMessage}` },
      { status: 500 }
    );
  }
}

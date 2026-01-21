/**
 * DigitalOcean Serverless Inference AI Utilities
 *
 * This module provides AI-powered features for Silly Debates:
 * - Topic Generator: Generates daily debate topics
 * - Content Moderator: Filters user-submitted entries
 * - Winner Commentary: Generates fun announcements for winners
 * - Chat/RAG: Answers questions about past debates
 */

// DigitalOcean Serverless Inference endpoint
const GRADIENT_INFERENCE_URL = process.env.GRADIENT_INFERENCE_URL || "https://inference.do-ai.run/v1/chat/completions";
const GRADIENT_API_KEY = process.env.GRADIENT_API_KEY || "";

// Default model for serverless inference
const DEFAULT_MODEL = process.env.GRADIENT_INFERENCE_MODEL || "llama3.3-70b-instruct";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface InferenceResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Call DigitalOcean Serverless Inference API
 */
async function callInference(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 500 } = options;

  if (!GRADIENT_API_KEY) {
    console.warn("GRADIENT_API_KEY not configured, using mock response");
    return mockInferenceResponse(messages);
  }

  try {
    const response = await fetch(GRADIENT_INFERENCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GRADIENT_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Inference API error:", response.status, errorText);
      throw new Error(`Inference API error: ${response.status}`);
    }

    const data: InferenceResponse = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error calling inference API:", error);
    throw error;
  }
}

/**
 * Mock response for development when API key is not configured
 */
function mockInferenceResponse(messages: ChatMessage[]): string {
  const lastUserMessage = messages.findLast((m) => m.role === "user")?.content || "";
  const systemMessage = messages.find((m) => m.role === "system")?.content || "";

  // Detect which AI function is being called based on system prompt
  if (systemMessage.includes("debate topic generator")) {
    const topics = [
      "What's the best excuse for eating the last slice of pizza?",
      "Is cereal a soup? Defend your position.",
      "What's the worst superpower to have in everyday life?",
      "If animals could talk, which would be the rudest?",
      "What's the most overrated kitchen appliance?",
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  }

  if (systemMessage.includes("content moderator")) {
    return JSON.stringify({ approved: true, reason: "Content meets community guidelines" });
  }

  if (systemMessage.includes("winner commentary")) {
    return "What a fantastic entry! This clever response captured the spirit of the debate perfectly and won the hearts (and votes) of our community!";
  }

  // Default: chatbot response
  return `I'd be happy to help you explore our debate history! Based on your question about "${lastUserMessage.substring(0, 50)}...", here's what I found in our records. (Note: This is a mock response - configure GRADIENT_API_KEY for real AI responses)`;
}

// ============================================
// Topic Generator
// ============================================

const TOPIC_GENERATOR_SYSTEM_PROMPT = `You are a creative debate topic generator for a fun, lighthearted game called "Silly Debates".

Your task is to generate ONE unique, silly debate topic that:
- Is family-friendly and inclusive
- Is EASY to answer - people should be able to think of a response in seconds
- Asks for a simple, concrete answer (a food, animal, movie, song, etc.)
- Has no objectively "correct" answer
- Makes people smile when they read it

IMPORTANT: Keep questions SIMPLE. Avoid complex hypotheticals or questions that require too much creative thinking. The best questions ask for ONE thing that everyone has an opinion on.

Examples of GOOD topics (simple, easy to answer):
- "What's the best pizza topping?"
- "What's the worst movie ever made?"
- "What food would you never eat again?"
- "What's the most annoying song?"
- "What animal would make the worst pet?"
- "What's the best ice cream flavor?"
- "What's the worst household chore?"
- "What TV show is overrated?"
- "What's the best snack at midnight?"
- "What's the worst thing to step on barefoot?"
- "What food smells great but tastes bad?"
- "What's the best day of the week?"
- "What's the most useless kitchen gadget?"
- "What's the worst drink to wake up to?"
- "What candy is secretly terrible?"
- "What's the best excuse for being late?"
- "What movie villain was actually right?"
- "What's the worst fast food restaurant?"
- "What subject in school was the most useless?"
- "What's the most overrated holiday?"

Examples of BAD topics (too complex, avoid these):
- "What's the most creative way to..." (too open-ended)
- "If you had to explain X to Y, how would you..." (too complex)
- "What's the most philosophical..." (too abstract)

Output format: Return ONLY the topic as a question. No additional text, explanations, or formatting.`;

export async function generateDebateTopic(previousTopics: string[] = []): Promise<string> {
  const userPrompt = previousTopics.length > 0
    ? `Generate a new debate topic. Avoid these previously used topics:\n${previousTopics.map(t => `- ${t}`).join('\n')}`
    : "Generate a new debate topic.";

  const response = await callInference(
    [
      { role: "system", content: TOPIC_GENERATOR_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.9, maxTokens: 100 }
  );

  // Clean up the response (remove quotes if present)
  return response.trim().replace(/^["']|["']$/g, "");
}

// ============================================
// Content Moderator
// ============================================

const CONTENT_MODERATOR_SYSTEM_PROMPT = `You are a content moderator for a fun, family-friendly debate game called "Silly Debates".

Your task is to evaluate user-submitted entries and determine if they are appropriate.

An entry should be REJECTED if it contains:
- Profanity or vulgar language
- Hate speech or discriminatory content
- Personal attacks or bullying
- Spam or repetitive content
- Content completely unrelated to the debate topic
- Explicit sexual content
- Violence or threats

An entry should be APPROVED if it is:
- Family-friendly
- Related to the debate topic (even if creative/tangential)
- Humorous without being offensive
- Original and not spam

You MUST respond with valid JSON in this exact format:
{"approved": true/false, "reason": "Brief explanation"}

Be lenient with creative or funny entries that push boundaries in a good-natured way.`;

export interface ModerationResult {
  approved: boolean;
  reason: string;
}

export async function moderateContent(
  entry: string,
  debateTopic: string
): Promise<ModerationResult> {
  const userPrompt = `Debate topic: "${debateTopic}"

User's entry: "${entry}"

Evaluate this entry and respond with JSON indicating if it should be approved.`;

  try {
    const response = await callInference(
      [
        { role: "system", content: CONTENT_MODERATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 150 }
    );

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        approved: Boolean(result.approved),
        reason: String(result.reason || ""),
      };
    }

    // Default to approved if parsing fails
    console.warn("Could not parse moderation response, defaulting to approved");
    return { approved: true, reason: "Unable to parse moderation response" };
  } catch (error) {
    console.error("Moderation error:", error);
    // Default to approved on error to not block users
    return { approved: true, reason: "Moderation check failed, entry allowed" };
  }
}

// ============================================
// Winner Commentary
// ============================================

const WINNER_COMMENTARY_SYSTEM_PROMPT = `You are a witty announcer for a fun debate game called "Silly Debates".

Your task is to write a short, fun commentary announcing the winner of today's debate.

Guidelines:
- Be enthusiastic and celebratory
- Reference the winning entry in a clever way
- Keep it to 2-3 sentences
- Be family-friendly and positive
- Use humor but avoid sarcasm that could seem mean
- Make the winner feel special

Output format: Just the commentary text, no quotes or formatting.`;

export async function generateWinnerCommentary(
  topic: string,
  winningEntry: string,
  winnerName: string,
  voteCount: number
): Promise<string> {
  const userPrompt = `Debate topic: "${topic}"
Winning entry: "${winningEntry}"
Winner's name: ${winnerName}
Vote count: ${voteCount}

Write a fun 2-3 sentence commentary announcing this winner.`;

  const response = await callInference(
    [
      { role: "system", content: WINNER_COMMENTARY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.8, maxTokens: 200 }
  );

  return response.trim();
}

// ============================================
// Chatbot with RAG
// ============================================

const CHATBOT_SYSTEM_PROMPT = `You are a helpful and fun AI assistant for "Silly Debates", a daily debate game where users submit funny answers to silly questions.

You have access to the debate history provided in the context. Use this information to answer user questions about:
- Past debate topics and winners
- Statistics (most wins, most votes, etc.)
- Fun facts about the debates
- Specific debates or entries

Guidelines:
- Be friendly and conversational
- Use the provided context to give accurate answers
- If you don't have information to answer a question, say so politely
- Add a touch of humor when appropriate
- Keep responses concise but helpful

If the user asks about something not in the provided context, let them know you can only answer questions about the debate history you have access to.`;

export interface DebateContext {
  debates: {
    id: string;
    dayNumber: number;
    topic: string;
    status: string;
    totalEntries: number;
    totalVotes: number;
    winner?: {
      userName: string;
      entry: string;
      votes: number;
    };
    commentary?: string;
  }[];
  stats: {
    totalDebates: number;
    totalEntries: number;
    totalVotes: number;
    topWinners: { name: string; wins: number }[];
  };
}

export async function chatWithContext(
  userMessage: string,
  context: DebateContext,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  // Build context string for RAG
  const contextStr = buildContextString(context);

  const messages: ChatMessage[] = [
    { role: "system", content: CHATBOT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the debate history context:\n\n${contextStr}\n\n---\n\nNow, please answer the user's question.`,
    },
    { role: "assistant", content: "I have reviewed the debate history. I'm ready to answer questions about past debates, winners, and statistics!" },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const response = await callInference(messages, { temperature: 0.7, maxTokens: 500 });
  return response.trim();
}

function buildContextString(context: DebateContext): string {
  const parts: string[] = [];

  // Overall stats
  parts.push("## Overall Statistics");
  parts.push(`- Total debates completed: ${context.stats.totalDebates}`);
  parts.push(`- Total entries submitted: ${context.stats.totalEntries}`);
  parts.push(`- Total votes cast: ${context.stats.totalVotes}`);

  if (context.stats.topWinners.length > 0) {
    parts.push("\n## Top Winners (Most Debate Wins)");
    context.stats.topWinners.forEach((w, i) => {
      parts.push(`${i + 1}. ${w.name}: ${w.wins} wins`);
    });
  }

  // Individual debates
  if (context.debates.length > 0) {
    parts.push("\n## Debate History");
    context.debates.forEach((d) => {
      parts.push(`\n### Day ${d.dayNumber}: "${d.topic}"`);
      parts.push(`- Status: ${d.status}`);
      parts.push(`- Entries: ${d.totalEntries}, Votes: ${d.totalVotes}`);
      if (d.winner) {
        parts.push(`- Winner: ${d.winner.userName} with "${d.winner.entry}" (${d.winner.votes} votes)`);
      }
      if (d.commentary) {
        parts.push(`- AI Commentary: "${d.commentary}"`);
      }
    });
  }

  return parts.join("\n");
}

/**
 * Chat with Knowledge Base context (string-based context from Gradient KB)
 */
export async function chatWithKBContext(
  userMessage: string,
  kbContext: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: CHATBOT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the relevant debate history from our knowledge base:\n\n${kbContext}\n\n---\n\nNow, please answer the user's question.`,
    },
    { role: "assistant", content: "I have reviewed the debate history. I'm ready to answer questions about past debates, winners, and statistics!" },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const response = await callInference(messages, { temperature: 0.7, maxTokens: 500 });
  return response.trim();
}

// Export for testing
export { callInference, buildContextString };

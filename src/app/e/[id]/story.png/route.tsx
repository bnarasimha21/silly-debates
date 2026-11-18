import { entryCard } from "@/lib/cards";
import { STORY_SIZE, renderCard } from "@/lib/og";

/**
 * GET /e/[id]/story.png
 * 1080x1920 version of the entry card, for Instagram and WhatsApp stories.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const card = await entryCard(id);
  if (!card) return new Response("Not found", { status: 404 });
  return renderCard(card, STORY_SIZE);
}

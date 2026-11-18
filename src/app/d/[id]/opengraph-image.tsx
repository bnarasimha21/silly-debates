import { debateCard } from "@/lib/cards";
import { OG_SIZE, renderCard, renderFallbackCard } from "@/lib/og";

export const alt = "A Silly Debate";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await debateCard(id);
  return card ? renderCard(card) : renderFallbackCard();
}

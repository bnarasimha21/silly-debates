import { debateCard } from "@/lib/cards";
import { OG_SIZE, renderCard, renderFallbackCard } from "@/lib/og";

export const dynamic = "force-dynamic";
export const alt = "Today's Silly Debate";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const card = await debateCard();
  return card ? renderCard(card) : renderFallbackCard();
}

import { entryCard } from "@/lib/cards";
import { OG_SIZE, renderCard, renderFallbackCard } from "@/lib/og";

export const alt = "An answer on Silly Debates";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await entryCard(id);
  return card ? renderCard(card) : renderFallbackCard();
}

import { ImageResponse } from "next/og";

/**
 * Share-card images. One layout, two sizes: a 1200x630 link preview and a
 * 1080x1920 story. Text only (no emoji or remote images) so rendering never
 * depends on the network.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const STORY_SIZE = { width: 1080, height: 1920 };

export interface CardContent {
  /** Small line above the topic, e.g. "Day 12" or "Winner · Day 12". */
  label: string;
  topic: string;
  /** The answer shown large. Omit for a topic-only card. */
  answer?: string;
  author?: string;
  /** Text in the bottom pill. */
  cta: string;
  highlight?: boolean;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Pick a font size that keeps the text inside its box. */
function fit(text: string, sizes: [number, number][], fallback: number): number {
  for (const [maxLength, size] of sizes) {
    if (text.length <= maxLength) return size;
  }
  return fallback;
}

export function renderCard(
  content: CardContent,
  size: { width: number; height: number } = OG_SIZE
): ImageResponse {
  const story = size.height > size.width;
  const scale = story ? 1.45 : 1;
  const px = (value: number) => Math.round(value * scale);

  const topic = clip(content.topic, 140);
  const answer = content.answer ? clip(content.answer, 200) : null;
  const main = answer ?? topic;
  // The story has far more vertical room, so its main text is larger.
  const mainSize = Math.round(
    fit(main, [[40, 76], [80, 62], [130, 50], [170, 42]], 38) * (story ? 1.9 : 1)
  );
  const accent = content.highlight ? "#b45309" : "#7e22ce";
  const accentBg = content.highlight ? "#fef3c7" : "#f3e8ff";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: px(44),
          backgroundImage: "linear-gradient(135deg, #7e22ce 0%, #db2777 60%, #fb923c 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#ffffff",
            fontSize: px(30),
            marginBottom: px(24),
          }}
        >
          <div style={{ display: "flex" }}>Silly Debates</div>
          <div style={{ display: "flex", opacity: 0.9, fontSize: px(24) }}>{content.label}</div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#ffffff",
            borderRadius: px(32),
            padding: px(48),
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              // In the tall story layout the text block fills the card and is
              // centred. (Satori rejects `flex: undefined`, hence the spread.)
              ...(story ? { flex: 1, justifyContent: "center" } : {}),
            }}
          >
            {answer && (
              <div style={{ display: "flex", color: "#6b7280", fontSize: px(30), lineHeight: 1.3, marginBottom: px(24) }}>
                {topic}
              </div>
            )}
            <div style={{ display: "flex", color: "#111827", fontSize: mainSize, lineHeight: 1.2 }}>
              {answer ? `“${answer}”` : topic}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: story ? "column" : "row",
              alignItems: story ? "flex-start" : "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", color: "#4b5563", fontSize: px(28), marginBottom: story ? px(28) : 0 }}>
              {content.author ? `by ${clip(content.author, 28)}` : ""}
            </div>
            <div
              style={{
                display: "flex",
                backgroundColor: accentBg,
                color: accent,
                fontSize: px(30),
                padding: `${px(16)}px ${px(32)}px`,
                borderRadius: px(999),
              }}
            >
              {content.cta}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

/** Card shown when the requested debate or entry does not exist. */
export function renderFallbackCard(size = OG_SIZE): ImageResponse {
  return renderCard(
    {
      label: "A new debate every day",
      topic: "Vote on the silliest answers. Add your own.",
      cta: "Play today's debate",
    },
    size
  );
}

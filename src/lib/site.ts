/** Days in one season. After the last day a new season starts at Day 1. */
export const SEASON_LENGTH = 30;

/** Public base URL of the app, without a trailing slash. */
export function siteUrl(): string {
  const url =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

/** "Day 5" in season 1, "Season 2 · Day 5" afterwards. */
export function debateLabel(season: number, dayNumber: number): string {
  return season > 1 ? `Season ${season} · Day ${dayNumber}` : `Day ${dayNumber}`;
}

/**
 * Browser helper for casting or removing a vote.
 * A first-time visitor may not have the visitor cookie yet; in that case the
 * server answers `no_visitor`, we fetch a cookie and try once more.
 */
export interface VoteResult {
  entryId: string;
  voteCount: number;
  hasVoted: boolean;
  previousEntryId?: string;
}

async function request(entryId: string, remove: boolean): Promise<Response> {
  return remove
    ? fetch(`/api/votes/${entryId}`, { method: "DELETE" })
    : fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
}

export async function sendVote(entryId: string, remove: boolean): Promise<VoteResult> {
  let response = await request(entryId, remove);
  let data = await response.json().catch(() => ({}));

  if (response.status === 401 && data.code === "no_visitor") {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "visit", path: window.location.pathname }),
    });
    response = await request(entryId, remove);
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    throw new Error(data.error || "Vote failed. Please try again.");
  }
  return data as VoteResult;
}

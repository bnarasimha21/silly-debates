// Debate types for the application

export interface EntryUser {
  id: string;
  name: string | null;
  image: string | null;
}

export interface Entry {
  id: string;
  content: string;
  voteCount: number;
  createdAt: string;
  user: EntryUser;
  hasVoted: boolean;
  isOwnEntry: boolean;
}

export interface Debate {
  id: string;
  topic: string;
  dayNumber: number;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  entries: Entry[];
  userHasSubmitted: boolean;
  userEntryId: string | null;
}

export interface VoteResponse {
  voteId?: string;
  entryId: string;
  voteCount: number;
  hasVoted: boolean;
  previousEntryId?: string; // When vote was switched from another entry
}

export interface EntryResponse {
  id: string;
  content: string;
  voteCount: number;
  createdAt: string;
  user: EntryUser;
  hasVoted: boolean;
  isOwnEntry: boolean;
}

export interface ApiError {
  error: string;
}

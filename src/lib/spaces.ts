/**
 * DigitalOcean Spaces Integration
 *
 * Uploads debate data to Spaces for Knowledge Base indexing.
 * Spaces uses S3-compatible API.
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const SPACES_KEY = process.env.SPACES_KEY || "";
const SPACES_SECRET = process.env.SPACES_SECRET || "";
const SPACES_BUCKET = process.env.SPACES_BUCKET || "silly-debates";
const SPACES_REGION = process.env.SPACES_REGION || "nyc3";
const SPACES_ENDPOINT = `https://${SPACES_REGION}.digitaloceanspaces.com`;

// Initialize S3 client for Spaces
const s3Client = new S3Client({
  endpoint: SPACES_ENDPOINT,
  region: SPACES_REGION,
  credentials: {
    accessKeyId: SPACES_KEY,
    secretAccessKey: SPACES_SECRET,
  },
});

/**
 * Check if Spaces is configured
 */
export function isSpacesConfigured(): boolean {
  return Boolean(SPACES_KEY && SPACES_SECRET);
}

/**
 * Debate data structure for Knowledge Base
 */
export interface DebateKBData {
  id: string;
  dayNumber: number;
  date: string;
  topic: string;
  totalEntries: number;
  totalVotes: number;
  winner: {
    userName: string;
    entry: string;
    votes: number;
  } | null;
  runnerUp: {
    userName: string;
    entry: string;
    votes: number;
  } | null;
  commentary: string | null;
  topEntries: {
    userName: string;
    entry: string;
    votes: number;
  }[];
}

/**
 * Upload a single debate's data to Spaces
 */
export async function uploadDebateToSpaces(debate: DebateKBData): Promise<void> {
  if (!isSpacesConfigured()) {
    console.warn("Spaces not configured, skipping upload");
    return;
  }

  const fileName = `debates/day-${debate.dayNumber.toString().padStart(2, "0")}.json`;

  const content = JSON.stringify(debate, null, 2);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: fileName,
        Body: content,
        ContentType: "application/json",
        ACL: "private",
      })
    );
    console.log(`Uploaded debate day ${debate.dayNumber} to Spaces: ${fileName}`);
  } catch (error) {
    console.error("Failed to upload debate to Spaces:", error);
    throw error;
  }
}

/**
 * Upload a summary/index file with all debates
 */
export async function uploadDebateSummaryToSpaces(debates: DebateKBData[]): Promise<void> {
  if (!isSpacesConfigured()) {
    console.warn("Spaces not configured, skipping summary upload");
    return;
  }

  const summary = {
    lastUpdated: new Date().toISOString(),
    totalDebates: debates.length,
    totalEntries: debates.reduce((sum, d) => sum + d.totalEntries, 0),
    totalVotes: debates.reduce((sum, d) => sum + d.totalVotes, 0),
    debates: debates.map((d) => ({
      dayNumber: d.dayNumber,
      date: d.date,
      topic: d.topic,
      winner: d.winner?.userName || null,
      winningEntry: d.winner?.entry || null,
    })),
  };

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: "debates/summary.json",
        Body: JSON.stringify(summary, null, 2),
        ContentType: "application/json",
        ACL: "private",
      })
    );
    console.log("Uploaded debate summary to Spaces");
  } catch (error) {
    console.error("Failed to upload summary to Spaces:", error);
    throw error;
  }
}

/**
 * Upload a human-readable text file for better KB indexing
 * Text files often work better for RAG/search
 */
export async function uploadDebateAsTextToSpaces(debate: DebateKBData): Promise<void> {
  if (!isSpacesConfigured()) {
    console.warn("Spaces not configured, skipping text upload");
    return;
  }

  const textContent = `
Silly Debates - Day ${debate.dayNumber}
Date: ${debate.date}
Topic: "${debate.topic}"

Results:
- Total Entries: ${debate.totalEntries}
- Total Votes: ${debate.totalVotes}

Winner: ${debate.winner?.userName || "No winner"}
Winning Entry: "${debate.winner?.entry || "N/A"}"
Winning Votes: ${debate.winner?.votes || 0}

${debate.runnerUp ? `Runner Up: ${debate.runnerUp.userName}
Runner Up Entry: "${debate.runnerUp.entry}"
Runner Up Votes: ${debate.runnerUp.votes}` : ""}

${debate.commentary ? `AI Commentary: "${debate.commentary}"` : ""}

Top Entries:
${debate.topEntries.map((e, i) => `${i + 1}. ${e.userName}: "${e.entry}" (${e.votes} votes)`).join("\n")}
`.trim();

  const fileName = `debates/day-${debate.dayNumber.toString().padStart(2, "0")}.txt`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: fileName,
        Body: textContent,
        ContentType: "text/plain",
        ACL: "private",
      })
    );
    console.log(`Uploaded debate text for day ${debate.dayNumber} to Spaces`);
  } catch (error) {
    console.error("Failed to upload debate text to Spaces:", error);
    throw error;
  }
}

/**
 * List all debate files in Spaces
 */
export async function listDebateFiles(): Promise<string[]> {
  if (!isSpacesConfigured()) {
    return [];
  }

  try {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: SPACES_BUCKET,
        Prefix: "debates/",
      })
    );

    return response.Contents?.map((obj) => obj.Key || "").filter(Boolean) || [];
  } catch (error) {
    console.error("Failed to list Spaces files:", error);
    return [];
  }
}

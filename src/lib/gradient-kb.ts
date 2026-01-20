/**
 * Gradient Knowledge Base Retrieval
 *
 * Queries the DigitalOcean Gradient Knowledge Base for relevant debate context.
 */

const GRADIENT_KB_UUID = process.env.GRADIENT_KB_UUID || "";
const DO_API_TOKEN = process.env.DO_API_TOKEN || "";
const KB_ENDPOINT = `https://kbaas.do-ai.run/v1/${GRADIENT_KB_UUID}/retrieve`;

interface KBRetrieveRequest {
  query: string;
  num_results?: number;
  alpha?: number; // 0 = lexical only, 1 = semantic only, 0.5 = balanced
}

interface KBResult {
  metadata: {
    chunk_category?: string;
    ingested_timestamp?: string;
    item_name?: string;
    [key: string]: unknown;
  };
  text_content: string;
}

interface KBRetrieveResponse {
  results: KBResult[];
  total_results: number;
}

/**
 * Check if Knowledge Base is configured
 */
export function isKBConfigured(): boolean {
  return Boolean(GRADIENT_KB_UUID && DO_API_TOKEN);
}

/**
 * Retrieve relevant context from Knowledge Base
 */
export async function retrieveFromKB(
  query: string,
  options: { numResults?: number; alpha?: number } = {}
): Promise<KBResult[]> {
  const { numResults = 5, alpha = 0.5 } = options;

  if (!isKBConfigured()) {
    console.warn("Knowledge Base not configured (GRADIENT_KB_UUID or DO_API_TOKEN missing)");
    return [];
  }

  const requestBody: KBRetrieveRequest = {
    query,
    num_results: numResults,
    alpha,
  };

  try {
    const response = await fetch(KB_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DO_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("KB retrieve error:", response.status, errorText);
      throw new Error(`KB retrieve failed: ${response.status}`);
    }

    const data: KBRetrieveResponse = await response.json();
    console.log(`KB retrieved ${data.results.length} results for query: "${query.substring(0, 50)}..."`);
    return data.results;
  } catch (error) {
    console.error("Error retrieving from KB:", error);
    throw error;
  }
}

/**
 * Format KB results into context string for LLM
 */
export function formatKBResultsAsContext(results: KBResult[]): string {
  if (results.length === 0) {
    return "No relevant debate history found in the knowledge base.";
  }

  const contextParts = results.map((result, index) => {
    const source = result.metadata.item_name || `Source ${index + 1}`;
    return `--- ${source} ---\n${result.text_content}`;
  });

  return contextParts.join("\n\n");
}

/**
 * Retrieve and format context in one call
 */
export async function getKBContext(query: string): Promise<string> {
  try {
    const results = await retrieveFromKB(query);
    return formatKBResultsAsContext(results);
  } catch (error) {
    console.error("Failed to get KB context:", error);
    return "Unable to retrieve debate history at this time.";
  }
}

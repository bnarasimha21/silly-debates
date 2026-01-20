/**
 * DO Function: Close Debate
 * Triggered daily at 11:59 PM UTC to close the current debate
 */

async function main(args) {
  const appUrl = process.env.APP_URL || args.APP_URL;
  const cronSecret = process.env.CRON_SECRET || args.CRON_SECRET;

  if (!appUrl || !cronSecret) {
    return {
      statusCode: 500,
      body: { error: "Missing APP_URL or CRON_SECRET" },
    };
  }

  const endpoint = `${appUrl}/api/cron/close-debate`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Close debate failed:", data);
      return {
        statusCode: response.status,
        body: { error: "Failed to close debate", details: data },
      };
    }

    console.log("Debate closed successfully:", data);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: "Debate closed successfully",
        data,
      },
    };
  } catch (error) {
    console.error("Error closing debate:", error.message);
    return {
      statusCode: 500,
      body: { error: "Error closing debate", message: error.message },
    };
  }
}

exports.main = main;

/**
 * DO Function: New Debate
 * Triggered daily at 12:01 AM UTC to create a new debate
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

  const endpoint = `${appUrl}/api/cron/new-debate`;

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
      console.error("New debate creation failed:", data);
      return {
        statusCode: response.status,
        body: { error: "Failed to create new debate", details: data },
      };
    }

    console.log("New debate created successfully:", data);
    return {
      statusCode: 200,
      body: {
        success: true,
        message: "New debate created successfully",
        data,
      },
    };
  } catch (error) {
    console.error("Error creating new debate:", error.message);
    return {
      statusCode: 500,
      body: { error: "Error creating new debate", message: error.message },
    };
  }
}

exports.main = main;

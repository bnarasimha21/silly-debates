import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const SPACES_KEY = process.env.SPACES_KEY || "";
const SPACES_SECRET = process.env.SPACES_SECRET || "";
const SPACES_BUCKET = process.env.SPACES_BUCKET || "silly-debates";
const SPACES_REGION = process.env.SPACES_REGION || "nyc3";
const SPACES_ENDPOINT = `https://${SPACES_REGION}.digitaloceanspaces.com`;

/**
 * GET /api/test-spaces
 * Test Spaces connectivity by uploading, reading, and deleting a test file
 */
export async function GET() {
  const results: string[] = [];

  // Check config
  if (!SPACES_KEY || !SPACES_SECRET) {
    return NextResponse.json({
      success: false,
      error: "SPACES_KEY and SPACES_SECRET not configured in .env",
    }, { status: 400 });
  }

  results.push(`Config: bucket=${SPACES_BUCKET}, region=${SPACES_REGION}`);

  const s3Client = new S3Client({
    endpoint: SPACES_ENDPOINT,
    region: SPACES_REGION,
    credentials: {
      accessKeyId: SPACES_KEY,
      secretAccessKey: SPACES_SECRET,
    },
  });

  const testFileName = `test/connection-test-${Date.now()}.txt`;
  const testContent = `Spaces connection test at ${new Date().toISOString()}`;

  try {
    // 1. Upload test file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: testFileName,
        Body: testContent,
        ContentType: "text/plain",
      })
    );
    results.push(`Upload: SUCCESS - ${testFileName}`);

    // 2. Read test file back
    const getResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: testFileName,
      })
    );
    const readContent = await getResponse.Body?.transformToString();
    results.push(`Read: SUCCESS - content matches: ${readContent === testContent}`);

    // 3. Delete test file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: testFileName,
      })
    );
    results.push(`Delete: SUCCESS - cleaned up test file`);

    return NextResponse.json({
      success: true,
      message: "Spaces connectivity verified!",
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    results.push(`ERROR: ${errorMessage}`);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      results,
    }, { status: 500 });
  }
}

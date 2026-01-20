import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Check if there's already an active debate
  const existingDebate = await prisma.debate.findFirst({
    where: { status: "ACTIVE" },
  });

  if (existingDebate) {
    console.log("An active debate already exists:");
    console.log(`  Topic: "${existingDebate.topic}"`);
    console.log(`  Day: ${existingDebate.dayNumber}`);
    console.log("Skipping seed to avoid duplicates.");
    return;
  }

  // Create a sample debate for Day 1
  const debate = await prisma.debate.create({
    data: {
      topic: "What's the best excuse for being late to work?",
      dayNumber: 1,
      status: "ACTIVE",
    },
  });

  console.log("Created active debate:");
  console.log(`  ID: ${debate.id}`);
  console.log(`  Topic: "${debate.topic}"`);
  console.log(`  Day: ${debate.dayNumber}`);

  // List of sample silly debates for future reference
  const futureTopics = [
    "If animals could talk, which would be the rudest?",
    "What's the worst pizza topping combination?",
    "If you could only eat one food for the rest of your life, what would it be?",
    "What's the most useless superpower you can think of?",
    "If you were a villain, what would be your evil catchphrase?",
    "What's the worst song to play at a wedding?",
    "If your pet could text you, what would their first message be?",
    "What's the most ridiculous conspiracy theory you can make up?",
    "If you had to wear one Halloween costume forever, what would it be?",
    "What's the worst name for a restaurant?",
  ];

  console.log("\nFuture topic ideas for reference:");
  futureTopics.forEach((topic, index) => {
    console.log(`  Day ${index + 2}: "${topic}"`);
  });

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

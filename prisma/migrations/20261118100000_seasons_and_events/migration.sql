-- DropIndex
DROP INDEX "Debate_dayNumber_idx";

-- DropIndex
DROP INDEX "Debate_dayNumber_key";

-- AlterTable
ALTER TABLE "Debate" ADD COLUMN     "season" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitorId" TEXT,
    "userId" TEXT,
    "debateId" TEXT,
    "entryId" TEXT,
    "ref" TEXT,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_name_createdAt_idx" ON "Event"("name", "createdAt");

-- CreateIndex
CREATE INDEX "Event_visitorId_createdAt_idx" ON "Event"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Debate_createdAt_idx" ON "Debate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Debate_season_dayNumber_key" ON "Debate"("season", "dayNumber");


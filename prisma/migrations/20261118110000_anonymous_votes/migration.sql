-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "visitorId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Vote_visitorId_idx" ON "Vote"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_entryId_visitorId_key" ON "Vote"("entryId", "visitorId");


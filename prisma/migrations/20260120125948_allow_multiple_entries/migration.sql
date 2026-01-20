-- DropIndex
DROP INDEX "Entry_debateId_userId_key";

-- CreateIndex
CREATE INDEX "Entry_userId_idx" ON "Entry"("userId");

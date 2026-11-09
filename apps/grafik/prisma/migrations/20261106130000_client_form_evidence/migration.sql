-- AlterTable
ALTER TABLE "ClientForm" ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT '2026-11-06',
ADD COLUMN "ip" TEXT,
ADD COLUMN "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "ClientForm_createdAt_idx" ON "ClientForm"("createdAt");

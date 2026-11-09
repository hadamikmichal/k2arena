-- CreateTable
CREATE TABLE "ClientForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "minor1" TEXT,
    "minor2" TEXT,
    "knowsAutobelay" BOOLEAN NOT NULL,
    "canHarness" BOOLEAN NOT NULL,
    "canBelay" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientForm_status_createdAt_idx" ON "ClientForm"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientForm" ADD CONSTRAINT "ClientForm_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

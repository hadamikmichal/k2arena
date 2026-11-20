-- AlterTable
ALTER TABLE "ClientForm" ADD COLUMN     "zones" TEXT NOT NULL DEFAULT 'SCIANA',
ADD COLUMN     "wall" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "signature" TEXT,
ADD COLUMN     "emailedAt" TIMESTAMP(3);

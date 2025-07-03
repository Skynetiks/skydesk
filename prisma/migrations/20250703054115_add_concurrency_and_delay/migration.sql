-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "concurrency" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "delaySeconds" INTEGER NOT NULL DEFAULT 10;

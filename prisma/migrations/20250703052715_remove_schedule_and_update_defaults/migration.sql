/*
  Warnings:

  - You are about to drop the column `nextExecution` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the `campaign_schedules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "campaign_schedules" DROP CONSTRAINT "campaign_schedules_campaignId_fkey";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "nextExecution",
ALTER COLUMN "emailsPerExecution" SET DEFAULT 10;

-- DropTable
DROP TABLE "campaign_schedules";

-- DropEnum
DROP TYPE "ScheduleFrequency";

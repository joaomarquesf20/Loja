-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedLoginWindowStartedAt" TIMESTAMP(3),
ADD COLUMN     "loginBlockedUntil" TIMESTAMP(3);

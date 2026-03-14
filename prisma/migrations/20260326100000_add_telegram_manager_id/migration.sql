-- AlterTable: добавить telegramManagerId в Bot для назначения менеджера уведомлений
ALTER TABLE "Bot" ADD COLUMN "telegramManagerId" TEXT;

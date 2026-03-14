-- CreateEnum
CREATE TYPE "BalanceOperationType" AS ENUM ('BONUS', 'PENALTY', 'MANUAL');

-- AlterTable: добавить поле balance в Employee
ALTER TABLE "Employee" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: добавить поле consentGivenAt в Contact
ALTER TABLE "Contact" ADD COLUMN "consentGivenAt" TIMESTAMP(3);

-- CreateTable: история операций с балансом
CREATE TABLE "BalanceHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "BalanceOperationType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: клиенты (CRM)
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: BalanceHistory -> Employee
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: BroadcastMessage — хранит message_id разосланных вакансий для последующего редактирования
CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastMessage_orderId_idx" ON "BroadcastMessage"("orderId");

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

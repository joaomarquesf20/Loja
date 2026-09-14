-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('PAYMENT_CONFIRMED', 'STATUS_CHANGED', 'PAYMENT_REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "fromOrderStatus" "OrderStatus",
    "toOrderStatus" "OrderStatus",
    "fromPaymentStatus" "PaymentStatus",
    "toPaymentStatus" "PaymentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

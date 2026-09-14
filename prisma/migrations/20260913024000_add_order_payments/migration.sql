ALTER TYPE "PaymentStatus"
RENAME VALUE 'UNPAID' TO 'PENDING';

ALTER TYPE "PaymentStatus"
ADD VALUE 'AUTHORIZED';

ALTER TYPE "PaymentStatus"
ADD VALUE 'REFUNDED';

CREATE TYPE "PaymentMethod" AS ENUM (
  'CARD',
  'INSTALLMENTS'
);

ALTER TABLE "Order"
ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "installmentCount" INTEGER,
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentReference" TEXT;

CREATE INDEX "Order_paymentProvider_paymentReference_idx"
ON "Order"("paymentProvider", "paymentReference");


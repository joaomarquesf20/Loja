DROP INDEX "Order_paymentProvider_paymentReference_idx";

CREATE UNIQUE INDEX "Order_paymentProvider_paymentReference_key"
ON "Order"("paymentProvider", "paymentReference");

/*
  Warnings:

  - You are about to drop the column `complement` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `neighborhood` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `shippingComplement` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingNeighborhood` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingNumber` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingState` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingStreet` on the `Order` table. All the data in the column will be lost.
  - Added the required column `addressLine1` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postalCode` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingAddressLine1` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingEmail` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingPhone` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `shippingName` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shippingPostalCode` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Address_userId_city_state_idx";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "complement",
DROP COLUMN "neighborhood",
DROP COLUMN "number",
DROP COLUMN "state",
DROP COLUMN "street",
DROP COLUMN "zipCode",
ADD COLUMN     "addressLine1" TEXT NOT NULL,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "postalCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "shippingComplement",
DROP COLUMN "shippingNeighborhood",
DROP COLUMN "shippingNumber",
DROP COLUMN "shippingState",
DROP COLUMN "shippingStreet",
ADD COLUMN     "shippingAddressLine1" TEXT NOT NULL,
ADD COLUMN     "shippingAddressLine2" TEXT,
ADD COLUMN     "shippingEmail" TEXT NOT NULL,
ADD COLUMN     "shippingPhone" TEXT NOT NULL,
ALTER COLUMN "shippingName" SET NOT NULL,
ALTER COLUMN "shippingPostalCode" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

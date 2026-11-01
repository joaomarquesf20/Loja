-- DropForeignKey
ALTER TABLE "ProductVariantVehicleCompatibility" DROP CONSTRAINT "ProductVariantVehicleCompatibility_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantVehicleCompatibility" DROP CONSTRAINT "ProductVariantVehicleCompatibility_vehicleConfigurationId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVehicleCompatibility" DROP CONSTRAINT "ProductVehicleCompatibility_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVehicleCompatibility" DROP CONSTRAINT "ProductVehicleCompatibility_vehicleBrandId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVehicleCompatibility" DROP CONSTRAINT "ProductVehicleCompatibility_vehicleConfigurationId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVehicleCompatibility" DROP CONSTRAINT "ProductVehicleCompatibility_vehicleGenerationId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVehicleCompatibility" DROP CONSTRAINT "ProductVehicleCompatibility_vehicleModelId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleConfiguration" DROP CONSTRAINT "VehicleConfiguration_generationId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleGeneration" DROP CONSTRAINT "VehicleGeneration_modelId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleModel" DROP CONSTRAINT "VehicleModel_brandId_fkey";

-- DropIndex
DROP INDEX "VehicleModel_brandId_slug_key";

-- Reset de dados de seed: VehicleModel passa a exigir makeId NOT NULL
-- e a marca antiga é substituída por VehicleMake; as linhas antigas são
-- re-seedadas pelos scripts atualizados do Épico 8.
DELETE FROM "VehicleModel";

-- AlterTable
ALTER TABLE "VehicleModel" DROP COLUMN "brandId",
DROP COLUMN "description",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "makeId" TEXT NOT NULL;

-- DropTable
DROP TABLE "ProductVariantVehicleCompatibility";

-- DropTable
DROP TABLE "ProductVehicleCompatibility";

-- DropTable
DROP TABLE "VehicleBrand";

-- DropTable
DROP TABLE "VehicleConfiguration";

-- DropTable
DROP TABLE "VehicleGeneration";

-- CreateTable
CREATE TABLE "VehicleMake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSpec" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineCode" TEXT,
    "yearStart" INTEGER NOT NULL,
    "yearEnd" INTEGER,
    "fuelType" TEXT NOT NULL,
    "powerHp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vehicleSpecId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_name_key" ON "VehicleMake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_slug_key" ON "VehicleMake"("slug");

-- CreateIndex
CREATE INDEX "VehicleMake_slug_idx" ON "VehicleMake"("slug");

-- CreateIndex
CREATE INDEX "VehicleSpec_modelId_idx" ON "VehicleSpec"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSpec_modelId_engine_yearStart_key" ON "VehicleSpec"("modelId", "engine", "yearStart");

-- CreateIndex
CREATE INDEX "ProductCompatibility_vehicleSpecId_idx" ON "ProductCompatibility"("vehicleSpecId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCompatibility_productId_vehicleSpecId_key" ON "ProductCompatibility"("productId", "vehicleSpecId");

-- CreateIndex
CREATE INDEX "VehicleModel_makeId_idx" ON "VehicleModel"("makeId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_slug_key" ON "VehicleModel"("makeId", "slug");

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSpec" ADD CONSTRAINT "VehicleSpec_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_vehicleSpecId_fkey" FOREIGN KEY ("vehicleSpecId") REFERENCES "VehicleSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

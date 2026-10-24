-- CreateTable
CREATE TABLE "ProductVariantVehicleCompatibility" (
    "id" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "vehicleConfigurationId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantVehicleCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariantVehicleCompatibility_vehicleConfigurationId_idx" ON "ProductVariantVehicleCompatibility"("vehicleConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantVehicleCompatibility_productVariantId_vehicle_key" ON "ProductVariantVehicleCompatibility"("productVariantId", "vehicleConfigurationId");

-- AddForeignKey
ALTER TABLE "ProductVariantVehicleCompatibility" ADD CONSTRAINT "ProductVariantVehicleCompatibility_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantVehicleCompatibility" ADD CONSTRAINT "ProductVariantVehicleCompatibility_vehicleConfigurationId_fkey" FOREIGN KEY ("vehicleConfigurationId") REFERENCES "VehicleConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

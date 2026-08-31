-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "VehicleBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleGeneration" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT,
    "description" TEXT,

    CONSTRAINT "VehicleGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleConfiguration" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engineCode" TEXT,
    "engineType" TEXT,
    "displacementCc" INTEGER,
    "powerKw" DECIMAL(65,30),
    "bodyType" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,

    CONSTRAINT "VehicleConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ProductBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "productBrandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT[],

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVehicleCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vehicleBrandId" TEXT NOT NULL,
    "vehicleModelId" TEXT NOT NULL,
    "vehicleGenerationId" TEXT,
    "vehicleConfigurationId" TEXT,
    "yearMin" INTEGER,
    "yearMax" INTEGER,

    CONSTRAINT "ProductVehicleCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "shippingName" TEXT,
    "shippingStreet" TEXT NOT NULL,
    "shippingNumber" TEXT,
    "shippingComplement" TEXT,
    "shippingNeighborhood" TEXT,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameAtPurchase" TEXT NOT NULL,
    "productSkuAtPurchase" TEXT NOT NULL,
    "priceAtPurchase" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotalAtPurchase" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleBrand_name_key" ON "VehicleBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleBrand_slug_key" ON "VehicleBrand"("slug");

-- CreateIndex
CREATE INDEX "VehicleBrand_slug_idx" ON "VehicleBrand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_brandId_slug_key" ON "VehicleModel"("brandId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGeneration_modelId_name_key" ON "VehicleGeneration"("modelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_slug_idx" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBrand_name_key" ON "ProductBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBrand_slug_key" ON "ProductBrand"("slug");

-- CreateIndex
CREATE INDEX "ProductBrand_slug_idx" ON "ProductBrand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductVehicleCompatibility_productId_idx" ON "ProductVehicleCompatibility"("productId");

-- CreateIndex
CREATE INDEX "ProductVehicleCompatibility_vehicleBrandId_vehicleModelId_idx" ON "ProductVehicleCompatibility"("vehicleBrandId", "vehicleModelId");

-- CreateIndex
CREATE INDEX "ProductVehicleCompatibility_vehicleGenerationId_idx" ON "ProductVehicleCompatibility"("vehicleGenerationId");

-- CreateIndex
CREATE INDEX "ProductVehicleCompatibility_vehicleConfigurationId_idx" ON "ProductVehicleCompatibility"("vehicleConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_key" ON "CartItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "Address_userId_city_state_idx" ON "Address"("userId", "city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "VehicleBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleGeneration" ADD CONSTRAINT "VehicleGeneration_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConfiguration" ADD CONSTRAINT "VehicleConfiguration_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productBrandId_fkey" FOREIGN KEY ("productBrandId") REFERENCES "ProductBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVehicleCompatibility" ADD CONSTRAINT "ProductVehicleCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVehicleCompatibility" ADD CONSTRAINT "ProductVehicleCompatibility_vehicleBrandId_fkey" FOREIGN KEY ("vehicleBrandId") REFERENCES "VehicleBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVehicleCompatibility" ADD CONSTRAINT "ProductVehicleCompatibility_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVehicleCompatibility" ADD CONSTRAINT "ProductVehicleCompatibility_vehicleGenerationId_fkey" FOREIGN KEY ("vehicleGenerationId") REFERENCES "VehicleGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVehicleCompatibility" ADD CONSTRAINT "ProductVehicleCompatibility_vehicleConfigurationId_fkey" FOREIGN KEY ("vehicleConfigurationId") REFERENCES "VehicleConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

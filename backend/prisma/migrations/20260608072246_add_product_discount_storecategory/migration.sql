-- AlterTable
ALTER TABLE "products" ADD COLUMN     "discountEndAt" TIMESTAMP(3),
ADD COLUMN     "discountStartAt" TIMESTAMP(3),
ADD COLUMN     "storeCategoryId" TEXT,
ADD COLUMN     "teaTypeCustom" TEXT;

-- CreateTable
CREATE TABLE "store_categories" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_categories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeCategoryId_fkey" FOREIGN KEY ("storeCategoryId") REFERENCES "store_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_categories" ADD CONSTRAINT "store_categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

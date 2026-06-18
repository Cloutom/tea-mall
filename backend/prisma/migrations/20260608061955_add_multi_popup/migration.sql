-- DropIndex
DROP INDEX "store_popups_storeId_key";

-- AlterTable
ALTER TABLE "store_popups" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "popupDisplayMode" TEXT NOT NULL DEFAULT 'individual';

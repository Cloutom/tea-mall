-- AlterTable
ALTER TABLE "products" ADD COLUMN     "aroma" TEXT,
ADD COLUMN     "body" TEXT,
ADD COLUMN     "flavorAstringent" INTEGER,
ADD COLUMN     "flavorBitter" INTEGER,
ADD COLUMN     "flavorFloral" INTEGER,
ADD COLUMN     "flavorSavory" INTEGER,
ADD COLUMN     "flavorSweet" INTEGER,
ADD COLUMN     "harvestSeason" TEXT,
ADD COLUMN     "isSignature" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liquidColor" TEXT,
ADD COLUMN     "processingMethod" TEXT,
ADD COLUMN     "recommendedTime" TEXT;

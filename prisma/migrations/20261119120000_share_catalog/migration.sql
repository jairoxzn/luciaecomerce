-- CreateTable
CREATE TABLE "ShareCatalog" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "categoryIds" TEXT[],
    "productIds" TEXT[],
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "onlyInStock" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareCatalog_token_key" ON "ShareCatalog"("token");

-- CreateIndex
CREATE INDEX "ShareCatalog_createdAt_idx" ON "ShareCatalog"("createdAt");

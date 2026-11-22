-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_variantId_email_key" ON "StockAlert"("variantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_variantId_phone_key" ON "StockAlert"("variantId", "phone");

-- CreateIndex
CREATE INDEX "StockAlert_variantId_notifiedAt_idx" ON "StockAlert"("variantId", "notifiedAt");

-- CreateIndex
CREATE INDEX "StockAlert_notifiedAt_idx" ON "StockAlert"("notifiedAt");

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

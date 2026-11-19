-- Índices para las consultas más frecuentes (listados, portada, variantes, pedidos y contador del panel).
-- Primero se crean los nuevos y después se eliminan los de una sola columna que quedan cubiertos por un compuesto.

-- Product: listados por categoría + estado + orden, orden por ventas, y bloques de la portada
CREATE INDEX "Product_status_soldCount_idx" ON "Product"("status", "soldCount");
CREATE INDEX "Product_status_isFeatured_updatedAt_idx" ON "Product"("status", "isFeatured", "updatedAt");
CREATE INDEX "Product_status_isNew_createdAt_idx" ON "Product"("status", "isNew", "createdAt");
CREATE INDEX "Product_status_isBestSeller_soldCount_idx" ON "Product"("status", "isBestSeller", "soldCount");
CREATE INDEX "Product_categoryId_status_createdAt_idx" ON "Product"("categoryId", "status", "createdAt");

-- ProductImage: FK a Color
CREATE INDEX "ProductImage_colorId_idx" ON "ProductImage"("colorId");

-- ProductVariant: variantes activas de un producto y FKs de talla/color (facetas del catálogo)
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
CREATE INDEX "ProductVariant_sizeId_idx" ON "ProductVariant"("sizeId");
CREATE INDEX "ProductVariant_colorId_idx" ON "ProductVariant"("colorId");

-- CartItem: FK a variante
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- Order: pedidos por cupón
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");

-- ContactMessage: mensajes sin leer
CREATE INDEX "ContactMessage_readAt_idx" ON "ContactMessage"("readAt");

-- Índices anteriores, ahora redundantes (su columna inicial es la misma en un compuesto)
DROP INDEX "Product_categoryId_status_idx";
DROP INDEX "Product_isFeatured_idx";
DROP INDEX "Product_isBestSeller_idx";
DROP INDEX "ProductVariant_productId_idx";

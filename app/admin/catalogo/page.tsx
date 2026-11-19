import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { ShareCatalogManager } from "@/components/admin/catalog/share-catalog-manager";
import { getSettings } from "@/lib/services/settings";
import { countShareProducts } from "@/lib/services/share-catalog";

export const metadata = { title: "Catálogo compartido" };

export default async function ShareCatalogPage() {
  const [catalogs, categories, products, settings] = await Promise.all([
    prisma.shareCatalog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, take: 1000, select: { id: true, name: true, sku: true, category: { select: { name: true } } } }),
    getSettings(),
  ]);
  const counts = await Promise.all(catalogs.map((c) => countShareProducts(c)));

  return (
    <>
      <PageHeader title="Catálogo compartido" description="Crea catálogos con enlace propio para enviarlos a tus clientes por WhatsApp, redes o correo. Muestran solo productos activos, con sus precios y promociones vigentes." />
      <ShareCatalogManager
        storeName={settings.storeName}
        categories={categories}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, category: p.category.name }))}
        catalogs={catalogs.map((c, i) => ({
          id: c.id, token: c.token, title: c.title, message: c.message, categoryIds: c.categoryIds, productIds: c.productIds,
          showPrices: c.showPrices, onlyInStock: c.onlyInStock, isActive: c.isActive, expiresAt: c.expiresAt?.toISOString() ?? null,
          views: c.views, createdAt: c.createdAt.toISOString(), productCount: counts[i],
        }))}
      />
    </>
  );
}

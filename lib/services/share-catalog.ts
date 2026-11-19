import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCard, type ProductCardData } from "@/lib/services/catalog";
import { loadActivePromotions } from "@/lib/services/pricing";
import { isShareLive, shareCatalogWhere, SHARE_CATALOG_MAX_PRODUCTS } from "@/lib/share-catalog-core";

/** Token público, no adivinable (72 bits, URL-safe). */
export const newShareToken = () => randomBytes(9).toString("base64url");

const include = {
  category: { select: { name: true, sortOrder: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: { where: { isActive: true }, select: { stock: true, size: { select: { name: true, sortOrder: true } }, color: { select: { name: true, hex: true, sortOrder: true } } } },
} satisfies Prisma.ProductInclude;

export type SharedProduct = ProductCardData & { slug: string; sizes: string[]; categoryOrder: number };

export type SharedCatalogView = {
  id: string;
  title: string;
  message: string | null;
  showPrices: boolean;
  groups: { category: string; products: SharedProduct[] }[];
  total: number;
};

/** Catálogo público por token, o null si no existe, está desactivado o venció. */
export async function getSharedCatalog(token: string): Promise<SharedCatalogView | null> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(token)) return null;
  const c = await prisma.shareCatalog.findUnique({ where: { token } });
  if (!c || !isShareLive(c)) return null;

  const [rows, promos] = await Promise.all([
    prisma.product.findMany({
      where: shareCatalogWhere(c),
      orderBy: [{ category: { sortOrder: "asc" } }, { isFeatured: "desc" }, { createdAt: "desc" }],
      take: SHARE_CATALOG_MAX_PRODUCTS,
      include,
    }),
    loadActivePromotions(),
  ]);

  const products: SharedProduct[] = rows.map((p) => {
    const sizes = new Map<string, number>();
    for (const v of p.variants) if (v.stock > 0 || !c.onlyInStock) sizes.set(v.size.name, v.size.sortOrder);
    return {
      ...toCard(p, promos),
      sizes: [...sizes.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n),
      categoryOrder: p.category.sortOrder,
    };
  });

  // Agrupa por categoría respetando el orden de la tienda (sortOrder, luego nombre)
  const byCategory = new Map<string, { order: number; products: SharedProduct[] }>();
  for (const p of products) {
    const g = byCategory.get(p.categoryName) ?? { order: p.categoryOrder, products: [] };
    g.products.push(p);
    byCategory.set(p.categoryName, g);
  }
  const groups: SharedCatalogView["groups"] = [...byCategory.entries()]
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0], "es"))
    .map(([category, g]) => ({ category, products: g.products }));

  return { id: c.id, title: c.title, message: c.message, showPrices: c.showPrices, groups, total: products.length };
}

/** Cantidad de productos que muestra cada catálogo (para el listado del panel). */
export async function countShareProducts(c: { categoryIds: string[]; productIds: string[]; onlyInStock: boolean }) {
  const n = await prisma.product.count({ where: shareCatalogWhere(c) });
  return Math.min(n, SHARE_CATALOG_MAX_PRODUCTS);
}

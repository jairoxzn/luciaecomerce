import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { resolvePrice, type PromoRule } from "@/lib/pricing-core";
import { loadActivePromotions } from "@/lib/services/pricing";

export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 12;

export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG);
}

// ───────────────────────── Tipos ─────────────────────────

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  image2: string | null;
  categoryName: string;
  price: number; // precio efectivo (lo que paga)
  compareAt: number | null; // precio tachado
  discountPct: number;
  isNew: boolean;
  isBestSeller: boolean;
  isDemo: boolean;
  inStock: boolean;
  colors: { name: string; hex: string }[];
};

export type NavCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  description: string | null;
  showOnHome: boolean;
  subcategories: { id: string; name: string; slug: string }[];
};

// ───────────────────────── Categorías ─────────────────────────

const getNavCategoriesCached = unstable_cache(
  async (): Promise<NavCategory[]> => {
    const cats = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { subcategories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
      description: c.description,
      showOnHome: c.showOnHome,
      subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    }));
  },
  ["nav-categories"],
  { tags: [CATALOG_TAG], revalidate: 300 },
);

export const getNavCategories = cache(() => getNavCategoriesCached());

// ───────────────────────── Tarjetas de producto ─────────────────────────

const cardInclude = {
  category: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: { where: { isActive: true }, select: { stock: true, color: { select: { name: true, hex: true, sortOrder: true } } } },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function toCard(p: CardRow, promos: PromoRule[]): ProductCardData {
  const r = resolvePrice({ price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, categoryId: p.categoryId }, promos);
  const seen = new Map<string, { name: string; hex: string; order: number }>();
  for (const v of p.variants) if (!seen.has(v.color.name)) seen.set(v.color.name, { name: v.color.name, hex: v.color.hex, order: v.color.sortOrder });
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images[0]?.url ?? null,
    image2: p.images[1]?.url ?? null,
    categoryName: p.category.name,
    price: r.unitCents / 100,
    compareAt: r.onSale ? r.regularCents / 100 : null,
    discountPct: r.discountPct,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    isDemo: p.isDemo,
    inStock: p.variants.some((v) => v.stock > 0),
    colors: [...seen.values()].sort((a, b) => a.order - b.order).map(({ name, hex }) => ({ name, hex })),
  };
}

async function cardsFor(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[], take: number) {
  const [rows, promos] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE", ...where }, orderBy, take, include: cardInclude }),
    loadActivePromotions(), // compartida por petición (React cache)
  ]);
  return rows.map((r) => toCard(r, promos));
}

// ───────────────────────── Listado con filtros ─────────────────────────

export type CatalogFilters = {
  categoria?: string;
  subcategoria?: string;
  min?: number;
  max?: number;
  tallas?: string[];
  colores?: string[];
  disponible?: boolean;
  oferta?: boolean;
  q?: string;
  orden?: "recientes" | "precio-asc" | "precio-desc" | "vendidos";
  pagina?: number;
};

export type CatalogResult = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  priceRange: { min: number; max: number };
  facets: { sizes: string[]; colors: { name: string; hex: string }[] };
  category: { name: string; slug: string; description: string | null } | null;
  subcategory: { name: string; slug: string } | null;
};

export async function listProducts(f: CatalogFilters): Promise<CatalogResult> {
  const promos = await loadActivePromotions();
  const and: Prisma.ProductWhereInput[] = [];
  let category: CatalogResult["category"] = null;
  let subcategory: CatalogResult["subcategory"] = null;
  let categoryId: string | null = null;

  if (f.categoria) {
    const c = await prisma.category.findUnique({ where: { slug: f.categoria }, select: { id: true, name: true, slug: true, description: true } });
    if (c) {
      category = { name: c.name, slug: c.slug, description: c.description };
      categoryId = c.id;
      and.push({ categoryId: c.id });
      if (f.subcategoria) {
        const s = await prisma.subcategory.findFirst({ where: { categoryId: c.id, slug: f.subcategoria }, select: { id: true, name: true, slug: true } });
        if (s) {
          subcategory = s;
          and.push({ subcategoryId: s.id });
        }
      }
    } else {
      and.push({ id: "__none__" });
    }
  }
  if (f.q?.trim()) {
    const q = f.q.trim().slice(0, 80);
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
        { subcategory: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.tallas?.length || f.colores?.length || f.disponible) {
    and.push({
      variants: {
        some: {
          isActive: true,
          ...(f.tallas?.length ? { size: { name: { in: f.tallas } } } : {}),
          ...(f.colores?.length ? { color: { name: { in: f.colores } } } : {}),
          ...(f.disponible ? { stock: { gt: 0 } } : {}),
        },
      },
    });
  }

  const where: Prisma.ProductWhereInput = { status: "ACTIVE", AND: and };

  // Para filtrar/ordenar por precio efectivo (con promociones) se calcula en memoria sobre filas livianas
  const light = await prisma.product.findMany({
    where,
    select: { id: true, price: true, salePrice: true, categoryId: true, createdAt: true, soldCount: true },
  });
  let rows = light.map((p) => ({
    ...p,
    eff: resolvePrice({ price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, categoryId: p.categoryId }, promos),
  }));
  if (f.oferta) rows = rows.filter((r) => r.eff.onSale);
  const allPrices = rows.map((r) => r.eff.unitCents / 100);
  const priceRange = { min: allPrices.length ? Math.floor(Math.min(...allPrices)) : 0, max: allPrices.length ? Math.ceil(Math.max(...allPrices)) : 0 };
  if (f.min != null) rows = rows.filter((r) => r.eff.unitCents / 100 >= f.min!);
  if (f.max != null) rows = rows.filter((r) => r.eff.unitCents / 100 <= f.max!);

  const order = f.orden ?? "recientes";
  rows.sort((a, b) => {
    if (order === "precio-asc") return a.eff.unitCents - b.eff.unitCents;
    if (order === "precio-desc") return b.eff.unitCents - a.eff.unitCents;
    if (order === "vendidos") return b.soldCount - a.soldCount || b.createdAt.getTime() - a.createdAt.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, f.pagina ?? 1), pageCount);
  const ids = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.id);

  const full = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, include: cardInclude }) : [];
  const byId = new Map(full.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p): p is CardRow => !!p).map((p) => toCard(p, promos));

  const scope: Prisma.ProductWhereInput = { status: "ACTIVE", ...(categoryId ? { categoryId } : {}) };
  const [sizes, colors] = await Promise.all([
    prisma.size.findMany({ where: { variants: { some: { isActive: true, product: scope } } }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.color.findMany({ where: { variants: { some: { isActive: true, product: scope } } }, orderBy: { sortOrder: "asc" }, select: { name: true, hex: true } }),
  ]);

  return { items, total, page, pageCount, priceRange, facets: { sizes: sizes.map((s) => s.name), colors }, category, subcategory };
}

// ───────────────────────── Detalle ─────────────────────────

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  description: string;
  material: string | null;
  careInstructions: string | null;
  categoryId: string;
  category: { name: string; slug: string };
  subcategory: { name: string; slug: string } | null;
  images: { id: string; url: string; alt: string | null; colorName: string | null }[];
  variants: { id: string; sizeName: string; colorName: string; colorHex: string; stock: number; sku: string; price: number; compareAt: number | null; discountPct: number }[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  price: number;
  compareAt: number | null;
  discountPct: number;
  isNew: boolean;
  isBestSeller: boolean;
  isDemo: boolean;
  status: string;
  updatedAt: string;
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const [p, promos] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      include: {
        category: { select: { name: true, slug: true } },
        subcategory: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, include: { color: { select: { name: true } } } },
        variants: { where: { isActive: true }, include: { size: true, color: true }, orderBy: [{ color: { sortOrder: "asc" } }, { size: { sortOrder: "asc" } }] },
      },
    }),
    loadActivePromotions(),
  ]);
  if (!p || p.status !== "ACTIVE") return null;
  const base = resolvePrice({ price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, categoryId: p.categoryId }, promos);
  const variants = p.variants.map((v) => {
    const r = resolvePrice(
      { price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, variantPrice: v.price ? num(v.price) : null, categoryId: p.categoryId },
      promos,
    );
    return {
      id: v.id,
      sizeName: v.size.name,
      colorName: v.color.name,
      colorHex: v.color.hex,
      stock: v.stock,
      sku: v.sku,
      price: r.unitCents / 100,
      compareAt: r.onSale ? r.regularCents / 100 : null,
      discountPct: r.discountPct,
    };
  });
  const sizes = [...new Map(p.variants.map((v) => [v.size.name, v.size.sortOrder])).entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  const colors = [...new Map(p.variants.map((v) => [v.color.name, { name: v.color.name, hex: v.color.hex, order: v.color.sortOrder }])).values()]
    .sort((a, b) => a.order - b.order)
    .map(({ name, hex }) => ({ name, hex }));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    description: p.description,
    material: p.material,
    careInstructions: p.careInstructions,
    categoryId: p.categoryId,
    category: p.category,
    subcategory: p.subcategory,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, colorName: i.color?.name ?? null })),
    variants,
    sizes,
    colors,
    price: base.unitCents / 100,
    compareAt: base.onSale ? base.regularCents / 100 : null,
    discountPct: base.discountPct,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    isDemo: p.isDemo,
    status: p.status,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getRelatedProducts(productId: string, categoryId: string, subcategorySlug?: string | null, take = 4) {
  const items = await cardsFor({ categoryId, id: { not: productId } }, [{ isBestSeller: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }], take + 4);
  void subcategorySlug;
  return items.slice(0, take);
}

// ───────────────────────── Inicio ─────────────────────────

export type BannerData = {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
};

const loadActiveBanners = cache(async () => {
  const now = new Date();
  return prisma.banner.findMany({
    where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
    orderBy: { sortOrder: "asc" },
  });
});

export async function getBanners(position: "HERO" | "PROMO" | "COLLECTION"): Promise<BannerData[]> {
  const rows = await loadActiveBanners();
  return rows.filter((r) => r.position === position).map(({ id, title, subtitle, ctaLabel, ctaHref, imageUrl, mobileImageUrl }) => ({ id, title, subtitle, ctaLabel, ctaHref, imageUrl, mobileImageUrl }));
}

export async function getHomeData() {
  // Se limita la concurrencia (tandas) para no agotar el pool de conexiones
  const [hero, promo, collections] = await Promise.all([getBanners("HERO"), getBanners("PROMO"), getBanners("COLLECTION")]);
  const [featured, newest] = await Promise.all([
    cardsFor({ isFeatured: true }, { updatedAt: "desc" }, 8),
    cardsFor({ isNew: true }, { createdAt: "desc" }, 8),
  ]);
  const [best, offers] = await Promise.all([
    cardsFor({}, [{ isBestSeller: "desc" }, { soldCount: "desc" }], 8),
    cardsFor({ OR: [{ salePrice: { not: null } }] }, { updatedAt: "desc" }, 8),
  ]);
  return { hero, promo, collections, featured, newest, best, offers };
}

export async function getOfferProducts(take = 48) {
  // Ofertas = productos con precio de oferta propio o dentro de una promoción activa
  const [rows, promos] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, include: cardInclude }),
    loadActivePromotions(),
  ]);
  return rows.map((r) => toCard(r, promos)).filter((c) => c.compareAt !== null).slice(0, take);
}

export async function getFavoriteProducts(userId: string) {
  const [rows, promos] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId, product: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      include: { product: { include: cardInclude } },
    }),
    loadActivePromotions(),
  ]);
  return rows.map((r) => toCard(r.product, promos));
}

export async function searchSuggestions(q: string) {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  return cardsFor(
    { OR: [{ name: { contains: term, mode: "insensitive" } }, { category: { name: { contains: term, mode: "insensitive" } } }, { subcategory: { name: { contains: term, mode: "insensitive" } } }] },
    [{ isBestSeller: "desc" }, { soldCount: "desc" }],
    6,
  );
}

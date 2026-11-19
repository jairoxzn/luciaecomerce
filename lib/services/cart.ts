import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_CART_QTY } from "@/lib/constants";
import { num } from "@/lib/utils";
import { CouponError, computeShipping, evaluateCoupon, ShippingError, resolvePrice, type CouponRule, type ZoneRule } from "@/lib/pricing-core";
import { loadActivePromotions } from "@/lib/services/pricing";
import { getSettings } from "@/lib/services/settings";

export type CartItemInput = { variantId: string; quantity: number };

export type LineIssue = "UNAVAILABLE" | "OUT_OF_STOCK" | "REDUCED";

export type CartLine = {
  variantId: string;
  productId: string;
  categoryId: string;
  slug: string;
  name: string;
  sku: string;
  image: string | null;
  sizeName: string;
  colorName: string;
  colorHex: string;
  stock: number;
  quantity: number; // cantidad vigente (ya acotada al stock)
  requested: number;
  unitCents: number;
  regularCents: number;
  lineCents: number;
  onSale: boolean;
  issue: LineIssue | null;
};

type Db = Prisma.TransactionClient | typeof prisma;

export function mergeItems(items: CartItemInput[]): CartItemInput[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (!it.variantId || !Number.isFinite(it.quantity) || it.quantity < 1) continue;
    map.set(it.variantId, Math.min(MAX_CART_QTY, (map.get(it.variantId) ?? 0) + Math.floor(it.quantity)));
  }
  return [...map].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Resuelve cada línea con datos y precios VIGENTES de la base de datos. */
export async function resolveLines(items: CartItemInput[], db: Db = prisma): Promise<CartLine[]> {
  const merged = mergeItems(items);
  if (!merged.length) return [];
  const [variants, promos] = await Promise.all([
    db.productVariant.findMany({
      where: { id: { in: merged.map((m) => m.variantId) } },
      include: {
        size: true,
        color: true,
        product: { include: { images: { orderBy: { sortOrder: "asc" } } } },
      },
    }),
    loadActivePromotions(),
  ]);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: CartLine[] = [];
  for (const it of merged) {
    const v = byId.get(it.variantId);
    if (!v) continue; // variante eliminada: se omite
    const p = v.product;
    const price = resolvePrice(
      { price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, variantPrice: v.price ? num(v.price) : null, categoryId: p.categoryId },
      promos,
    );
    const sellable = p.status === "ACTIVE" && v.isActive;
    let issue: LineIssue | null = null;
    let qty = it.quantity;
    if (!sellable) {
      issue = "UNAVAILABLE";
      qty = 0;
    } else if (v.stock <= 0) {
      issue = "OUT_OF_STOCK";
      qty = 0;
    } else if (qty > v.stock) {
      issue = "REDUCED";
      qty = v.stock;
    }
    const img = p.images.find((i) => i.colorId === v.colorId) ?? p.images[0];
    lines.push({
      variantId: v.id,
      productId: p.id,
      categoryId: p.categoryId,
      slug: p.slug,
      name: p.name,
      sku: v.sku,
      image: img?.url ?? null,
      sizeName: v.size.name,
      colorName: v.color.name,
      colorHex: v.color.hex,
      stock: v.stock,
      quantity: qty,
      requested: it.quantity,
      unitCents: price.unitCents,
      regularCents: price.regularCents,
      lineCents: price.unitCents * qty,
      onSale: price.onSale,
      issue,
    });
  }
  return lines;
}

export async function loadCoupon(code: string, db: Db = prisma): Promise<CouponRule | null> {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() }, include: { categories: { select: { id: true } } } });
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    discountType: c.discountType,
    value: num(c.value),
    minPurchase: c.minPurchase ? num(c.minPurchase) : null,
    startsAt: c.startsAt,
    expiresAt: c.expiresAt,
    usageLimit: c.usageLimit,
    usedCount: c.usedCount,
    isActive: c.isActive,
    categoryIds: c.categories.map((x) => x.id),
  };
}

export async function loadZones(db: Db = prisma): Promise<ZoneRule[]> {
  const zones = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    departments: z.departments,
    price: num(z.price),
    freeShippingFrom: z.freeShippingFrom ? num(z.freeShippingFrom) : null,
    estimatedDays: z.estimatedDays,
  }));
}

export type Quote = {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number | null; // null: aún no se puede calcular
  totalCents: number;
  couponCode: string | null;
  couponId: string | null;
  couponError: string | null;
  shippingError: string | null;
  shippingZoneName: string | null;
  freeShipping: boolean;
  hasBlockingIssues: boolean;
};

export type QuoteOptions = {
  couponCode?: string | null;
  delivery?: { method: "DELIVERY" | "PICKUP"; department?: string | null } | null;
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Convierte una promesa en resultado: permite lanzarla en paralelo y decidir después (como antes) si su error importa. */
const settle = <T>(p: Promise<T>): Promise<Settled<T>> => p.then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
function unwrap<T>(s: Settled<T>): T {
  if (!s.ok) throw s.error;
  return s.value;
}

/** Cotización completa calculada en servidor: nunca se confía en importes del cliente. */
export async function buildQuote(items: CartItemInput[], opts: QuoteOptions = {}, db: Db = prisma): Promise<Quote> {
  // Líneas, cupón y datos de envío son independientes entre sí: se piden en paralelo.
  // (Si el cupón o el envío fallan, el error se resuelve más abajo con la misma lógica de siempre.)
  const [lines, couponLoad, shippingLoad] = await Promise.all([
    resolveLines(items, db),
    opts.couponCode?.trim() ? settle(loadCoupon(opts.couponCode, db)) : null,
    opts.delivery ? settle(Promise.all([getSettings(), loadZones(db)])) : null,
  ]);
  const active = lines.filter((l) => l.quantity > 0);
  const subtotalCents = active.reduce((s, l) => s + l.lineCents, 0);

  let discountCents = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let couponError: string | null = null;
  if (couponLoad) {
    try {
      const coupon = unwrap(couponLoad);
      if (!coupon) throw new CouponError("El cupón ingresado no existe.");
      discountCents = evaluateCoupon(coupon, active.map((l) => ({ categoryId: l.categoryId, lineCents: l.lineCents })));
      couponId = coupon.id;
      couponCode = coupon.code;
    } catch (e) {
      if (e instanceof CouponError) couponError = e.message;
      else throw e;
    }
  }

  let shippingCents: number | null = null;
  let shippingError: string | null = null;
  let shippingZoneName: string | null = null;
  let freeShipping = false;
  if (opts.delivery && shippingLoad && active.length) {
    try {
      const [settings, zones] = unwrap(shippingLoad);
      const s = computeShipping({
        method: opts.delivery.method,
        department: opts.delivery.department,
        afterDiscountCents: subtotalCents - discountCents,
        zones,
        pickupPrice: settings.pickupPrice,
        pickupEnabled: settings.pickupEnabled,
      });
      shippingCents = s.cents;
      shippingZoneName = s.zone?.name ?? null;
      freeShipping = s.free;
    } catch (e) {
      if (e instanceof ShippingError) shippingError = e.message;
      else throw e;
    }
  }

  return {
    lines,
    itemCount: active.reduce((s, l) => s + l.quantity, 0),
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: subtotalCents - discountCents + (shippingCents ?? 0),
    couponCode,
    couponId,
    couponError,
    shippingError,
    shippingZoneName,
    freeShipping,
    hasBlockingIssues: lines.length === 0 || lines.some((l) => l.issue === "UNAVAILABLE" || l.issue === "OUT_OF_STOCK"),
  };
}

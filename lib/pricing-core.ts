import type { DiscountType } from "@prisma/client";
import { toCents } from "@/lib/utils";

/**
 * Cálculo de precios (lógica pura). TODO se calcula en céntimos enteros y SOLO en el servidor.
 *
 * Precio regular   = precio de la variante (si tiene) o precio del producto.
 * Precio efectivo  = el menor entre: precio regular, precio de oferta del producto
 *                    (solo si la variante no define precio propio) y descuento de promociones activas.
 */

export type PromoRule = { discountType: DiscountType; value: number; categoryId: string | null };

export type PriceInput = {
  price: number; // precio regular del producto (S/)
  salePrice?: number | null; // oferta del producto
  variantPrice?: number | null; // precio propio de la variante
  categoryId: string;
};

export type PriceResult = {
  unitCents: number; // lo que paga el cliente por unidad
  regularCents: number; // precio tachado de referencia
  onSale: boolean;
  discountPct: number;
};

export function applyPromo(baseCents: number, rule: PromoRule) {
  if (rule.discountType === "PERCENT") return Math.max(0, Math.round(baseCents * (1 - rule.value / 100)));
  return Math.max(0, baseCents - toCents(rule.value));
}

export function resolvePrice(input: PriceInput, promos: PromoRule[]): PriceResult {
  const regularCents = toCents(input.variantPrice ?? input.price);
  let unit = regularCents;
  if (input.variantPrice == null && input.salePrice != null) {
    unit = Math.min(unit, toCents(input.salePrice));
  }
  for (const p of promos) {
    if (p.categoryId && p.categoryId !== input.categoryId) continue;
    unit = Math.min(unit, applyPromo(regularCents, p));
  }
  const onSale = unit < regularCents;
  return {
    unitCents: unit,
    regularCents,
    onSale,
    discountPct: onSale && regularCents > 0 ? Math.round((1 - unit / regularCents) * 100) : 0,
  };
}

// ───────────────────────── Cupones ─────────────────────────

export type CouponRule = {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  minPurchase: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  categoryIds: string[];
};

export type CouponLine = { categoryId: string; lineCents: number };

export class CouponError extends Error {}

/** Valida todas las condiciones del cupón y devuelve el descuento en céntimos. */
export function evaluateCoupon(c: CouponRule, lines: CouponLine[], now = new Date()): number {
  if (!c.isActive) throw new CouponError("Este cupón no está activo.");
  if (c.startsAt && now < c.startsAt) throw new CouponError("Este cupón aún no está vigente.");
  if (c.expiresAt && now > c.expiresAt) throw new CouponError("Este cupón ha vencido.");
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) throw new CouponError("Este cupón alcanzó su límite de usos.");
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  if (c.minPurchase != null && subtotal < toCents(c.minPurchase)) {
    throw new CouponError(`Este cupón requiere una compra mínima de S/ ${c.minPurchase.toFixed(2)}.`);
  }
  const eligible = c.categoryIds.length
    ? lines.filter((l) => c.categoryIds.includes(l.categoryId)).reduce((s, l) => s + l.lineCents, 0)
    : subtotal;
  if (eligible <= 0) throw new CouponError("Este cupón no aplica a los productos de tu carrito.");
  const raw = c.discountType === "PERCENT" ? Math.floor((eligible * c.value) / 100) : Math.min(toCents(c.value), eligible);
  return Math.min(raw, subtotal);
}

// ───────────────────────── Envío ─────────────────────────

export type ZoneRule = { id: string; name: string; departments: string[]; price: number; freeShippingFrom: number | null; estimatedDays: string | null };

export class ShippingError extends Error {}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function findZone(zones: ZoneRule[], department: string) {
  const d = norm(department);
  return zones.find((z) => z.departments.some((x) => norm(x) === d)) ?? null;
}

export function computeShipping(opts: {
  method: "DELIVERY" | "PICKUP";
  department?: string | null;
  afterDiscountCents: number;
  zones: ZoneRule[];
  pickupPrice: number;
  pickupEnabled: boolean;
}): { cents: number; zone: ZoneRule | null; free: boolean } {
  if (opts.method === "PICKUP") {
    if (!opts.pickupEnabled) throw new ShippingError("El recojo en tienda no está disponible.");
    return { cents: toCents(opts.pickupPrice), zone: null, free: opts.pickupPrice === 0 };
  }
  if (!opts.department) throw new ShippingError("Selecciona el departamento de entrega.");
  const zone = findZone(opts.zones, opts.department);
  if (!zone) throw new ShippingError(`Aún no realizamos envíos a ${opts.department}. Puedes elegir recojo en tienda.`);
  const free = zone.freeShippingFrom != null && opts.afterDiscountCents >= toCents(zone.freeShippingFrom);
  return { cents: free ? 0 : toCents(zone.price), zone, free };
}

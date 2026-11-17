import { describe, expect, it } from "vitest";
import { CouponError, computeShipping, evaluateCoupon, resolvePrice, ShippingError, type CouponRule, type ZoneRule } from "@/lib/pricing-core";

const rule = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1", code: "TEST", discountType: "PERCENT", value: 10, minPurchase: null, startsAt: null, expiresAt: null, usageLimit: null, usedCount: 0, isActive: true, categoryIds: [], ...over,
});
const lines = [{ categoryId: "a", lineCents: 10_000 }, { categoryId: "b", lineCents: 5_000 }];

describe("resolvePrice", () => {
  it("usa el precio de oferta del producto", () => {
    const r = resolvePrice({ price: 100, salePrice: 80, categoryId: "a" }, []);
    expect(r.unitCents).toBe(8000);
    expect(r.regularCents).toBe(10000);
    expect(r.onSale).toBe(true);
    expect(r.discountPct).toBe(20);
  });
  it("el precio propio de la variante reemplaza al del producto e ignora la oferta del producto", () => {
    const r = resolvePrice({ price: 100, salePrice: 80, variantPrice: 120, categoryId: "a" }, []);
    expect(r.regularCents).toBe(12000);
    expect(r.unitCents).toBe(12000);
    expect(r.onSale).toBe(false);
  });
  it("aplica la promoción porcentual de su categoría y elige el menor precio", () => {
    const promos = [{ discountType: "PERCENT" as const, value: 30, categoryId: "a" }];
    expect(resolvePrice({ price: 100, salePrice: 80, categoryId: "a" }, promos).unitCents).toBe(7000);
    expect(resolvePrice({ price: 100, salePrice: 80, categoryId: "b" }, promos).unitCents).toBe(8000); // otra categoría
  });
  it("la promoción de monto fijo nunca deja el precio negativo", () => {
    const r = resolvePrice({ price: 10, categoryId: "a" }, [{ discountType: "FIXED", value: 50, categoryId: null }]);
    expect(r.unitCents).toBe(0);
  });
  it("evita errores de coma flotante", () => {
    expect(resolvePrice({ price: 19.99, salePrice: 14.99, categoryId: "a" }, []).unitCents).toBe(1499);
  });
});

describe("evaluateCoupon", () => {
  it("calcula descuento porcentual sobre el subtotal", () => {
    expect(evaluateCoupon(rule(), lines)).toBe(1500);
  });
  it("descuento fijo no supera el subtotal", () => {
    expect(evaluateCoupon(rule({ discountType: "FIXED", value: 500 }), lines)).toBe(15000);
  });
  it("restringe por categorías aplicables", () => {
    expect(evaluateCoupon(rule({ categoryIds: ["b"] }), lines)).toBe(500);
    expect(() => evaluateCoupon(rule({ categoryIds: ["zzz"] }), lines)).toThrow(CouponError);
  });
  it("rechaza cupón inactivo, vencido, no iniciado, agotado y bajo compra mínima", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    expect(() => evaluateCoupon(rule({ isActive: false }), lines, now)).toThrow(/no está activo/);
    expect(() => evaluateCoupon(rule({ expiresAt: new Date("2026-06-01") }), lines, now)).toThrow(/vencido/);
    expect(() => evaluateCoupon(rule({ startsAt: new Date("2026-07-01") }), lines, now)).toThrow(/vigente/);
    expect(() => evaluateCoupon(rule({ usageLimit: 3, usedCount: 3 }), lines, now)).toThrow(/límite/);
    expect(() => evaluateCoupon(rule({ minPurchase: 200 }), lines, now)).toThrow(/compra mínima/);
  });
});

describe("computeShipping", () => {
  const zones: ZoneRule[] = [{ id: "z", name: "Lima", departments: ["Lima", "Callao"], price: 10, freeShippingFrom: 200, estimatedDays: null }];
  const base = { zones, pickupPrice: 0, pickupEnabled: true };
  it("cobra el costo de la zona", () => {
    expect(computeShipping({ ...base, method: "DELIVERY", department: "Lima", afterDiscountCents: 5000 }).cents).toBe(1000);
  });
  it("envío gratis al alcanzar el umbral (tras descuentos)", () => {
    expect(computeShipping({ ...base, method: "DELIVERY", department: "lima", afterDiscountCents: 20000 })).toMatchObject({ cents: 0, free: true });
    expect(computeShipping({ ...base, method: "DELIVERY", department: "Lima", afterDiscountCents: 19999 }).cents).toBe(1000);
  });
  it("reconoce departamentos sin tildes ni mayúsculas", () => {
    const z: ZoneRule[] = [{ ...zones[0], departments: ["Áncash"] }];
    expect(computeShipping({ ...base, zones: z, method: "DELIVERY", department: "ancash", afterDiscountCents: 100 }).cents).toBe(1000);
  });
  it("rechaza departamentos sin cobertura y recojo deshabilitado", () => {
    expect(() => computeShipping({ ...base, method: "DELIVERY", department: "Loreto", afterDiscountCents: 100 })).toThrow(ShippingError);
    expect(() => computeShipping({ ...base, method: "PICKUP", pickupEnabled: false, afterDiscountCents: 100 })).toThrow(ShippingError);
  });
  it("recojo en tienda usa su costo configurado", () => {
    expect(computeShipping({ ...base, method: "PICKUP", pickupPrice: 3, afterDiscountCents: 100 }).cents).toBe(300);
  });
});

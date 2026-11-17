import { describe, expect, it } from "vitest";
import { placeOrderSchema } from "@/lib/validations/checkout";
import { loginSchema, registerSchema, safeNext } from "@/lib/validations/auth";
import { productSchema } from "@/lib/validations/admin";
import { generateOrderCode, allowedNextStatuses } from "@/lib/services/orders";
import { ORDER_TRANSITIONS } from "@/lib/constants";

const validOrder = {
  idempotencyKey: "a".repeat(20),
  items: [{ variantId: "v1", quantity: 2 }],
  customer: { firstName: "Ana", lastName: "Pérez", phone: "987654321", email: "ANA@Example.com", dni: "" },
  delivery: { method: "DELIVERY" as const, department: "Lima", province: "Lima", district: "Miraflores", addressLine: "Av. Larco 123" },
  paymentMethod: "YAPE" as const,
};

describe("checkout schema", () => {
  it("normaliza correo, teléfono y DNI vacío", () => {
    const r = placeOrderSchema.parse({ ...validOrder, customer: { ...validOrder.customer, phone: "+51 987 654 321" } });
    expect(r.customer.email).toBe("ana@example.com");
    expect(r.customer.phone).toBe("987654321");
    expect(r.customer.dni).toBeUndefined();
  });
  it("rechaza teléfono inválido y DNI mal formado", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, customer: { ...validOrder.customer, phone: "12345" } }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...validOrder, customer: { ...validOrder.customer, dni: "123" } }).success).toBe(false);
  });
  it("exige dirección completa solo para envío a domicilio", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, delivery: { method: "DELIVERY" } }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...validOrder, delivery: { method: "PICKUP" } }).success).toBe(true);
  });
  it("limita cantidades y exige al menos un ítem", () => {
    expect(placeOrderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...validOrder, items: [{ variantId: "v", quantity: 11 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...validOrder, items: [{ variantId: "v", quantity: 0 }] }).success).toBe(false);
  });
  it("no acepta importes enviados por el cliente (se descartan)", () => {
    const r = placeOrderSchema.parse({ ...validOrder, total: 1, items: [{ variantId: "v1", quantity: 1, price: 0.01 }] } as never);
    expect(r).not.toHaveProperty("total");
    expect(r.items[0]).not.toHaveProperty("price");
  });
});

describe("auth schemas", () => {
  const reg = { firstName: "Ana", lastName: "Pérez", email: "a@b.com", phone: "987654321", password: "Clave123", confirmPassword: "Clave123", acceptTerms: true as const };
  it("registro válido y contraseñas débiles/distintas", () => {
    expect(registerSchema.safeParse(reg).success).toBe(true);
    expect(registerSchema.safeParse({ ...reg, password: "corta1", confirmPassword: "corta1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...reg, password: "soloLetrasaa", confirmPassword: "soloLetrasaa" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...reg, confirmPassword: "Otra1234" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...reg, acceptTerms: false }).success).toBe(false);
  });
  it("login normaliza el correo", () => {
    expect(loginSchema.parse({ email: " USER@X.COM ", password: "x" }).email).toBe("user@x.com");
  });
  it("safeNext bloquea open-redirect", () => {
    expect(safeNext("/mi-cuenta")).toBe("/mi-cuenta");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("/\\evil.com")).toBeNull();
  });
});

describe("productSchema", () => {
  const p = { name: "Jean", description: "d", categoryId: "c", price: 100, status: "ACTIVE" as const, isFeatured: false, isBestSeller: false, isNew: false };
  it("el precio de oferta debe ser menor al regular", () => {
    expect(productSchema.safeParse({ ...p, salePrice: 80 }).success).toBe(true);
    expect(productSchema.safeParse({ ...p, salePrice: 100 }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, price: 0 }).success).toBe(false);
  });
});

describe("pedidos: códigos y transiciones", () => {
  it("genera códigos con formato y sin caracteres ambiguos", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateOrderCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^LJ-\d{6}-[A-HJ-NP-Z2-9]{5}$/);
  });
  it("no se puede avanzar sin pago aprobado (salvo contra entrega)", () => {
    expect(allowedNextStatuses("PENDIENTE", { method: "YAPE", status: "PENDIENTE" })).toEqual(["CANCELADO"]);
    expect(allowedNextStatuses("PENDIENTE", { method: "COD", status: "PENDIENTE" })).toContain("PREPARANDO");
    expect(allowedNextStatuses("PAGO_CONFIRMADO", { method: "YAPE", status: "APROBADO" })).toContain("PREPARANDO");
  });
  it("estados finales no tienen transiciones", () => {
    expect(ORDER_TRANSITIONS.ENTREGADO).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELADO).toEqual([]);
  });
});

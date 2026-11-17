import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { createOrder, changeOrderStatus, restoreOrderStock } from "@/lib/services/orders";
import { buildQuote } from "@/lib/services/cart";
import { applyStockDelta } from "@/lib/services/inventory";
import { makeProduct, orderInput, prisma, resetDb, seedBasics } from "../helpers";

let base: Awaited<ReturnType<typeof seedBasics>>;

beforeAll(async () => {
  await resetDb();
});
beforeEach(async () => {
  await resetDb();
  base = await seedBasics();
});

const mk = (o: { price?: number; salePrice?: number | null; stock?: number; status?: "ACTIVE" | "DRAFT" } = {}) => makeProduct({ categoryId: base.category.id, sizeId: base.size.id, colorId: base.color.id, ...o });
const stockOf = async (id: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;

describe("createOrder: totales y datos calculados en el servidor", () => {
  it("calcula subtotal, envío y total desde la BD y descuenta el stock con movimiento", async () => {
    const { variant } = await mk({ price: 100, salePrice: 80, stock: 5 });
    const { code, id } = await createOrder(orderInput(variant.id, 2), null);
    const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true, payment: true, history: true } });
    expect(code).toMatch(/^LJ-/);
    expect(Number(order.subtotal)).toBe(160); // 2 × 80 (precio de oferta del servidor)
    expect(Number(order.shippingTotal)).toBe(10);
    expect(Number(order.total)).toBe(170);
    expect(order.status).toBe("PENDIENTE");
    expect(order.payment?.status).toBe("PENDIENTE");
    expect(order.history).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ quantity: 2, sizeName: base.size.name });
    expect(await stockOf(variant.id)).toBe(3);
    const mv = await prisma.inventoryMovement.findMany({ where: { orderId: id } });
    expect(mv).toHaveLength(1);
    expect(mv[0]).toMatchObject({ type: "VENTA", quantity: -2, stockBefore: 5, stockAfter: 3 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } })).soldCount).toBe(2);
  });

  it("envío gratis desde el umbral configurado y recojo en tienda sin costo", async () => {
    const { variant } = await mk({ price: 150, stock: 9 });
    const free = await createOrder(orderInput(variant.id, 2), null); // 300 ≥ 200
    expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: free.id } })).shippingTotal)).toBe(0);
    const pickup = await createOrder({ ...orderInput(variant.id, 1), delivery: { method: "PICKUP" as const } as never, paymentMethod: "YAPE" }, null);
    expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: pickup.id } })).shippingTotal)).toBe(0);
  });

  it("rechaza productos en borrador, variantes inactivas y cantidades sobre el stock", async () => {
    const draft = await mk({ status: "DRAFT" });
    await expect(createOrder(orderInput(draft.variant.id, 1), null)).rejects.toThrow(/ya no está disponible/);
    const { variant } = await mk({ stock: 2 });
    await expect(createOrder(orderInput(variant.id, 3), null)).rejects.toThrow(/Solo quedan 2/);
    await prisma.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });
    await expect(createOrder(orderInput(variant.id, 1), null)).rejects.toThrow(/ya no está disponible/);
    expect(await stockOf(variant.id)).toBe(2);
  });

  it("rechaza métodos de pago deshabilitados y contra entrega con recojo", async () => {
    const { variant } = await mk();
    await expect(createOrder({ ...orderInput(variant.id, 1), paymentMethod: "PLIN" }, null)).rejects.toThrow(/no está disponible/);
    await expect(createOrder({ ...orderInput(variant.id, 1), paymentMethod: "COD", delivery: { method: "PICKUP" } as never }, null)).rejects.toThrow(/contra entrega/);
  });

  it("rechaza envío a un departamento sin cobertura", async () => {
    const { variant } = await mk();
    const input = orderInput(variant.id, 1);
    await expect(createOrder({ ...input, delivery: { ...input.delivery, department: "Loreto" } }, null)).rejects.toThrow(/Aún no realizamos envíos/);
  });
});

describe("concurrencia e integridad de inventario", () => {
  it("NO vende stock inexistente: 8 compras simultáneas de 1 unidad con stock 3 → exactamente 3 pedidos", async () => {
    const { variant } = await mk({ stock: 3 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createOrder(orderInput(variant.id, 1), null)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stockOf(variant.id)).toBe(0);
    expect(await prisma.order.count()).toBe(3);
    const sold = await prisma.inventoryMovement.aggregate({ where: { type: "VENTA" }, _sum: { quantity: true } });
    expect(sold._sum.quantity).toBe(-3);
  });

  it("es idempotente: la misma clave no duplica el pedido ni el descuento de stock", async () => {
    const { variant } = await mk({ stock: 5 });
    const input = orderInput(variant.id, 1);
    const [a, b, c] = await Promise.all([createOrder(input, null), createOrder(input, null), createOrder(input, null)]);
    expect(new Set([a.code, b.code, c.code]).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(variant.id)).toBe(4);
  });

  it("la restricción CHECK de la BD impide stock negativo aun saltándose la lógica de la app", async () => {
    const { variant } = await mk({ stock: 1 });
    await expect(prisma.$executeRaw`UPDATE "ProductVariant" SET "stock" = -1 WHERE "id" = ${variant.id}`).rejects.toThrow();
    await expect(prisma.$transaction((tx) => applyStockDelta(tx, { variantId: variant.id, delta: -2, type: "SALIDA" }))).rejects.toThrow(/Stock insuficiente/);
    expect(await stockOf(variant.id)).toBe(1);
  });

  it("la falla de un ítem revierte todo el pedido (transaccional)", async () => {
    const a = await mk({ stock: 5 });
    const b = await mk({ stock: 1 });
    const input = { ...orderInput(a.variant.id, 1), items: [{ variantId: a.variant.id, quantity: 1 }, { variantId: b.variant.id, quantity: 2 }] };
    await expect(createOrder(input, null)).rejects.toThrow();
    expect(await stockOf(a.variant.id)).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("cupones", () => {
  const coupon = (over: Partial<Prisma.CouponCreateInput> = {}) =>
    prisma.coupon.create({ data: { code: "PROMO10", discountType: "PERCENT", value: new Prisma.Decimal(10), ...over } });

  it("aplica el descuento en el servidor y descuenta del total", async () => {
    const { variant } = await mk({ price: 100, stock: 5 });
    await coupon();
    const q = await buildQuote([{ variantId: variant.id, quantity: 1 }], { couponCode: "promo10", delivery: { method: "DELIVERY", department: "Lima" } });
    expect(q.discountCents).toBe(1000);
    expect(q.totalCents).toBe(10000 - 1000 + 1000);
    const { id } = await createOrder({ ...orderInput(variant.id, 1), couponCode: "PROMO10" }, null);
    const o = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(Number(o.discountTotal)).toBe(10);
    expect(Number(o.total)).toBe(100);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "PROMO10" } })).usedCount).toBe(1);
  });

  it("respeta el límite de usos aun con compras simultáneas (límite 1, 4 intentos → 1 pedido)", async () => {
    const { variant } = await mk({ price: 100, stock: 10 });
    await coupon({ usageLimit: 1 });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => createOrder({ ...orderInput(variant.id, 1), couponCode: "PROMO10" }, null)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "PROMO10" } })).usedCount).toBe(1);
    expect(await stockOf(variant.id)).toBe(9); // los pedidos fallidos no descontaron stock
  });

  it("rechaza cupones vencidos, inactivos o bajo compra mínima", async () => {
    const { variant } = await mk({ price: 50, stock: 5 });
    await coupon({ code: "OLD", expiresAt: new Date(Date.now() - 86400_000) });
    await coupon({ code: "OFF", isActive: false });
    await coupon({ code: "MIN", minPurchase: new Prisma.Decimal(500) });
    for (const [code, msg] of [["OLD", /vencido/], ["OFF", /no está activo/], ["MIN", /compra mínima/]] as const) {
      await expect(createOrder({ ...orderInput(variant.id, 1), couponCode: code }, null)).rejects.toThrow(msg);
    }
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("cancelaciones y devolución de stock", () => {
  it("cancelar devuelve el stock UNA sola vez, aunque se cancele varias veces o a la vez", async () => {
    const { variant } = await mk({ stock: 10 });
    const { id } = await createOrder(orderInput(variant.id, 4), null);
    expect(await stockOf(variant.id)).toBe(6);
    const res = await Promise.allSettled([1, 2, 3].map(() => changeOrderStatus({ orderId: id, to: "CANCELADO", actorId: null })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(10); // no 14, no 18
    expect(await prisma.inventoryMovement.count({ where: { orderId: id, type: "DEVOLUCION" } })).toBe(1);
    await expect(changeOrderStatus({ orderId: id, to: "CANCELADO", actorId: null })).rejects.toThrow();
    // restoreOrderStock invocado directamente también es idempotente
    expect(await prisma.$transaction((tx) => restoreOrderStock(tx, id, null, "reintento"))).toBe(false);
    expect(await stockOf(variant.id)).toBe(10);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } })).soldCount).toBe(0);
  });

  it("cancelar libera el uso del cupón", async () => {
    const { variant } = await mk({ price: 100, stock: 5 });
    await prisma.coupon.create({ data: { code: "UNO", discountType: "FIXED", value: new Prisma.Decimal(5), usageLimit: 1 } });
    const { id } = await createOrder({ ...orderInput(variant.id, 1), couponCode: "UNO" }, null);
    await expect(createOrder({ ...orderInput(variant.id, 1), couponCode: "UNO" }, null)).rejects.toThrow(/límite/);
    await changeOrderStatus({ orderId: id, to: "CANCELADO", actorId: null });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "UNO" } })).usedCount).toBe(0);
    await expect(createOrder({ ...orderInput(variant.id, 1), couponCode: "UNO" }, null)).resolves.toBeTruthy();
  });

  it("el cliente no puede cancelar un pedido con pago aprobado ni cambiar a otros estados", async () => {
    const { variant } = await mk({ stock: 5 });
    const { id } = await createOrder(orderInput(variant.id, 1), null);
    await expect(changeOrderStatus({ orderId: id, to: "ENTREGADO", actorId: null, actorIsCustomer: true })).rejects.toThrow();
    await prisma.payment.update({ where: { orderId: id }, data: { status: "APROBADO" } });
    await expect(changeOrderStatus({ orderId: id, to: "CANCELADO", actorId: null, actorIsCustomer: true })).rejects.toThrow(/ya no puede cancelarse/);
    expect(await stockOf(variant.id)).toBe(4);
  });
});

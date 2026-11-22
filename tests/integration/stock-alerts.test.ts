import { beforeEach, describe, expect, it, vi } from "vitest";

// El correo se intercepta: se comprueba qué se enviaría sin enviar nada
const mail = vi.hoisted(() => ({ configured: true, sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mailer", () => ({
  mailerConfigured: () => mail.configured,
  sendMail: async (m: { to: string; subject: string; text: string }) => {
    mail.sent.push(m);
    return { ok: true as const };
  },
}));

import { applyStockDelta } from "@/lib/services/inventory";
import { getRestockDemand, processStockAlerts, subscribeStockAlert } from "@/lib/services/stock-alerts";
import { makeProduct, prisma, resetDb, seedBasics } from "../helpers";

let variantId: string;
let slug: string;

beforeEach(async () => {
  await resetDb();
  mail.configured = true;
  mail.sent = [];
  const b = await seedBasics();
  const { product, variant } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id, stock: 0 });
  variantId = variant.id;
  slug = product.slug;
});

const restock = (qty: number) => prisma.$transaction((tx) => applyStockDelta(tx, { variantId, delta: qty, type: "ENTRADA", reason: "test" }));

describe("avísame cuando haya stock", () => {
  it("exige correo o celular", async () => {
    await expect(subscribeStockAlert({ variantId })).rejects.toThrow(/correo o tu celular/);
  });

  it("no permite suscribirse si la variante ya tiene stock", async () => {
    await restock(3);
    await expect(subscribeStockAlert({ variantId, email: "a@b.com" })).rejects.toThrow(/ya tiene stock/);
  });

  it("es idempotente: el mismo correo no duplica la espera (ignora mayúsculas)", async () => {
    expect((await subscribeStockAlert({ variantId, email: "Ana@Example.com" })).created).toBe(true);
    expect((await subscribeStockAlert({ variantId, email: "ana@example.com" })).created).toBe(false);
    expect(await prisma.stockAlert.count({ where: { variantId } })).toBe(1);
  });

  it("al reponer, avisa por correo una sola vez y marca la espera como atendida", async () => {
    await subscribeStockAlert({ variantId, email: "ana@example.com" });
    expect(await processStockAlerts()).toEqual({ notified: 0, pending: 0 }); // sigue sin stock
    expect(mail.sent).toHaveLength(0);

    await restock(2);
    expect(await processStockAlerts()).toEqual({ notified: 1, pending: 0 });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("ana@example.com");
    expect(mail.sent[0].text).toContain(`/productos/${slug}`);

    await processStockAlerts(); // segunda pasada: nada que enviar
    expect(mail.sent).toHaveLength(1);
    expect((await prisma.stockAlert.findFirstOrThrow()).notifiedAt).not.toBeNull();
  });

  it("sin SMTP no simula el envío: la espera queda pendiente para avisar manualmente", async () => {
    mail.configured = false;
    await subscribeStockAlert({ variantId, email: "ana@example.com" });
    await restock(2);
    expect(await processStockAlerts()).toEqual({ notified: 0, pending: 1 });
    expect(mail.sent).toHaveLength(0);
    expect((await prisma.stockAlert.findFirstOrThrow()).notifiedAt).toBeNull();
  });

  it("quien ya fue avisado puede volver a pedir el aviso", async () => {
    await subscribeStockAlert({ variantId, email: "ana@example.com" });
    await restock(1);
    await processStockAlerts();
    await prisma.$transaction((tx) => applyStockDelta(tx, { variantId, delta: -1, type: "SALIDA", reason: "venta" })); // se vuelve a agotar
    await subscribeStockAlert({ variantId, email: "ana@example.com" });
    expect((await prisma.stockAlert.findFirstOrThrow()).notifiedAt).toBeNull();
    await restock(1);
    await processStockAlerts();
    expect(mail.sent).toHaveLength(2);
  });

  it("la demanda en espera ordena qué reponer primero", async () => {
    const b = await prisma.category.findFirstOrThrow();
    const size2 = await prisma.size.create({ data: { name: "XL-x", sortOrder: 9 } });
    const color = await prisma.color.findFirstOrThrow();
    const other = await prisma.productVariant.create({ data: { productId: (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).productId, sizeId: size2.id, colorId: color.id, sku: "OTRA-1", stock: 0, minStock: 1 } });
    void b;
    await subscribeStockAlert({ variantId, email: "a@x.com" });
    await subscribeStockAlert({ variantId: other.id, email: "b@x.com" });
    await subscribeStockAlert({ variantId: other.id, email: "c@x.com" });
    const demand = await getRestockDemand();
    expect(demand.map((d) => [d.variantId, d.waiting])).toEqual([[other.id, 2], [variantId, 1]]);
  });
});

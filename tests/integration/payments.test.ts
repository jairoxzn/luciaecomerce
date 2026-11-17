import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { rm } from "fs/promises";
import { changeOrderStatus, createOrder } from "@/lib/services/orders";
import { approvePayment, rejectPayment, submitPaymentProof } from "@/lib/services/payments";
import { makeProduct, orderInput, prisma, resetDb, seedBasics } from "../helpers";

let admin: { id: string };
let orderId: string;
let paymentId: string;
let variantId: string;

async function png() {
  const buf = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#e65385" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "comprobante.png", { type: "image/png" });
}

beforeEach(async () => {
  await resetDb();
  const b = await seedBasics();
  admin = await prisma.user.create({ data: { email: "admin@test.com", name: "Admin", passwordHash: "x", role: "ADMIN" } });
  const { variant } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id, stock: 5 });
  variantId = variant.id;
  const o = await createOrder(orderInput(variant.id, 1), null);
  orderId = o.id;
  paymentId = (await prisma.payment.findUniqueOrThrow({ where: { orderId } })).id;
});
afterAll(async () => {
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});

const st = async () => ({ order: (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, payment: await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }) });

describe("flujo de pago manual (Yape/Plin) con validación administrativa", () => {
  it("subir comprobante deja el pago EN_REVISION (nunca aprobado automáticamente)", async () => {
    await submitPaymentProof({ orderId, file: await png(), operationNumber: "123" });
    const s = await st();
    expect(s.order).toBe("PAGO_EN_REVISION");
    expect(s.payment.status).toBe("EN_REVISION");
    const proofs = await prisma.paymentProof.findMany({ where: { paymentId } });
    expect(proofs).toHaveLength(1);
    expect(proofs[0].fileKey).toMatch(/^proofs\/.+\.webp$/);
    expect(proofs[0].operationNumber).toBe("123");
  });

  it("no se puede aprobar un pago sin comprobante ni en estado PENDIENTE", async () => {
    await expect(approvePayment(paymentId, admin.id)).rejects.toThrow(/en revisión/);
    expect((await st()).payment.status).toBe("PENDIENTE");
  });

  it("aprobar → pedido PAGO_CONFIRMADO con responsable en el historial", async () => {
    await submitPaymentProof({ orderId, file: await png() });
    await approvePayment(paymentId, admin.id);
    const s = await st();
    expect(s.order).toBe("PAGO_CONFIRMADO");
    expect(s.payment).toMatchObject({ status: "APROBADO", reviewedById: admin.id });
    const h = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    expect(h.at(-1)).toMatchObject({ status: "PAGO_CONFIRMADO", changedById: admin.id });
  });

  it("un pago RECHAZADO nunca aparece como aprobado: exige motivo, no se puede aprobar y permite un nuevo comprobante", async () => {
    await submitPaymentProof({ orderId, file: await png() });
    await expect(rejectPayment(paymentId, admin.id, "  ")).rejects.toThrow(/motivo/);
    await rejectPayment(paymentId, admin.id, "El monto no coincide");
    let s = await st();
    expect(s.payment).toMatchObject({ status: "RECHAZADO", rejectionReason: "El monto no coincide" });
    expect(s.order).toBe("PENDIENTE");
    // no se puede aprobar un pago rechazado
    await expect(approvePayment(paymentId, admin.id)).rejects.toThrow(/en revisión/);
    // y el pedido no puede avanzar a preparación
    await expect(changeOrderStatus({ orderId, to: "PREPARANDO", actorId: admin.id })).rejects.toThrow(/pago debe estar aprobado/);
    // el cliente puede reenviar otro comprobante
    await submitPaymentProof({ orderId, file: await png() });
    s = await st();
    expect(s.payment).toMatchObject({ status: "EN_REVISION", rejectionReason: null });
    expect(await prisma.paymentProof.count({ where: { paymentId } })).toBe(2);
  });

  it("aprobación y rechazo simultáneos: solo uno prevalece", async () => {
    await submitPaymentProof({ orderId, file: await png() });
    const r = await Promise.allSettled([approvePayment(paymentId, admin.id), rejectPayment(paymentId, admin.id, "Motivo válido")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const s = await st();
    expect(["APROBADO", "RECHAZADO"]).toContain(s.payment.status);
  });

  it("no se aceptan comprobantes con formato falso o demasiado grandes", async () => {
    const fake = new File([new Uint8Array(200).fill(65)], "virus.png", { type: "image/png" });
    await expect(submitPaymentProof({ orderId, file: fake })).rejects.toThrow(/Formato no permitido/);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "grande.png", { type: "image/png" });
    await expect(submitPaymentProof({ orderId, file: big })).rejects.toThrow(/4 MB/);
    expect((await st()).payment.status).toBe("PENDIENTE");
    expect(await prisma.paymentProof.count()).toBe(0);
  });

  it("flujo completo hasta ENTREGADO y no se puede cancelar un pedido entregado", async () => {
    await submitPaymentProof({ orderId, file: await png() });
    await approvePayment(paymentId, admin.id);
    for (const to of ["PREPARANDO", "LISTO_PARA_ENTREGA", "EN_CAMINO", "ENTREGADO"] as const) await changeOrderStatus({ orderId, to, actorId: admin.id, note: to });
    expect((await st()).order).toBe("ENTREGADO");
    await expect(changeOrderStatus({ orderId, to: "CANCELADO", actorId: admin.id })).rejects.toThrow();
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(4);
    expect(await prisma.orderStatusHistory.count({ where: { orderId } })).toBe(7);
  });

  it("contra entrega avanza sin comprobante y el cobro se aprueba al entregar", async () => {
    const { variant } = await makeProduct({ categoryId: (await prisma.category.findFirstOrThrow()).id, sizeId: (await prisma.size.findFirstOrThrow()).id, colorId: (await prisma.color.findFirstOrThrow()).id, stock: 3 });
    const { id } = await createOrder({ ...orderInput(variant.id, 1), paymentMethod: "COD" }, null);
    await changeOrderStatus({ orderId: id, to: "PREPARANDO", actorId: admin.id });
    await changeOrderStatus({ orderId: id, to: "LISTO_PARA_ENTREGA", actorId: admin.id });
    await changeOrderStatus({ orderId: id, to: "ENTREGADO", actorId: admin.id });
    expect((await prisma.payment.findUniqueOrThrow({ where: { orderId: id } })).status).toBe("APROBADO");
  });
});

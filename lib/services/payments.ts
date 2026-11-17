import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/action";
import { notifyOrderEvent } from "@/lib/services/notifications";
import { saveProof, deleteByUrlOrKey } from "@/lib/storage";

/**
 * Registra un comprobante enviado por el cliente. El pago pasa a EN_REVISION y el pedido a
 * PAGO_EN_REVISION. Nunca se aprueba automáticamente: solo un administrador puede aprobar.
 */
export async function submitPaymentProof(opts: { orderId: string; file: File; operationNumber?: string | null }) {
  const order = await prisma.order.findUnique({ where: { id: opts.orderId }, include: { payment: true } });
  if (!order || !order.payment) throw new UserError("Pedido no encontrado.");
  const pay = order.payment;
  if (pay.method === "COD") throw new UserError("Los pedidos contra entrega no requieren comprobante.");
  if (order.status === "CANCELADO") throw new UserError("El pedido está cancelado.");
  if (!["PENDIENTE", "RECHAZADO"].includes(pay.status)) {
    throw new UserError(pay.status === "APROBADO" ? "El pago ya fue aprobado." : "Tu comprobante ya está en revisión.");
  }

  const saved = await saveProof(opts.file);
  try {
    await prisma.$transaction(async (tx) => {
      // Update condicional: evita que dos envíos simultáneos dupliquen el cambio de estado
      const upd = await tx.payment.updateMany({
        where: { id: pay.id, status: { in: ["PENDIENTE", "RECHAZADO"] } },
        data: { status: "EN_REVISION", rejectionReason: null, reviewedAt: null, reviewedById: null },
      });
      if (upd.count === 0) throw new UserError("Tu comprobante ya está en revisión.");
      await tx.paymentProof.create({
        data: { paymentId: pay.id, fileKey: saved.key, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes, operationNumber: opts.operationNumber || null },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "PAGO_EN_REVISION" } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: "PAGO_EN_REVISION", note: "Comprobante recibido" } });
    });
  } catch (e) {
    await deleteByUrlOrKey(saved.key); // no dejar archivos huérfanos
    throw e;
  }
  await notifyOrderEvent(order.id, "PAGO_RECIBIDO");
}

export async function approvePayment(paymentId: string, adminId: string, note?: string | null) {
  const pay = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true, proofs: { select: { id: true } } } });
  if (!pay) throw new UserError("Pago no encontrado.");
  if (pay.order.status === "CANCELADO") throw new UserError("El pedido está cancelado.");
  if (pay.status !== "EN_REVISION") throw new UserError("Solo se pueden aprobar pagos que estén en revisión.");
  if (!pay.proofs.length) throw new UserError("El pago no tiene comprobante adjunto.");

  await prisma.$transaction(async (tx) => {
    const upd = await tx.payment.updateMany({
      where: { id: paymentId, status: "EN_REVISION" },
      data: { status: "APROBADO", reviewedById: adminId, reviewedAt: new Date(), rejectionReason: null },
    });
    if (upd.count === 0) throw new UserError("El pago fue revisado por otra persona. Recarga la página.");
    await tx.order.update({ where: { id: pay.orderId }, data: { status: "PAGO_CONFIRMADO" } });
    await tx.orderStatusHistory.create({ data: { orderId: pay.orderId, status: "PAGO_CONFIRMADO", note: note || "Pago aprobado", changedById: adminId } });
  });
  await notifyOrderEvent(pay.orderId, "PAGO_APROBADO");
}

export async function rejectPayment(paymentId: string, adminId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 5) throw new UserError("Indica el motivo del rechazo (mínimo 5 caracteres).");
  const pay = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!pay) throw new UserError("Pago no encontrado.");
  if (pay.order.status === "CANCELADO") throw new UserError("El pedido está cancelado.");
  if (pay.status !== "EN_REVISION") throw new UserError("Solo se pueden rechazar pagos que estén en revisión.");

  await prisma.$transaction(async (tx) => {
    const upd = await tx.payment.updateMany({
      where: { id: paymentId, status: "EN_REVISION" },
      data: { status: "RECHAZADO", rejectionReason: text, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (upd.count === 0) throw new UserError("El pago fue revisado por otra persona. Recarga la página.");
    await tx.order.update({ where: { id: pay.orderId }, data: { status: "PENDIENTE" } });
    await tx.orderStatusHistory.create({ data: { orderId: pay.orderId, status: "PENDIENTE", note: `Pago rechazado: ${text}`, changedById: adminId } });
  });
  await notifyOrderEvent(pay.orderId, "PAGO_RECHAZADO", { reason: text });
}

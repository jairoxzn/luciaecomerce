"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { changeOrderStatus } from "@/lib/services/orders";
import { approvePayment, rejectPayment } from "@/lib/services/payments";
import { orderStatusSchema } from "@/lib/validations/admin";

function refresh(orderId?: string) {
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/dashboard");
  if (orderId) revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function updateOrderStatusAction(raw: import("zod").input<typeof orderStatusSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = orderStatusSchema.parse(raw);
    await changeOrderStatus({ orderId: i.orderId, to: i.status, note: i.note ?? null, actorId: admin.id });
    await logAudit(admin.id, "ORDER_STATUS", "Order", i.orderId, { to: i.status, note: i.note ?? null });
    if (i.status === "CANCELADO") refreshStore(); // el stock devuelto vuelve a estar disponible
    refresh(i.orderId);
    return { ok: true, message: "Estado actualizado." };
  });
}

export async function saveOrderNoteAction(orderId: string, note: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    if (note.length > 500) throw new UserError("La observación es demasiado larga (máx. 500).");
    await prisma.order.update({ where: { id: orderId }, data: { adminNote: note.trim() || null } });
    await logAudit(admin.id, "ORDER_NOTE", "Order", orderId);
    refresh(orderId);
    return { ok: true, message: "Observación guardada." };
  });
}

export async function approvePaymentAction(paymentId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await approvePayment(paymentId, admin.id);
    await logAudit(admin.id, "PAYMENT_APPROVE", "Payment", paymentId);
    refresh();
    return { ok: true, message: "Pago aprobado. El pedido pasó a «Pago confirmado»." };
  });
}

export async function rejectPaymentAction(paymentId: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await rejectPayment(paymentId, admin.id, reason);
    await logAudit(admin.id, "PAYMENT_REJECT", "Payment", paymentId, { reason });
    refresh();
    return { ok: true, message: "Pago rechazado. El cliente podrá enviar otro comprobante." };
  });
}

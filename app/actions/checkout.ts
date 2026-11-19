"use server";

import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth/session";
import { grantGuestAccess } from "@/lib/auth/order-access";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders";
import { refreshStock } from "@/lib/revalidate";
import { placeOrderSchema, type PlaceOrderFormInput } from "@/lib/validations/checkout";
import { emailField } from "@/lib/validations/common";

export async function placeOrderAction(raw: PlaceOrderFormInput): Promise<ActionResult<{ code: string }>> {
  return run<{ code: string }>(async () => {
    const user = await getCurrentUser();
    const ip = await clientIp();
    if (!(await rateLimit(`order:${user?.id ?? ip}`, 12, 3600))) {
      throw new UserError("Has realizado demasiados intentos. Inténtalo en unos minutos.");
    }
    const input = placeOrderSchema.parse(raw);
    const { code } = await createOrder(input, user?.id ?? null);
    if (!user) await grantGuestAccess(code);
    refreshStock(); // el stock bajó: las páginas de producto en caché deben reflejarlo
    return { ok: true, data: { code } };
  });
}

/** Seguimiento para invitados: código + correo del pedido. */
export async function lookupOrderAction(raw: { code: string; email: string }): Promise<ActionResult<{ code: string }>> {
  return run<{ code: string }>(async () => {
    const ip = await clientIp();
    if (!(await rateLimit(`lookup:${ip}`, 10, 900))) throw new UserError("Demasiados intentos. Espera unos minutos.");
    const code = raw.code.trim().toUpperCase();
    const email = emailField.parse(raw.email);
    const order = await prisma.order.findUnique({ where: { code }, select: { code: true, email: true, userId: true } });
    // Mismo mensaje exista o no el pedido
    if (!order || order.email !== email) throw new UserError("No encontramos un pedido con esos datos.");
    const user = await getCurrentUser();
    if (!order.userId) await grantGuestAccess(order.code);
    else if (user?.id !== order.userId) throw new UserError("Inicia sesión con la cuenta con la que realizaste el pedido.");
    return { ok: true, data: { code: order.code } };
  });
}

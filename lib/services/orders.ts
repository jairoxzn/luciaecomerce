import { randomBytes } from "crypto";
import { Prisma, type OrderStatus, type NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/action";
import { ORDER_STATUS_LABEL, ORDER_TRANSITIONS } from "@/lib/constants";
import { dec } from "@/lib/utils";
import { applyStockDelta } from "@/lib/services/inventory";
import { buildQuote } from "@/lib/services/cart";
import { enabledPaymentMethods, getSettings } from "@/lib/services/settings";
import { notifyLowStock, notifyOrderEvent } from "@/lib/services/notifications";
import type { PlaceOrderInput } from "@/lib/validations/checkout";

type Tx = Prisma.TransactionClient;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (0/O, 1/I)

export function generateOrderCode(now = new Date()) {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = Array.from(randomBytes(5), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `LJ-${ymd}-${rnd}`;
}

// ───────────────────────── Crear pedido ─────────────────────────

/**
 * Crea un pedido de forma transaccional:
 *  - recalcula precios, descuentos y envío en el servidor,
 *  - descuenta el stock con UPDATE condicional (sin sobreventa bajo concurrencia),
 *  - consume el cupón con límite atómico,
 *  - es idempotente por `idempotencyKey` (doble clic / reintentos no duplican el pedido).
 */
export async function createOrder(input: PlaceOrderInput, userId: string | null): Promise<{ code: string; id: string; duplicate: boolean }> {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, code: true } });
  if (existing) return { ...existing, duplicate: true };

  const settings = await getSettings();
  if (!enabledPaymentMethods(settings)[input.paymentMethod]) {
    throw new UserError("El método de pago seleccionado no está disponible.");
  }
  if (input.paymentMethod === "COD" && input.delivery.method === "PICKUP") {
    throw new UserError("El pago contra entrega solo está disponible para envíos a domicilio.");
  }

  const lowStockAlerts: { variantId: string; stockAfter: number }[] = [];

  let created: { id: string; code: string };
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const quote = await buildQuote(
          input.items,
          { couponCode: input.couponCode, delivery: { method: input.delivery.method, department: input.delivery.department } },
          tx,
        );
        // 1) Disponibilidad primero (mensajes más útiles), 2) cupón, 3) envío
        const bad = quote.lines.find((l) => l.issue);
        if (quote.lines.length !== input.items.length || bad) {
          const l = bad ?? quote.lines[0];
          throw new UserError(
            l?.issue === "REDUCED"
              ? `Solo quedan ${l.stock} unidades de "${l.name}" (${l.colorName}/${l.sizeName}). Actualiza tu carrito.`
              : `"${l?.name ?? "Un producto"}" ya no está disponible. Actualiza tu carrito.`,
          );
        }
        if (quote.couponError) throw new UserError(quote.couponError);
        if (quote.shippingError) throw new UserError(quote.shippingError);
        if (quote.shippingCents === null) throw new UserError("No se pudo calcular el envío.");

        // Consumo atómico del cupón (respeta el límite de usos aun con compras simultáneas)
        if (quote.couponId) {
          const n = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
             WHERE "id" = ${quote.couponId} AND "isActive" = true
               AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
          if (n === 0) throw new UserError("Este cupón alcanzó su límite de usos.");
        }

        let order: { id: string; code: string } | null = null;
        for (let attempt = 0; attempt < 5 && !order; attempt++) {
          const code = generateOrderCode();
          try {
            order = await tx.order.create({
              data: {
                code,
                idempotencyKey: input.idempotencyKey,
                userId,
                firstName: input.customer.firstName,
                lastName: input.customer.lastName,
                dni: input.customer.dni ?? null,
                phone: input.customer.phone,
                email: input.customer.email,
                deliveryMethod: input.delivery.method,
                department: input.delivery.method === "DELIVERY" ? input.delivery.department : null,
                province: input.delivery.method === "DELIVERY" ? input.delivery.province : null,
                district: input.delivery.method === "DELIVERY" ? input.delivery.district : null,
                addressLine: input.delivery.method === "DELIVERY" ? input.delivery.addressLine : null,
                reference: input.delivery.reference ?? null,
                subtotal: dec(quote.subtotalCents),
                discountTotal: dec(quote.discountCents),
                shippingTotal: dec(quote.shippingCents),
                total: dec(quote.totalCents),
                couponId: quote.couponId,
                couponCode: quote.couponCode,
                customerNote: input.customerNote ?? null,
                items: {
                  create: quote.lines.map((l) => ({
                    variantId: l.variantId,
                    productId: l.productId,
                    name: l.name,
                    sku: l.sku,
                    sizeName: l.sizeName,
                    colorName: l.colorName,
                    imageUrl: l.image,
                    unitPrice: dec(l.unitCents),
                    quantity: l.quantity,
                    lineTotal: dec(l.lineCents),
                  })),
                },
                payment: { create: { method: input.paymentMethod, amount: dec(quote.totalCents), status: "PENDIENTE" } },
                history: { create: { status: "PENDIENTE", note: "Pedido creado" } },
              },
              select: { id: true, code: true },
            });
          } catch (e) {
            // Colisión de código → reintenta. Colisión de idempotencyKey se propaga.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target).includes("code")) continue;
            throw e;
          }
        }
        if (!order) throw new UserError("No se pudo generar el código del pedido. Inténtalo nuevamente.");

        // Descuento de stock en orden estable (evita deadlocks entre pedidos simultáneos)
        const sorted = [...quote.lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
        for (const l of sorted) {
          const ch = await applyStockDelta(tx, {
            variantId: l.variantId,
            delta: -l.quantity,
            type: "VENTA",
            reason: `Pedido ${order.code}`,
            orderId: order.id,
            userId,
          });
          if (ch.crossedLow) lowStockAlerts.push({ variantId: l.variantId, stockAfter: ch.stockAfter });
          await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.quantity } } });
        }

        if (userId) await tx.cartItem.deleteMany({ where: { cart: { userId } } });
        return order;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (e) {
    // Carrera de doble envío: otra petición con la misma clave ya creó el pedido
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, code: true } });
      if (again) return { ...again, duplicate: true };
    }
    throw e;
  }

  await notifyOrderEvent(created.id, "NUEVO_PEDIDO");
  for (const a of lowStockAlerts) await notifyLowStock(a.variantId, a.stockAfter);
  return { ...created, duplicate: false };
}

// ───────────────────────── Cancelación / devolución de stock ─────────────────────────

/**
 * Devuelve el stock reservado por un pedido UNA sola vez.
 * La bandera `stockRestored` se activa con un UPDATE condicional: aunque se invoque dos veces
 * (doble clic, reintentos, cancelación concurrente) el stock se restituye una sola vez.
 */
export async function restoreOrderStock(tx: Tx, orderId: string, actorId: string | null, reason: string) {
  const claimed = await tx.order.updateMany({ where: { id: orderId, stockRestored: false }, data: { stockRestored: true } });
  if (claimed.count === 0) return false;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const sorted = [...order.items].filter((i) => i.variantId).sort((a, b) => a.variantId!.localeCompare(b.variantId!));
  for (const it of sorted) {
    await applyStockDelta(tx, { variantId: it.variantId!, delta: it.quantity, type: "DEVOLUCION", reason, orderId, userId: actorId });
    await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST("soldCount" - ${it.quantity}, 0) WHERE "id" = ${it.productId}`;
  }
  if (order.couponId) {
    await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${order.couponId}`;
  }
  return true;
}

// ───────────────────────── Cambio de estado ─────────────────────────

const STATUS_EVENT: Partial<Record<OrderStatus, NotificationType>> = {
  LISTO_PARA_ENTREGA: "PEDIDO_PREPARADO",
  EN_CAMINO: "PEDIDO_ENVIADO",
  ENTREGADO: "PEDIDO_ENTREGADO",
  CANCELADO: "PEDIDO_CANCELADO",
};

const NEEDS_APPROVED_PAYMENT: OrderStatus[] = ["PAGO_CONFIRMADO", "PREPARANDO", "LISTO_PARA_ENTREGA", "EN_CAMINO", "ENTREGADO"];

export function allowedNextStatuses(current: OrderStatus, payment: { method: string; status: string } | null): OrderStatus[] {
  return ORDER_TRANSITIONS[current].filter((to) => {
    if (to === "PAGO_EN_REVISION") return false; // lo dispara el comprobante del cliente
    if (to === "PAGO_CONFIRMADO") return false; // lo dispara la aprobación del pago
    if (NEEDS_APPROVED_PAYMENT.includes(to) && payment && payment.method !== "COD" && payment.status !== "APROBADO") return false;
    return true;
  });
}

export async function changeOrderStatus(opts: { orderId: string; to: OrderStatus; note?: string | null; actorId: string | null; actorIsCustomer?: boolean }) {
  const { orderId, to, actorId } = opts;
  const notifyType: NotificationType | undefined = STATUS_EVENT[to];

  await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (!order) throw new UserError("El pedido no existe.");
      if (order.status === to) throw new UserError("El pedido ya tiene ese estado.");
      if (!ORDER_TRANSITIONS[order.status].includes(to)) {
        throw new UserError(`No se puede pasar de "${ORDER_STATUS_LABEL[order.status]}" a "${ORDER_STATUS_LABEL[to]}".`);
      }
      if (opts.actorIsCustomer) {
        if (to !== "CANCELADO") throw new UserError("Operación no permitida.");
        if (!["PENDIENTE", "PAGO_EN_REVISION"].includes(order.status) || order.payment?.status === "APROBADO") {
          throw new UserError("Este pedido ya no puede cancelarse. Contáctanos para ayudarte.");
        }
      } else if (!allowedNextStatuses(order.status, order.payment).includes(to) && to !== "CANCELADO") {
        throw new UserError(
          NEEDS_APPROVED_PAYMENT.includes(to) ? "El pago debe estar aprobado antes de avanzar el pedido." : "Este cambio de estado se realiza desde la revisión de pagos.",
        );
      }

      // Update condicional: evita carreras entre dos cambios simultáneos
      const upd = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to } });
      if (upd.count === 0) throw new UserError("El pedido fue modificado por otra persona. Recarga la página.");

      await tx.orderStatusHistory.create({ data: { orderId, status: to, note: opts.note || null, changedById: actorId } });

      if (to === "CANCELADO") {
        await restoreOrderStock(tx, orderId, actorId, `Cancelación del pedido ${order.code}`);
      }
      // Contra entrega: al entregar, el cobro queda aprobado
      if (to === "ENTREGADO" && order.payment?.method === "COD" && order.payment.status !== "APROBADO") {
        await tx.payment.update({ where: { id: order.payment.id }, data: { status: "APROBADO", reviewedById: actorId, reviewedAt: new Date() } });
      }
    },
    { timeout: 20_000 },
  );

  if (notifyType) await notifyOrderEvent(orderId, notifyType, { reason: opts.note });
}

/** Cancelación por el propio cliente (solo antes de que el pago sea aprobado). */
export async function cancelOwnOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true } });
  if (!order) throw new UserError("Pedido no encontrado.");
  await changeOrderStatus({ orderId, to: "CANCELADO", note: "Cancelado por el cliente", actorId: userId, actorIsCustomer: true });
}

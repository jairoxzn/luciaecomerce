import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPEN, normalizePeruPhone, num } from "@/lib/utils";
import { getSettings } from "@/lib/services/settings";
import { sendWhatsAppText, whatsappEnvConfigured } from "@/lib/whatsapp";
import { mailerConfigured, sendMail } from "@/lib/mailer";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { absoluteUrl } from "@/lib/utils";

type Ctx = { reason?: string | null };

const ADMIN_EVENTS: NotificationType[] = ["NUEVO_PEDIDO", "PAGO_RECIBIDO"];
const CUSTOMER_EVENTS: NotificationType[] = [
  "NUEVO_PEDIDO", "PAGO_APROBADO", "PAGO_RECHAZADO", "PEDIDO_PREPARADO", "PEDIDO_ENVIADO", "PEDIDO_ENTREGADO", "PEDIDO_CANCELADO",
];

function customerMessage(type: NotificationType, code: string, store: string, ctx: Ctx) {
  switch (type) {
    case "NUEVO_PEDIDO": return { title: `Recibimos tu pedido ${code}`, body: `¡Gracias por tu compra en ${store}! Tu pedido ${code} fue registrado.` };
    case "PAGO_APROBADO": return { title: "Pago aprobado", body: `Confirmamos tu pago del pedido ${code}. Ya lo estamos preparando.` };
    case "PAGO_RECHAZADO": return { title: "Pago rechazado", body: `No pudimos validar tu pago del pedido ${code}.${ctx.reason ? ` Motivo: ${ctx.reason}.` : ""} Puedes enviar un nuevo comprobante desde tu pedido.` };
    case "PEDIDO_PREPARADO": return { title: "Pedido preparado", body: `Tu pedido ${code} está listo para entrega.` };
    case "PEDIDO_ENVIADO": return { title: "Pedido en camino", body: `Tu pedido ${code} ya salió a su destino.` };
    case "PEDIDO_ENTREGADO": return { title: "Pedido entregado", body: `Tu pedido ${code} fue entregado. ¡Gracias por elegirnos!` };
    case "PEDIDO_CANCELADO": return { title: "Pedido cancelado", body: `Tu pedido ${code} fue cancelado.${ctx.reason ? ` Motivo: ${ctx.reason}.` : ""}` };
    default: return { title: code, body: code };
  }
}

/**
 * Registra las notificaciones de un evento de pedido.
 *  - Panel del administrador (nuevo pedido / pago recibido).
 *  - Panel del cliente (si tiene cuenta).
 *  - WhatsApp: se envía solo si la integración está configurada; si no, queda registrada como NOT_CONFIGURED.
 * Nunca lanza: una falla de notificación no debe romper la operación del pedido.
 */
export async function notifyOrderEvent(orderId: string, type: NotificationType, ctx: Ctx = {}) {
  try {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, select: { id: true, code: true, userId: true, firstName: true, lastName: true, phone: true, total: true, payment: { select: { method: true } } } }),
      getSettings(),
    ]);
    if (!order) return;

    if (ADMIN_EVENTS.includes(type)) {
      const title = type === "NUEVO_PEDIDO" ? `Nuevo pedido ${order.code}` : `Comprobante recibido · ${order.code}`;
      const body =
        type === "NUEVO_PEDIDO"
          ? `${order.firstName} ${order.lastName} · ${formatPEN(num(order.total))}`
          : `${order.firstName} ${order.lastName} envió un comprobante de pago para revisión.`;
      await prisma.notification.create({ data: { type, channel: "PANEL", status: "SENT", title, body, forAdmin: true, orderId, sentAt: new Date() } });
      await emailAdmins(type, order, title);
    }

    if (CUSTOMER_EVENTS.includes(type)) {
      const msg = customerMessage(type, order.code, settings.storeName, ctx);
      if (order.userId) {
        await prisma.notification.create({
          data: { type, channel: "PANEL", status: "SENT", title: msg.title, body: msg.body, userId: order.userId, orderId, sentAt: new Date() },
        });
      }
      // WhatsApp: real o "no configurado" (jamás simulado)
      const enabled = settings.whatsappNotificationsEnabled && whatsappEnvConfigured();
      const phone = normalizePeruPhone(order.phone);
      let status: "SENT" | "FAILED" | "NOT_CONFIGURED" = "NOT_CONFIGURED";
      let error: string | null = "Integración de WhatsApp no configurada";
      if (enabled) {
        const r = await sendWhatsAppText(phone, `${msg.title}\n${msg.body}`);
        status = r.ok ? "SENT" : "FAILED";
        error = r.ok ? null : (r.error ?? "Error desconocido");
      }
      await prisma.notification.create({
        data: {
          type, channel: "WHATSAPP", status, title: msg.title, body: msg.body, orderId, userId: order.userId,
          recipientPhone: phone, error, sentAt: status === "SENT" ? new Date() : null,
        },
      });
    }
  } catch (e) {
    console.error("[notify] fallo al registrar notificación", e);
  }
}

/**
 * Correo inmediato a los administradores activos: un comprobante esperando revisión es lo que más retrasa una venta.
 * Sin SMTP no se envía (y no se simula): el aviso del panel y el contador en vivo siguen funcionando.
 */
async function emailAdmins(type: NotificationType, order: { code: string; id: string; firstName: string; lastName: string; total: Parameters<typeof num>[0]; payment: { method: keyof typeof PAYMENT_METHOD_LABEL } | null }, title: string) {
  if (!mailerConfigured()) return;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } });
  if (admins.length === 0) return;
  const amount = formatPEN(num(order.total));
  const method = order.payment ? PAYMENT_METHOD_LABEL[order.payment.method] : "—";
  const link = absoluteUrl(type === "PAGO_RECIBIDO" ? "/admin/pagos" : `/admin/pedidos/${order.id}`);
  const who = `${order.firstName} ${order.lastName}`;
  const lead = type === "PAGO_RECIBIDO" ? "Un cliente envió su comprobante y está esperando que lo revises." : "Entró un pedido nuevo.";
  await Promise.all(
    admins.map((a) =>
      sendMail({
        to: a.email,
        subject: `${type === "PAGO_RECIBIDO" ? "💳 " : "🛍️ "}${title} · ${amount}`,
        text: `${lead}

Pedido: ${order.code}
Cliente: ${who}
Método: ${method}
Monto: ${amount}

Revisar: ${link}`,
        html: `<p>${lead}</p><p><strong>${order.code}</strong> · ${who}<br>${method} · <strong>${amount}</strong></p><p><a href="${link}" style="background:#e65385;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${type === "PAGO_RECIBIDO" ? "Revisar comprobante" : "Ver pedido"}</a></p>`,
      }),
    ),
  );
}

export async function notifyLowStock(variantId: string, stockAfter: number) {
  try {
    const v = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: { select: { name: true } }, size: true, color: true } });
    if (!v) return;
    await prisma.notification.create({
      data: {
        type: "STOCK_BAJO", channel: "PANEL", status: "SENT", forAdmin: true, sentAt: new Date(),
        title: stockAfter <= 0 ? `Agotado: ${v.product.name}` : `Stock bajo: ${v.product.name}`,
        body: `${v.color.name} / ${v.size.name} — quedan ${stockAfter} unidades (mínimo ${v.minStock}).`,
      },
    });
  } catch (e) {
    console.error("[notify] stock bajo", e);
  }
}

import "server-only";
import { prisma } from "@/lib/prisma";

export type AdminBadges = { orders: number; payments: number; messages: number };
export type AdminNotification = { id: string; title: string; body: string; createdAt: string; read: boolean; orderCode: string | null };
export type AdminAlerts = { badges: AdminBadges; notifications: AdminNotification[] };

/**
 * Contadores del menú y últimos avisos del administrador. Lo usan el layout del panel (carga inicial) y
 * `/api/admin/alerts` (consulta periódica para avisar al instante de comprobantes y pedidos nuevos).
 */
export async function getAdminAlerts(): Promise<AdminAlerts> {
  const [orders, payments, messages, notifs] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["PENDIENTE", "PAGO_EN_REVISION"] } } }),
    prisma.payment.count({ where: { status: "EN_REVISION" } }),
    prisma.contactMessage.count({ where: { readAt: null } }),
    prisma.notification.findMany({ where: { forAdmin: true }, orderBy: { createdAt: "desc" }, take: 8, include: { order: { select: { code: true } } } }),
  ]);
  return {
    badges: { orders, payments, messages },
    notifications: notifs.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString(), read: !!n.readAt, orderCode: n.order?.code ?? null })),
  };
}

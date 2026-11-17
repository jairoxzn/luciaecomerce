import { getAccessibleOrderId } from "@/lib/auth/order-access";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { getOrderView } from "@/lib/services/order-queries";
import { buildPaymentOptions } from "@/lib/services/checkout-config";

/** Datos para las páginas de pedido del cliente (null si no existe o no tiene acceso). */
export async function loadOrderPage(code: string) {
  const id = await getAccessibleOrderId(code.toUpperCase());
  if (!id) return null;
  const [order, settings, user] = await Promise.all([getOrderView(id), getSettings(), getCurrentUser()]);
  if (!order) return null;
  const paymentOption = buildPaymentOptions(settings).find((p) => p.method === order.payment?.method);
  const canCancel = !!user && order.customer.userId === user.id && ["PENDIENTE", "PAGO_EN_REVISION"].includes(order.status) && order.payment?.status !== "APROBADO";
  return { order, paymentOption, instructions: settings.paymentInstructions, canCancel, settings };
}

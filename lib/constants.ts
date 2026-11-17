import type { OrderStatus, PaymentMethod, PaymentStatus, DeliveryMethod } from "@prisma/client";

export const PERU_DEPARTMENTS = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco",
  "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto",
  "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
] as const;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDIENTE: "Pendiente",
  PAGO_EN_REVISION: "Pago en revisión",
  PAGO_CONFIRMADO: "Pago confirmado",
  PREPARANDO: "Preparando",
  LISTO_PARA_ENTREGA: "Listo para entrega",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "PENDIENTE", "PAGO_EN_REVISION", "PAGO_CONFIRMADO", "PREPARANDO", "LISTO_PARA_ENTREGA", "EN_CAMINO", "ENTREGADO", "CANCELADO",
];

/** Estados que cuentan como venta (pago confirmado o posterior, sin cancelar) */
export const PAID_STATUSES: OrderStatus[] = ["PAGO_CONFIRMADO", "PREPARANDO", "LISTO_PARA_ENTREGA", "EN_CAMINO", "ENTREGADO"];

/** Transiciones válidas del flujo de pedidos (validadas en servidor) */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDIENTE: ["PAGO_EN_REVISION", "PAGO_CONFIRMADO", "PREPARANDO", "CANCELADO"],
  PAGO_EN_REVISION: ["PENDIENTE", "PAGO_CONFIRMADO", "CANCELADO"],
  PAGO_CONFIRMADO: ["PREPARANDO", "CANCELADO"],
  PREPARANDO: ["LISTO_PARA_ENTREGA", "CANCELADO"],
  LISTO_PARA_ENTREGA: ["EN_CAMINO", "ENTREGADO", "CANCELADO"],
  EN_CAMINO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFER: "Transferencia bancaria",
  COD: "Contra entrega",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  DELIVERY: "Envío a domicilio",
  PICKUP: "Recojo en tienda",
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700 ring-amber-200",
  PAGO_EN_REVISION: "bg-sky-50 text-sky-700 ring-sky-200",
  PAGO_CONFIRMADO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PREPARANDO: "bg-violet-50 text-violet-700 ring-violet-200",
  LISTO_PARA_ENTREGA: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  EN_CAMINO: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  ENTREGADO: "bg-green-50 text-green-700 ring-green-200",
  CANCELADO: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700 ring-amber-200",
  EN_REVISION: "bg-sky-50 text-sky-700 ring-sky-200",
  APROBADO: "bg-green-50 text-green-700 ring-green-200",
  RECHAZADO: "bg-red-50 text-red-700 ring-red-200",
};

export const SESSION_COOKIE = "lj_session";
export const SESSION_DAYS = 30;
export const MAX_CART_QTY = 10;

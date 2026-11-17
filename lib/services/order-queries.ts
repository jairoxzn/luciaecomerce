import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import type { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

export type OrderView = {
  id: string;
  code: string;
  status: OrderStatus;
  createdAt: string;
  customer: { firstName: string; lastName: string; dni: string | null; phone: string; email: string; userId: string | null };
  deliveryMethod: DeliveryMethod;
  address: { department: string | null; province: string | null; district: string | null; line: string | null; reference: string | null };
  items: { id: string; productId: string; name: string; sku: string; sizeName: string; colorName: string; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  customerNote: string | null;
  adminNote: string | null;
  payment: {
    id: string;
    method: PaymentMethod;
    status: PaymentStatus;
    rejectionReason: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    proofs: { id: string; createdAt: string; mimeType: string; operationNumber: string | null }[];
  } | null;
  history: { id: string; status: OrderStatus; note: string | null; createdAt: string; by: string | null }[];
};

export async function getOrderView(orderId: string): Promise<OrderView | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: { include: { proofs: { orderBy: { createdAt: "desc" } } } },
      history: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true, role: true } } } },
    },
  });
  if (!o) return null;
  const reviewer = o.payment?.reviewedById ? await prisma.user.findUnique({ where: { id: o.payment.reviewedById }, select: { name: true } }) : null;
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    customer: { firstName: o.firstName, lastName: o.lastName, dni: o.dni, phone: o.phone, email: o.email, userId: o.userId },
    deliveryMethod: o.deliveryMethod,
    address: { department: o.department, province: o.province, district: o.district, line: o.addressLine, reference: o.reference },
    items: o.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, sku: i.sku, sizeName: i.sizeName, colorName: i.colorName, imageUrl: i.imageUrl, unitPrice: num(i.unitPrice), quantity: i.quantity, lineTotal: num(i.lineTotal) })),
    subtotal: num(o.subtotal),
    discountTotal: num(o.discountTotal),
    shippingTotal: num(o.shippingTotal),
    total: num(o.total),
    couponCode: o.couponCode,
    customerNote: o.customerNote,
    adminNote: o.adminNote,
    payment: o.payment && {
      id: o.payment.id,
      method: o.payment.method,
      status: o.payment.status,
      rejectionReason: o.payment.rejectionReason,
      reviewedAt: o.payment.reviewedAt?.toISOString() ?? null,
      reviewedBy: reviewer?.name ?? null,
      proofs: o.payment.proofs.map((p) => ({ id: p.id, createdAt: p.createdAt.toISOString(), mimeType: p.mimeType, operationNumber: p.operationNumber })),
    },
    history: o.history.map((h) => ({ id: h.id, status: h.status, note: h.note, createdAt: h.createdAt.toISOString(), by: h.changedBy ? (h.changedBy.role === "ADMIN" ? `${h.changedBy.name} (admin)` : h.changedBy.name) : null })),
  };
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOrderView } from "@/lib/services/order-queries";
import { allowedNextStatuses } from "@/lib/services/orders";
import { DELIVERY_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatPEN, normalizePeruPhone } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { PaymentReviewActions, ProofGallery } from "@/components/admin/orders/payment-review";
import { AdminNote, StatusForm } from "@/components/admin/orders/status-form";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Detalle de pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // El pedido, sus notificaciones y el cliente se piden a la vez (las dos últimas solo dependen del id de la URL)
  const [order, notifs, raw] = await Promise.all([
    getOrderView(id),
    prisma.notification.findMany({ where: { orderId: id, channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.order.findUnique({ where: { id }, select: { userId: true, user: { select: { id: true, name: true } } } }),
  ]);
  if (!order) notFound();
  const pay = order.payment;
  const allowed = allowedNextStatuses(order.status, pay);
  const wa = `https://wa.me/${normalizePeruPhone(order.customer.phone)}?text=${encodeURIComponent(`Hola ${order.customer.firstName}, te escribimos por tu pedido ${order.code} (estado: ${ORDER_STATUS_LABEL[order.status]}).`)}`;

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm text-stone hover:text-brand">← Pedidos</Link>
      <PageHeader
        title={`Pedido ${order.code}`}
        description={`Realizado el ${formatDate(order.createdAt, true)}`}
        actions={<><OrderStatusBadge status={order.status} /><a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "sm")}><MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp al cliente</a></>}
      />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={`Productos (${order.items.length})`} padded={false}>
            <ul className="divide-y divide-neutral-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-mist">{i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <div className="min-w-0 flex-1 text-sm"><p className="font-semibold">{i.name}</p><p className="text-stone">{i.colorName} · Talla {i.sizeName} · <span className="font-mono text-xs">{i.sku}</span></p></div>
                  <p className="text-sm text-stone">{i.quantity} × {formatPEN(i.unitPrice)}</p>
                  <p className="w-24 text-right font-bold">{formatPEN(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatPEN(order.subtotal)}</dd></div>
              {order.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Descuento {order.couponCode ? `(${order.couponCode})` : ""}</dt><dd>-{formatPEN(order.discountTotal)}</dd></div>}
              <div className="flex justify-between"><dt className="text-stone">Envío</dt><dd>{formatPEN(order.shippingTotal)}</dd></div>
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-extrabold"><dt>Total</dt><dd className="text-brand">{formatPEN(order.total)}</dd></div>
            </dl>
          </Card>

          {pay && (
            <Card title={`Pago · ${PAYMENT_METHOD_LABEL[pay.method]}`} action={<PaymentStatusBadge status={pay.status} />}>
              <div className="space-y-4">
                {pay.status === "RECHAZADO" && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Rechazado:</strong> {pay.rejectionReason}{pay.reviewedBy ? ` — ${pay.reviewedBy}` : ""}</p>}
                {pay.status === "APROBADO" && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">Aprobado {pay.reviewedAt ? `el ${formatDate(pay.reviewedAt, true)}` : ""}{pay.reviewedBy ? ` por ${pay.reviewedBy}` : pay.method === "COD" ? " (cobro contra entrega)" : ""}.</p>}
                {pay.method !== "COD" && <ProofGallery proofs={pay.proofs} />}
                {pay.method === "COD" && <p className="text-sm text-stone">Pago contra entrega: se marca como aprobado al pasar el pedido a «Entregado».</p>}
                {pay.status === "EN_REVISION" && order.status !== "CANCELADO" && <PaymentReviewActions paymentId={pay.id} orderCode={order.code} />}
              </div>
            </Card>
          )}

          <Card title="Historial de estados"><OrderTimeline history={order.history} showActor /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Actualizar estado"><StatusForm orderId={order.id} allowed={allowed} /></Card>
          <Card title="Cliente">
            <p className="font-semibold">{order.customer.firstName} {order.customer.lastName} {raw?.user ? <Badge className="ml-1 bg-brand-tint text-brand ring-brand-soft">Con cuenta</Badge> : <Badge className="ml-1 bg-neutral-100 text-neutral-600 ring-neutral-200">Invitado</Badge>}</p>
            <p className="text-sm text-stone">{order.customer.email}</p>
            <p className="text-sm text-stone">{order.customer.phone}{order.customer.dni ? ` · DNI ${order.customer.dni}` : ""}</p>
            {raw?.user && <Link href={`/admin/clientes/${raw.user.id}`} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Ver ficha del cliente →</Link>}
          </Card>
          <Card title="Entrega">
            <p className="font-semibold">{DELIVERY_LABEL[order.deliveryMethod]}</p>
            {order.deliveryMethod === "DELIVERY" ? <p className="text-sm text-stone">{order.address.line}, {order.address.district}, {order.address.province}, {order.address.department}{order.address.reference ? ` — Ref.: ${order.address.reference}` : ""}</p> : <p className="text-sm text-stone">El cliente recogerá en tienda.</p>}
            {order.customerNote && <p className="mt-3 rounded-xl bg-mist px-3 py-2 text-sm"><strong>Nota del cliente:</strong> {order.customerNote}</p>}
          </Card>
          <Card title="Notas internas"><AdminNote orderId={order.id} initial={order.adminNote ?? ""} /></Card>
          <Card title="Avisos por WhatsApp" padded={false}>
            {notifs.length === 0 ? <p className="p-5 text-sm text-stone">Sin avisos registrados.</p> : (
              <ul className="divide-y divide-neutral-100">
                {notifs.map((n) => (
                  <li key={n.id} className="px-5 py-3 text-sm">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-stone">{formatDate(n.createdAt, true)} · {n.status === "SENT" ? "Enviado" : n.status === "FAILED" ? `Falló: ${n.error}` : "No enviado (integración no configurada)"}</p>
                    {n.status !== "SENT" && n.recipientPhone && <a className="text-xs font-semibold text-brand hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${n.recipientPhone}?text=${encodeURIComponent(`${n.title}\n${n.body}`)}`}>Enviar manualmente →</a>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

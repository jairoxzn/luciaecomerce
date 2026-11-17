import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { DELIVERY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatPEN } from "@/lib/utils";
import type { OrderView } from "@/lib/services/order-queries";
import type { PaymentOption } from "@/components/checkout/types";
import { PaymentDetails } from "@/components/checkout/payment-details";
import { OrderStatusBadge, PaymentStatusBadge } from "./status-badges";
import { OrderTimeline } from "./order-timeline";
import { ProofUploader } from "./proof-uploader";
import { CancelOrderButton } from "./cancel-order-button";

/** Vista de un pedido para el cliente (confirmación y seguimiento). */
export function OrderViewPanel({ order, paymentOption, instructions, canCancel }: { order: OrderView; paymentOption?: PaymentOption; instructions?: string | null; canCancel?: boolean }) {
  const pay = order.payment;
  const needsProof = pay && pay.method !== "COD" && ["PENDIENTE", "RECHAZADO"].includes(pay.status) && order.status !== "CANCELADO";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* Pago */}
        {pay && order.status !== "CANCELADO" && (
          <section className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Pago · {PAYMENT_METHOD_LABEL[pay.method]}</h2>
              <PaymentStatusBadge status={pay.status} />
            </div>
            {pay.status === "RECHAZADO" && (
              <div role="alert" className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div><p className="font-semibold">Tu comprobante fue rechazado</p><p>{pay.rejectionReason}</p><p className="mt-1 text-xs">Puedes enviar un nuevo comprobante.</p></div>
              </div>
            )}
            {pay.status === "EN_REVISION" && <p className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-800"><Clock className="mt-0.5 h-5 w-5 shrink-0" /> Recibimos tu comprobante. Lo estamos revisando; te avisaremos cuando el pago sea confirmado.</p>}
            {pay.status === "APROBADO" && <p className="flex gap-3 rounded-2xl bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> Pago confirmado. ¡Gracias!</p>}
            {pay.method === "COD" && pay.status !== "APROBADO" && paymentOption && <PaymentDetails option={paymentOption} />}
            {needsProof && paymentOption && <PaymentDetails option={paymentOption} instructions={instructions} amount={formatPEN(order.total)} />}
            {needsProof && <ProofUploader code={order.code} rejected={pay.status === "RECHAZADO"} />}
            {pay.proofs.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {pay.proofs.map((p) => (
                  <li key={p.id}><a href={`/api/proofs/${p.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand hover:underline"><FileText className="h-4 w-4" /> Comprobante del {formatDate(p.createdAt, true)}{p.operationNumber ? ` · Op. ${p.operationNumber}` : ""}</a></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Productos */}
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Productos</h2>
          <ul className="divide-y divide-neutral-100">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <span className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-tint/50">{i.imageUrl && <Image src={i.imageUrl} alt={i.name} fill sizes="80px" className="object-cover" />}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-stone">{i.colorName} · Talla {i.sizeName}</p>
                  <p className="text-stone">{i.quantity} × {formatPEN(i.unitPrice)}</p>
                </div>
                <p className="text-sm font-bold">{formatPEN(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-neutral-100 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatPEN(order.subtotal)}</dd></div>
            {order.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Descuento {order.couponCode ? `(${order.couponCode})` : ""}</dt><dd>-{formatPEN(order.discountTotal)}</dd></div>}
            <div className="flex justify-between"><dt className="text-stone">Envío</dt><dd>{order.shippingTotal === 0 ? "Gratis" : formatPEN(order.shippingTotal)}</dd></div>
            <div className="flex justify-between border-t border-neutral-100 pt-3 text-base font-bold"><dt>Total</dt><dd className="text-brand">{formatPEN(order.total)}</dd></div>
          </dl>
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-28">
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Seguimiento</h2><OrderStatusBadge status={order.status} /></div>
          <OrderTimeline history={order.history} />
          {canCancel && <div className="mt-5 border-t border-neutral-100 pt-4"><CancelOrderButton orderId={order.id} /></div>}
        </section>
        <section className="space-y-1 rounded-3xl border border-neutral-100 bg-white p-5 text-sm shadow-card sm:p-6">
          <h2 className="mb-2 text-lg font-bold">Entrega</h2>
          <p className="font-medium">{DELIVERY_LABEL[order.deliveryMethod]}</p>
          {order.deliveryMethod === "DELIVERY" && <p className="text-stone">{order.address.line}, {order.address.district}, {order.address.province}, {order.address.department}{order.address.reference ? ` (${order.address.reference})` : ""}</p>}
          <p className="pt-2 text-stone">{order.customer.firstName} {order.customer.lastName} · {order.customer.phone}</p>
          <p className="text-xs text-stone">Pedido realizado el {formatDate(order.createdAt, true)}</p>
          <Link href="/contacto" className="inline-block pt-3 text-sm font-medium text-brand hover:underline">¿Necesitas ayuda con tu pedido?</Link>
        </section>
      </aside>
    </div>
  );
}

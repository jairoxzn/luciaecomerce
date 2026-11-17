import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { loadOrderPage } from "@/lib/services/order-page";
import { OrderViewPanel } from "@/components/orders/order-view";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "¡Pedido confirmado!", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadOrderPage(code);
  if (!data) notFound();
  const { order } = data;
  const manual = order.payment && order.payment.method !== "COD";
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8 flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-tint to-white px-6 py-10 text-center shadow-card">
        <span className="flex h-16 w-16 animate-[pop_0.4s_ease-out] items-center justify-center rounded-full bg-brand text-white shadow-soft"><CheckCircle2 className="h-8 w-8" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight">¡Gracias por tu compra, {order.customer.firstName}!</h1>
        <p className="text-stone">Tu código de pedido es</p>
        <p className="rounded-full bg-white px-6 py-2 text-2xl font-extrabold tracking-wider text-brand shadow-card">{order.code}</p>
        <p className="max-w-lg text-sm text-stone">
          {manual ? "Realiza el pago y sube tu comprobante más abajo para que podamos validarlo. " : "Te contactaremos para coordinar la entrega. "}
          Puedes seguir el estado de tu pedido desde esta página en cualquier momento.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <LinkButton href={`/pedidos/${order.code}`} variant="outline">Ver seguimiento</LinkButton>
          <LinkButton href="/catalogo" variant="soft">Seguir comprando</LinkButton>
        </div>
        <p className="text-xs text-stone">¿Eres invitado? Guarda tu código; con él y tu correo puedes consultar el estado en <Link href="/pedidos/seguimiento" className="underline">Seguimiento de pedido</Link>.</p>
      </div>
      <OrderViewPanel order={order} paymentOption={data.paymentOption} instructions={data.instructions} canCancel={data.canCancel} />
    </div>
  );
}

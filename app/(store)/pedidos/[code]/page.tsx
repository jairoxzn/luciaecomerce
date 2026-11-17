import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOrderPage } from "@/lib/services/order-page";
import { OrderViewPanel } from "@/components/orders/order-view";

export const metadata: Metadata = { title: "Seguimiento de pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadOrderPage(code);
  if (!data) notFound();
  return (
    <div className="container-page py-8 sm:py-12">
      <Link href="/mi-cuenta/pedidos" className="text-sm text-stone hover:text-brand">← Mis pedidos</Link>
      <h1 className="mb-8 mt-2 text-3xl font-extrabold tracking-tight">Pedido <span className="text-brand">{data.order.code}</span></h1>
      <OrderViewPanel order={data.order} paymentOption={data.paymentOption} instructions={data.instructions} canCancel={data.canCancel} />
    </div>
  );
}

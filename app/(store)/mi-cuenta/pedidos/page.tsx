import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { formatDate, formatPEN, num } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/orders/status-badges";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const user = await requireUser("/mi-cuenta/pedidos");
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: { take: 4, select: { imageUrl: true, name: true } }, _count: { select: { items: true } } },
  });

  if (orders.length === 0) {
    return <EmptyState icon={Package} title="Aún no tienes pedidos" description="Cuando compres, verás aquí el estado de cada pedido." action={<LinkButton href="/catalogo">Empezar a comprar</LinkButton>} />;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Mis pedidos</h2>
      {orders.map((o) => (
        <article key={o.id} className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">Pedido {o.code}</p>
              <p className="text-xs text-stone">Realizado el {formatDate(o.createdAt)}</p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex -space-x-3">
              {o.items.map((i, idx) => (
                <span key={idx} className="relative h-14 w-12 overflow-hidden rounded-lg border-2 border-white bg-brand-tint/50">{i.imageUrl && <Image src={i.imageUrl} alt={i.name} fill sizes="48px" className="object-cover" />}</span>
              ))}
              {o._count.items > 4 && <span className="flex h-14 w-12 items-center justify-center rounded-lg border-2 border-white bg-mist text-xs font-semibold">+{o._count.items - 4}</span>}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-brand">{formatPEN(num(o.total))}</p>
              <Link href={`/pedidos/${o.code}`} className="text-sm font-semibold text-brand hover:underline">Ver detalle →</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

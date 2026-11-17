import Link from "next/link";
import type { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuery } from "@/lib/catalog-params";
import { DELIVERY_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatPEN, num, parseLimaDate } from "@/lib/utils";
import { Card, FilterTabs, PageHeader, SearchForm, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badges";

export const metadata = { title: "Pedidos" };
const PAGE = 20;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const estado = one(sp.estado) ?? "TODOS";
  const q = one(sp.q)?.trim();
  const desde = one(sp.desde);
  const hasta = one(sp.hasta);
  const metodo = one(sp.metodo) as PaymentMethod | undefined;
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const valid = ORDER_STATUS_ORDER.includes(estado as OrderStatus);

  const where: Prisma.OrderWhereInput = {
    ...(valid ? { status: estado as OrderStatus } : {}),
    ...(metodo && metodo in PAYMENT_METHOD_LABEL ? { payment: { method: metodo } } : {}),
    ...(desde || hasta ? { createdAt: { ...(desde ? { gte: parseLimaDate(desde) } : {}), ...(hasta ? { lte: parseLimaDate(hasta, true) } : {}) } } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
  };

  const [total, orders, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { payment: { select: { method: true, status: true } }, _count: { select: { items: true } } } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const all = counts.reduce((s, c) => s + c._count._all, 0);
  const cnt = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tabs = [{ value: "TODOS", label: "Todos", count: all }, ...ORDER_STATUS_ORDER.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s], count: cnt(s) }))];

  return (
    <>
      <PageHeader title="Pedidos" description="Gestiona el ciclo completo de cada pedido." />
      <FilterTabs current={valid ? estado : "TODOS"} tabs={tabs} hrefFor={(v) => `/admin/pedidos${buildQuery(sp, { estado: v === "TODOS" ? undefined : v, pagina: undefined })}`} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 p-4">
          <SearchForm placeholder="Código, cliente, correo o teléfono…" defaultValue={q} hidden={{ estado: valid ? estado : undefined, desde, hasta, metodo }} />
          <form className="flex flex-wrap items-center gap-2 text-sm">
            {q && <input type="hidden" name="q" value={q} />}
            {valid && <input type="hidden" name="estado" value={estado} />}
            <label className="flex items-center gap-1.5 text-stone">Desde <input type="date" name="desde" defaultValue={desde} className="h-10 rounded-full border border-neutral-200 px-3" /></label>
            <label className="flex items-center gap-1.5 text-stone">Hasta <input type="date" name="hasta" defaultValue={hasta} className="h-10 rounded-full border border-neutral-200 px-3" /></label>
            <select name="metodo" defaultValue={metodo ?? ""} aria-label="Método de pago" className="h-10 rounded-full border border-neutral-200 bg-white px-4"><option value="">Todos los pagos</option>{Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button className="h-10 rounded-full border border-neutral-200 px-4 font-medium hover:border-brand hover:text-brand">Filtrar</button>
          </form>
        </div>
        <Table>
          <thead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Fecha</Th><Th>Total</Th><Th>Pago</Th><Th>Entrega</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {orders.length === 0 && <TableEmpty cols={7} text="No hay pedidos con esos filtros." />}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-brand-tint/20">
                <Td><Link href={`/admin/pedidos/${o.id}`} className="font-bold text-brand hover:underline">{o.code}</Link><p className="text-xs text-stone">{o._count.items} ítems</p></Td>
                <Td><p className="font-medium">{o.firstName} {o.lastName}</p><p className="text-xs text-stone">{o.phone}</p></Td>
                <Td className="whitespace-nowrap text-stone">{formatDate(o.createdAt, true)}</Td>
                <Td className="font-bold">{formatPEN(num(o.total))}</Td>
                <Td>{o.payment && <div className="space-y-1"><p className="text-xs font-medium">{PAYMENT_METHOD_LABEL[o.payment.method]}</p><PaymentStatusBadge status={o.payment.status} /></div>}</Td>
                <Td className="text-stone">{DELIVERY_LABEL[o.deliveryMethod]}</Td>
                <Td><OrderStatusBadge status={o.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(p) => `/admin/pedidos${buildQuery(sp, { pagina: p > 1 ? String(p) : undefined })}`} />
    </>
  );
}

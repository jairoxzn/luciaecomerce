import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, Clock, DollarSign, Shirt, TrendingUp, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dashboardData } from "@/lib/services/reports";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatPEN } from "@/lib/utils";
import { Card, PageHeader, StatCard, Table, Td, Th, TableEmpty } from "@/components/admin/ui";
import { DonutChart, MonthlyBarChart, SalesAreaChart, TopProductsChart } from "@/components/admin/charts";
import { OrderStatusBadge } from "@/components/orders/status-badges";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [d, demoCount] = await Promise.all([dashboardData(), prisma.product.count({ where: { isDemo: true, status: { not: "ARCHIVED" } } })]);
  const k = d.kpis;
  return (
    <>
      <PageHeader title="Dashboard" description="Resumen de la operación en tiempo real." />

      {demoCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p><strong>Tienes {demoCount} productos de demostración</strong> (SKU “DEMO-…”). Reemplázalos por tus productos reales cuando estés lista.</p>
          <Link href="/admin/productos?demo=1" className="font-semibold underline">Ver productos demo</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas del día" value={formatPEN(k.salesToday)} hint={`${k.ordersToday} pedidos pagados`} Icon={DollarSign} />
        <StatCard label="Ventas del mes" value={formatPEN(k.salesMonth)} hint={`${k.ordersMonth} pedidos pagados`} Icon={TrendingUp} tone="green" />
        <StatCard label="Ingresos totales" value={formatPEN(k.revenue)} hint="Pedidos con pago confirmado" Icon={Wallet} tone="violet" />
        <StatCard label="Pedidos pendientes" value={String(k.pending)} hint="Por pagar o en revisión" Icon={Clock} tone="amber" href="/admin/pedidos?estado=PENDIENTE" />
        <StatCard label="Pedidos entregados" value={String(k.delivered)} Icon={CheckCircle2} tone="green" href="/admin/pedidos?estado=ENTREGADO" />
        <StatCard label="Clientes registrados" value={String(k.customers)} Icon={Users} tone="sky" href="/admin/clientes" />
        <StatCard label="Productos activos" value={String(k.activeProducts)} Icon={Shirt} href="/admin/productos" />
        <StatCard label="Stock bajo / agotado" value={String(k.lowStock)} hint="Variantes en o bajo su mínimo" Icon={AlertTriangle} tone="amber" href="/admin/inventario?filtro=bajo" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Ventas diarias · últimos 30 días" className="xl:col-span-2"><SalesAreaChart data={d.daily} /></Card>
        <Card title="Estados de pedidos"><DonutChart label="Pedidos por estado" data={d.byStatus.map((s) => ({ name: ORDER_STATUS_LABEL[s.status], value: s.count }))} /></Card>
        <Card title="Ventas mensuales · últimos 12 meses" className="xl:col-span-2"><MonthlyBarChart data={d.monthly} /></Card>
        <Card title="Más vendidos · 30 días"><TopProductsChart data={d.top} /></Card>
        <Card title="Ventas por categoría · mes actual" className="xl:col-span-3"><DonutChart label="Ventas por categoría" money data={d.byCategory.map((c) => ({ name: c.name, value: c.total }))} /></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Pedidos recientes" className="xl:col-span-2" padded={false} action={<Link href="/admin/pedidos" className="text-sm font-semibold text-brand hover:underline">Ver todos</Link>}>
          <Table>
            <thead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Fecha</Th><Th>Total</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {d.recent.length === 0 && <TableEmpty cols={5} text="Aún no hay pedidos." />}
              {d.recent.map((o) => (
                <tr key={o.id} className="hover:bg-brand-tint/20">
                  <Td><Link href={`/admin/pedidos/${o.id}`} className="font-semibold text-brand hover:underline">{o.code}</Link></Td>
                  <Td>{o.name}</Td><Td className="text-stone">{formatDate(o.createdAt)}</Td><Td className="font-semibold">{formatPEN(o.total)}</Td><Td><OrderStatusBadge status={o.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Alertas de inventario" padded={false} action={<Link href="/admin/inventario?filtro=bajo" className="text-sm font-semibold text-brand hover:underline">Gestionar</Link>}>
          {d.lowStockList.length === 0 ? (
            <p className="flex items-center gap-2 p-5 text-sm text-stone"><Boxes className="h-4 w-4" /> Todo el inventario está por encima del mínimo.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.lowStockList.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{v.product}</p><p className="text-xs text-stone">{v.color} · {v.size}</p></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{v.stock === 0 ? "Agotado" : `${v.stock} uds.`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

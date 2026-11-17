import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PAID_STATUSES } from "@/lib/constants";
import { formatDate, formatPEN, num } from "@/lib/utils";
import { Card, PageHeader, StatCard, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/orders/status-badges";
import { CustomerActions } from "@/components/admin/customers/customer-actions";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Heart, ShoppingBag } from "lucide-react";

export const metadata = { title: "Ficha de cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, addresses: { orderBy: { isDefault: "desc" } }, orders: { orderBy: { createdAt: "desc" }, take: 30 }, _count: { select: { favorites: true } } },
  });
  if (!user) notFound();
  const paid = user.orders.filter((o) => PAID_STATUSES.includes(o.status));
  const spent = paid.reduce((s, o) => s + num(o.total), 0);

  return (
    <>
      <Link href="/admin/clientes" className="text-sm text-stone hover:text-brand">← Clientes</Link>
      <PageHeader
        title={user.name}
        description={`Cliente desde ${formatDate(user.createdAt)}${user.lastLoginAt ? ` · último acceso ${formatDate(user.lastLoginAt, true)}` : ""}`}
        actions={<><Badge className={user.isActive ? "bg-green-50 text-green-700 ring-green-200" : "bg-neutral-100 text-neutral-600 ring-neutral-200"}>{user.isActive ? "Activo" : "Desactivado"}</Badge><CustomerActions userId={user.id} isActive={user.isActive} isAdmin={user.role === "ADMIN"} /></>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pedidos" value={String(user.orders.length)} Icon={ShoppingBag} />
        <StatCard label="Compras pagadas" value={formatPEN(spent)} hint={`${paid.length} pedidos`} Icon={DollarSign} tone="green" />
        <StatCard label="Favoritos" value={String(user._count.favorites)} Icon={Heart} tone="violet" />
      </div>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Card title="Datos" className="xl:col-span-1">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-stone">Correo</dt><dd className="font-medium">{user.email}</dd></div>
            <div><dt className="text-stone">Teléfono</dt><dd className="font-medium">{user.profile?.phone ?? "—"}</dd></div>
            <div><dt className="text-stone">DNI</dt><dd className="font-medium">{user.profile?.dni ?? "—"}</dd></div>
          </dl>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Direcciones</h3>
          {user.addresses.length === 0 ? <p className="text-sm text-stone">Sin direcciones guardadas.</p> : (
            <ul className="space-y-3 text-sm">{user.addresses.map((a) => <li key={a.id} className="rounded-xl bg-mist p-3"><p className="font-medium">{a.label}{a.isDefault ? " · Principal" : ""}</p><p className="text-stone">{a.line}, {a.district}, {a.province}, {a.department}</p></li>)}</ul>
          )}
        </Card>
        <Card title="Historial de pedidos" className="xl:col-span-2" padded={false}>
          <Table>
            <thead><tr><Th>Pedido</Th><Th>Fecha</Th><Th>Total</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {user.orders.length === 0 && <TableEmpty cols={4} text="Sin pedidos todavía." />}
              {user.orders.map((o) => <tr key={o.id}><Td><Link href={`/admin/pedidos/${o.id}`} className="font-bold text-brand hover:underline">{o.code}</Link></Td><Td className="text-stone">{formatDate(o.createdAt)}</Td><Td className="font-semibold">{formatPEN(num(o.total))}</Td><Td><OrderStatusBadge status={o.status} /></Td></tr>)}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}

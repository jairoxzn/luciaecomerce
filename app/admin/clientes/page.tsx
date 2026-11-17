import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuery } from "@/lib/catalog-params";
import { PAID_STATUSES } from "@/lib/constants";
import { formatDate, formatPEN } from "@/lib/utils";
import { Card, PageHeader, SearchForm, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Clientes" };
const PAGE = 20;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim();
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const where: Prisma.UserWhereInput = { role: "CUSTOMER", ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { profile: { phone: { contains: q } } }] } : {}) };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { profile: true, _count: { select: { orders: true } } } }),
  ]);
  const totals = await prisma.order.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) }, status: { in: PAID_STATUSES } }, _sum: { total: true } });
  const spent = new Map(totals.map((t) => [t.userId, Number(t._sum.total ?? 0)]));

  return (
    <>
      <PageHeader title="Clientes" description={`${total} clientes registrados.`} />
      <Card padded={false}>
        <div className="border-b border-neutral-100 p-4"><SearchForm placeholder="Buscar por nombre, correo o teléfono…" defaultValue={q} /></div>
        <Table>
          <thead><tr><Th>Cliente</Th><Th>Contacto</Th><Th>Pedidos</Th><Th>Compras pagadas</Th><Th>Registro</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {users.length === 0 && <TableEmpty cols={6} />}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-brand-tint/20">
                <Td><Link href={`/admin/clientes/${u.id}`} className="font-semibold hover:text-brand">{u.name}</Link></Td>
                <Td><p>{u.email}</p><p className="text-xs text-stone">{u.profile?.phone ?? "—"}</p></Td>
                <Td>{u._count.orders}</Td>
                <Td className="font-semibold">{formatPEN(spent.get(u.id) ?? 0)}</Td>
                <Td className="text-stone">{formatDate(u.createdAt)}</Td>
                <Td>{u.isActive ? <Badge className="bg-green-50 text-green-700 ring-green-200">Activo</Badge> : <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-200">Desactivado</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(p) => `/admin/clientes${buildQuery(sp, { pagina: p > 1 ? String(p) : undefined })}`} />
    </>
  );
}

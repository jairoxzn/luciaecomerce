import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuery } from "@/lib/catalog-params";
import { formatDate } from "@/lib/utils";
import { Card, ColorDot, FilterTabs, PageHeader, SearchForm, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { AdjustButton } from "@/components/admin/inventory/adjust-button";

export const metadata = { title: "Inventario" };
const PAGE = 25;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const MOVE_STYLE: Record<string, string> = {
  ENTRADA: "bg-green-50 text-green-700 ring-green-200", SALIDA: "bg-red-50 text-red-700 ring-red-200", AJUSTE: "bg-sky-50 text-sky-700 ring-sky-200",
  VENTA: "bg-violet-50 text-violet-700 ring-violet-200", DEVOLUCION: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const vista = one(sp.vista) === "movimientos" ? "movimientos" : "stock";
  const filtro = one(sp.filtro) ?? "todos";
  const q = one(sp.q)?.trim();
  const page = Math.max(1, Number(one(sp.pagina)) || 1);

  const base: Prisma.ProductVariantWhereInput = { product: { status: { not: "ARCHIVED" } }, ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }] } : {}) };

  // Los tres contadores de las pestañas son independientes: una sola ronda de consultas
  const [lowIds, outCount, totalVariants] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`SELECT v."id" FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId" WHERE v."isActive" = true AND p."status" <> 'ARCHIVED' AND v."stock" <= v."minStock"`,
    prisma.productVariant.count({ where: { isActive: true, stock: 0, product: { status: { not: "ARCHIVED" } } } }),
    prisma.productVariant.count({ where: { product: { status: { not: "ARCHIVED" } } } }),
  ]);

  const tabsView = (
    <div className="mb-4 flex gap-2">
      {[["stock", "Existencias"], ["movimientos", "Historial de movimientos"]].map(([v, l]) => (
        <Link key={v} href={`/admin/inventario${buildQuery({}, { vista: v === "stock" ? undefined : v })}`} className={`rounded-full px-5 py-2 text-sm font-semibold ${vista === v ? "bg-brand text-white shadow-soft" : "bg-white text-stone ring-1 ring-neutral-200"}`}>{l}</Link>
      ))}
    </div>
  );

  if (vista === "movimientos") {
    const [total, moves] = await Promise.all([
      prisma.inventoryMovement.count(),
      prisma.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { variant: { include: { product: { select: { name: true } }, size: true, color: true } }, user: { select: { name: true } }, order: { select: { code: true, id: true } } } }),
    ]);
    return (
      <>
        <PageHeader title="Inventario" description="Control real de existencias: entradas, salidas, ajustes y ventas." />
        {tabsView}
        <Card padded={false}>
          <Table>
            <thead><tr><Th>Fecha</Th><Th>Producto</Th><Th>Tipo</Th><Th>Cantidad</Th><Th>Stock</Th><Th>Motivo / Pedido</Th><Th>Responsable</Th></tr></thead>
            <tbody>
              {moves.length === 0 && <TableEmpty cols={7} />}
              {moves.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-stone">{formatDate(m.createdAt, true)}</Td>
                  <Td><p className="font-medium">{m.variant.product.name}</p><p className="text-xs text-stone">{m.variant.color.name} · {m.variant.size.name}</p></Td>
                  <Td><Badge className={MOVE_STYLE[m.type]}>{m.type}</Badge></Td>
                  <Td className={`font-bold ${m.quantity > 0 ? "text-green-700" : "text-red-600"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
                  <Td className="text-stone">{m.stockBefore} → <strong className="text-ink">{m.stockAfter}</strong></Td>
                  <Td className="text-stone">{m.order ? <Link className="font-semibold text-brand hover:underline" href={`/admin/pedidos/${m.order.id}`}>{m.order.code}</Link> : m.reason ?? "—"}</Td>
                  <Td className="text-stone">{m.user?.name ?? "Sistema"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(p) => `/admin/inventario${buildQuery(sp, { pagina: p > 1 ? String(p) : undefined })}`} />
      </>
    );
  }

  const where: Prisma.ProductVariantWhereInput = {
    ...base,
    ...(filtro === "bajo" ? { id: { in: lowIds.map((x) => x.id) } } : {}),
    ...(filtro === "agotado" ? { stock: 0 } : {}),
  };
  const [total, variants] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({ where, orderBy: [{ stock: "asc" }, { product: { name: "asc" } }], skip: (page - 1) * PAGE, take: PAGE, include: { product: { select: { id: true, name: true, status: true } }, size: true, color: true } }),
  ]);

  return (
    <>
      <PageHeader title="Inventario" description="Control real de existencias por variante, con historial y alertas de stock mínimo." />
      {tabsView}
      <FilterTabs current={filtro} hrefFor={(v) => `/admin/inventario${buildQuery(sp, { filtro: v === "todos" ? undefined : v, pagina: undefined })}`} tabs={[{ value: "todos", label: "Todas", count: totalVariants }, { value: "bajo", label: "Stock bajo", count: lowIds.length }, { value: "agotado", label: "Agotadas", count: outCount }]} />
      <Card padded={false}>
        <div className="border-b border-neutral-100 p-4"><SearchForm placeholder="Buscar por producto o SKU…" defaultValue={q} hidden={{ filtro: filtro === "todos" ? undefined : filtro }} /></div>
        <Table>
          <thead><tr><Th>Producto</Th><Th>Variante</Th><Th>SKU</Th><Th>Stock</Th><Th>Mínimo</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {variants.length === 0 && <TableEmpty cols={7} />}
            {variants.map((v) => {
              const out = v.stock === 0;
              const low = v.stock <= v.minStock;
              return (
                <tr key={v.id} className="hover:bg-brand-tint/20">
                  <Td><Link href={`/admin/productos/${v.product.id}`} className="font-semibold hover:text-brand">{v.product.name}</Link></Td>
                  <Td><span className="flex items-center gap-2"><ColorDot hex={v.color.hex} />{v.color.name} · {v.size.name}</span></Td>
                  <Td className="font-mono text-xs text-stone">{v.sku}</Td>
                  <Td className={`text-base font-bold ${out ? "text-red-600" : low ? "text-amber-600" : ""}`}>{v.stock}</Td>
                  <Td className="text-stone">{v.minStock}</Td>
                  <Td>{!v.isActive ? <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-200">Inactiva</Badge> : out ? <Badge className="bg-red-50 text-red-700 ring-red-200">Agotado</Badge> : low ? <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Stock bajo</Badge> : <Badge className="bg-green-50 text-green-700 ring-green-200">OK</Badge>}</Td>
                  <Td className="text-right"><AdjustButton variantId={v.id} stock={v.stock} label={`${v.product.name} · ${v.color.name} · ${v.size.name}`} /></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(p) => `/admin/inventario${buildQuery(sp, { pagina: p > 1 ? String(p) : undefined })}`} />
    </>
  );
}

import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { buildQuery } from "@/lib/catalog-params";
import { Card, FilterTabs, PageHeader, SearchForm } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ProductsTable } from "@/components/admin/products/products-table";

export const metadata = { title: "Productos" };
const PAGE = 20;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim();
  const estado = one(sp.estado) ?? "TODOS";
  const categoria = one(sp.categoria);
  const demo = one(sp.demo) === "1";
  const stockFilter = one(sp.stock);
  const page = Math.max(1, Number(one(sp.pagina)) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(estado !== "TODOS" ? { status: estado as "ACTIVE" | "DRAFT" | "ARCHIVED" } : { status: { not: "ARCHIVED" } }),
    ...(categoria ? { categoryId: categoria } : {}),
    ...(demo ? { isDemo: true } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
    ...(stockFilter === "agotado" ? { variants: { none: { stock: { gt: 0 } } } } : {}),
  };

  const [total, products, categories, counts, demoCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { category: { select: { name: true } }, subcategory: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: { select: { stock: true, minStock: true, isActive: true } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.product.count({ where: { isDemo: true, status: { not: "ARCHIVED" } } }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const href = (v: string) => `/admin/productos${buildQuery(sp, { estado: v === "TODOS" ? undefined : v, pagina: undefined })}`;

  return (
    <>
      <PageHeader title="Productos" description="Administra tu catálogo, precios, fotos y variantes." actions={<LinkButton href="/admin/productos/nuevo"><Plus className="h-4 w-4" /> Nuevo producto</LinkButton>} />
      <FilterTabs current={estado} hrefFor={href} tabs={[{ value: "TODOS", label: "Todos", count: c("ACTIVE") + c("DRAFT") }, { value: "ACTIVE", label: "Activos", count: c("ACTIVE") }, { value: "DRAFT", label: "Borradores", count: c("DRAFT") }, { value: "ARCHIVED", label: "Archivados", count: c("ARCHIVED") }]} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 p-4">
          <SearchForm placeholder="Buscar por nombre o SKU…" defaultValue={q} hidden={{ estado: estado === "TODOS" ? undefined : estado, categoria, demo: demo ? "1" : undefined }} />
          <form className="flex items-center gap-2">
            {q && <input type="hidden" name="q" value={q} />}
            <select name="categoria" defaultValue={categoria ?? ""} aria-label="Filtrar por categoría" className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm">
              <option value="">Todas las categorías</option>
              {categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <select name="stock" defaultValue={stockFilter ?? ""} aria-label="Filtrar por stock" className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm"><option value="">Todo el stock</option><option value="agotado">Agotados</option></select>
            <button className="h-10 rounded-full border border-neutral-200 px-4 text-sm font-medium hover:border-brand hover:text-brand">Filtrar</button>
          </form>
        </div>
        <ProductsTable
          demoCount={demoCount}
          rows={products.map((p) => ({
            id: p.id, name: p.name, sku: p.sku, image: p.images[0]?.url ?? null, category: p.category.name, subcategory: p.subcategory?.name ?? null,
            price: num(p.price), salePrice: p.salePrice ? num(p.salePrice) : null, status: p.status, isDemo: p.isDemo,
            stock: p.variants.reduce((s, v) => s + v.stock, 0), variants: p.variants.length, low: p.variants.some((v) => v.isActive && v.stock <= v.minStock),
          }))}
        />
      </Card>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(p) => `/admin/productos${buildQuery(sp, { pagina: p > 1 ? String(p) : undefined })}`} />
    </>
  );
}

import Image from "next/image";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { listProducts, getNavCategories, type CatalogFilters as Filters } from "@/lib/services/catalog";
import { buildQuery } from "@/lib/catalog-params";
import { CatalogShell, CatalogSidebar } from "./catalog-filters";
import { ProductGrid } from "./product-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

// Columnas según la densidad elegida en la barra de herramientas (data-density en el contenedor)
const GRID =
  "xl:grid-cols-3 2xl:grid-cols-4 " +
  "group-data-[density=wide]/density:grid-cols-1 sm:group-data-[density=wide]/density:grid-cols-2 md:group-data-[density=wide]/density:grid-cols-2 xl:group-data-[density=wide]/density:grid-cols-2 2xl:group-data-[density=wide]/density:grid-cols-3";

const pill = "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition";

export async function CatalogView({ filters, searchParams, basePath, fixedCategory, heading, intro, eyebrow = "Nuestra colección" }: { filters: Filters; searchParams: SP; basePath: string; fixedCategory?: string; heading: string; intro?: string | null; eyebrow?: string }) {
  const [result, categories] = await Promise.all([listProducts(filters), getNavCategories()]);
  const hrefFor = (p: number) => `${basePath}${buildQuery(searchParams, { pagina: p > 1 ? String(p) : undefined })}`;
  const activeCategory = fixedCategory ?? filters.categoria;
  const currentCat = categories.find((c) => c.slug === activeCategory);
  const title = result.subcategory ? `${result.category?.name} · ${result.subcategory.name}` : heading;
  const description = intro ?? result.category?.description;

  return (
    <div className="container-page py-6 sm:py-10">
      <nav aria-label="Migas de pan" className="mb-4 text-xs text-stone">
        <Link href="/" className="hover:text-brand">Inicio</Link> / <Link href="/catalogo" className="hover:text-brand">Catálogo</Link>
        {result.category && <> / <span className="text-ink">{result.category.name}</span></>}
        {result.subcategory && <> / <span className="text-ink">{result.subcategory.name}</span></>}
      </nav>

      <header className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-tint via-white to-brand-soft/40 px-6 py-8 sm:mb-8 sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-brand-soft/40 blur-3xl" />
        {currentCat?.imageUrl && (
          <div aria-hidden className="absolute inset-y-0 right-0 hidden w-2/5 md:block">
            <Image src={currentCat.imageUrl} alt="" fill sizes="40vw" className="object-cover [mask-image:linear-gradient(to_right,transparent,black_55%)]" />
          </div>
        )}
        <div className="relative max-w-xl">
          <p className="font-script text-2xl font-semibold text-brand sm:text-3xl">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-sm text-stone sm:text-base">{description}</p>}
          {filters.q && <p className="mt-3 text-sm text-stone">Resultados para “<strong className="text-ink">{filters.q}</strong>”</p>}
        </div>
      </header>

      {/* Compra por categoría: círculos con foto (solo si la página no está acotada a una categoría) */}
      {!fixedCategory && categories.length > 0 && (
        <nav aria-label="Compra por categoría" className="no-scrollbar -mx-4 mb-4 flex gap-4 overflow-x-auto px-4 pb-1 pt-2 sm:mx-0 sm:gap-6 sm:px-0">
          {[{ id: "all", name: "Todo", slug: "", imageUrl: null as string | null }, ...categories].map((c) => {
            const on = (c.slug || undefined) === (filters.categoria || undefined);
            return (
              <Link key={c.id} href={`${basePath}${buildQuery(searchParams, { categoria: c.slug || undefined, subcategoria: undefined, pagina: undefined })}`} aria-current={on ? "true" : undefined} className="group flex w-20 shrink-0 flex-col items-center gap-2 sm:w-24">
                <span className={cn("relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-tint to-brand-soft text-lg font-extrabold text-brand ring-2 ring-offset-2 transition duration-300 group-hover:scale-105 sm:h-20 sm:w-20", on ? "ring-brand" : "ring-transparent group-hover:ring-brand-soft")}>
                  {c.imageUrl ? <Image src={c.imageUrl} alt="" fill sizes="80px" className="object-cover" /> : c.name.slice(0, 1)}
                </span>
                <span className={cn("text-center text-xs font-semibold leading-tight sm:text-sm", on ? "text-brand" : "text-ink")}>{c.name}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Subcategorías de la categoría actual: enlaces (rastreables) en una fila deslizable */}
      {currentCat && currentCat.subcategories.length > 0 && (
        <nav aria-label="Subcategorías" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link href={`${basePath}${buildQuery(searchParams, { subcategoria: undefined, pagina: undefined })}`} className={cn(pill, !filters.subcategoria ? "border-ink bg-ink text-white" : "border-neutral-200 hover:border-brand hover:text-brand")}>
            Todo
          </Link>
          {currentCat.subcategories.map((s) => (
            <Link key={s.id} href={`${basePath}${buildQuery(searchParams, { subcategoria: s.slug, pagina: undefined })}`} className={cn(pill, filters.subcategoria === s.slug ? "border-ink bg-ink text-white" : "border-neutral-200 hover:border-brand hover:text-brand")}>
              {s.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex gap-8 xl:gap-10">
        <CatalogSidebar categories={categories} fixedCategory={fixedCategory} facets={result.facets} priceRange={result.priceRange} showCategories={!fixedCategory} />
        <div className="min-w-0 flex-1">
          <CatalogShell categories={categories} fixedCategory={fixedCategory} facets={result.facets} priceRange={result.priceRange} total={result.total} showCategories={!fixedCategory}>
            {result.items.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No encontramos productos"
                description="Prueba quitando algunos filtros o buscando con otras palabras."
                action={<LinkButton href={basePath} variant="soft">Limpiar filtros</LinkButton>}
              />
            ) : (
              <>
                <ProductGrid products={result.items} className={GRID} />
                {result.pageCount > 1 && <p className="mt-8 text-center text-xs text-stone">Página {result.page} de {result.pageCount}</p>}
                <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
              </>
            )}
          </CatalogShell>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";
import { listProducts, getNavCategories, type CatalogFilters as Filters } from "@/lib/services/catalog";
import { buildQuery } from "@/lib/catalog-params";
import { CatalogFilters, CatalogSidebar } from "./catalog-filters";
import { ProductGrid } from "./product-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

type SP = Record<string, string | string[] | undefined>;

export async function CatalogView({ filters, searchParams, basePath, fixedCategory, heading, intro }: { filters: Filters; searchParams: SP; basePath: string; fixedCategory?: string; heading: string; intro?: string | null }) {
  const [result, categories] = await Promise.all([listProducts(filters), getNavCategories()]);
  const hrefFor = (p: number) => `${basePath}${buildQuery(searchParams, { pagina: p > 1 ? String(p) : undefined })}`;

  return (
    <div className="container-page py-8 sm:py-12">
      <nav aria-label="Migas de pan" className="mb-4 text-xs text-stone">
        <Link href="/" className="hover:text-brand">Inicio</Link> / <Link href="/catalogo" className="hover:text-brand">Catálogo</Link>
        {result.category && <> / <span className="text-ink">{result.category.name}</span></>}
        {result.subcategory && <> / <span className="text-ink">{result.subcategory.name}</span></>}
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{result.subcategory ? `${result.category?.name} · ${result.subcategory.name}` : heading}</h1>
        {(intro || result.category?.description) && <p className="mt-2 max-w-2xl text-stone">{intro ?? result.category?.description}</p>}
        {filters.q && <p className="mt-2 text-sm text-stone">Resultados para “<strong className="text-ink">{filters.q}</strong>”</p>}
      </header>

      <div className="flex gap-10">
        <CatalogSidebar categories={categories} fixedCategory={fixedCategory} facets={result.facets} priceRange={result.priceRange} showCategories={!fixedCategory} />
        <div className="min-w-0 flex-1">
          <CatalogFilters categories={categories} fixedCategory={fixedCategory} facets={result.facets} priceRange={result.priceRange} total={result.total} showCategories={!fixedCategory} />
          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No encontramos productos"
              description="Prueba quitando algunos filtros o buscando con otras palabras."
              action={<LinkButton href={basePath} variant="soft">Limpiar filtros</LinkButton>}
            />
          ) : (
            <>
              <ProductGrid products={result.items} className="xl:grid-cols-3 2xl:grid-cols-4" />
              <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

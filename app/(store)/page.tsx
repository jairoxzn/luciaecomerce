import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getHomeData, getNavCategories } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { CategoryTiles } from "@/components/store/category-tiles";
import { PromoStrip } from "@/components/store/promo-strip";
import { BarSection } from "@/components/store/section";
import { ProductGrid } from "@/components/products/product-card";

// Se renderiza en cada petición (los datos salen de la caché de Redis): el build no consulta la base de datos
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, categories, settings] = await Promise.all([getHomeData(), getNavCategories(), getSettings()]);
  const promo = data.promo[0];
  // Un producto no se repite en dos filas seguidas de la portada
  const shown = new Set<string>();
  const fresh = <T extends { id: string }>(list: T[], max = 5) => {
    const out = list.filter((p) => !shown.has(p.id)).slice(0, max);
    out.forEach((p) => shown.add(p.id));
    return out;
  };
  const best = fresh(data.best);
  const newest = fresh(data.newest);
  const featured = fresh(data.featured);
  const offers = fresh(data.offers);

  return (
    <>
      <HeroCarousel banners={data.hero} description={settings.heroDescription} />
      <CategoryTiles categories={categories} />

      {best.length > 0 && (
        <BarSection title="Los más vendidos" href="/catalogo?orden=vendidos">
          <ProductGrid products={best} variant="boxed" />
        </BarSection>
      )}

      {newest.length > 0 && (
        <BarSection title="Nuevos ingresos" href="/catalogo?orden=recientes">
          <ProductGrid products={newest} variant="boxed" />
        </BarSection>
      )}

      <PromoStrip promo={promo} settings={settings} />

      {featured.length > 0 && (
        <BarSection title="Productos destacados" href="/catalogo">
          <ProductGrid products={featured} variant="boxed" />
        </BarSection>
      )}

      {offers.length > 0 && (
        <BarSection title="Ofertas especiales" href="/ofertas">
          <ProductGrid products={offers} variant="boxed" />
        </BarSection>
      )}

      {data.collections.length > 0 && (
        <BarSection title="Colecciones">
          <div className="grid gap-4 md:grid-cols-3">
            {data.collections.map((c) => (
              <Link key={c.id} href={c.ctaHref ?? "/catalogo"} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-tint md:aspect-[3/4]">
                <Image src={c.imageUrl} alt={c.title} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="text-xl font-bold">{c.title}</h3>
                  {c.subtitle && <p className="text-sm text-white/80">{c.subtitle}</p>}
                  {c.ctaLabel && <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">{c.ctaLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>}
                </div>
              </Link>
            ))}
          </div>
        </BarSection>
      )}
    </>
  );
}

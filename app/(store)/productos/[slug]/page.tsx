import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { absoluteUrl } from "@/lib/utils";
import { ProductView } from "@/components/products/product-view";
import { ProductGrid } from "@/components/products/product-card";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado" };
  const desc = p.description.slice(0, 155);
  const img = p.images[0]?.url;
  return {
    title: p.name,
    description: desc,
    alternates: { canonical: `/productos/${p.slug}` },
    openGraph: { type: "website", title: p.name, description: desc, url: absoluteUrl(`/productos/${p.slug}`), images: img ? [{ url: img }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!p) notFound();
  const related = await getRelatedProducts(p.id, p.categoryId);
  const inStock = p.variants.some((v) => v.stock > 0);
  const prices = p.variants.map((v) => v.price);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    image: p.images.map((i) => (i.url.startsWith("http") ? i.url : absoluteUrl(i.url))),
    brand: { "@type": "Brand", name: settings.storeName },
    category: p.category.name,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PEN",
      lowPrice: (prices.length ? Math.min(...prices) : p.price).toFixed(2),
      highPrice: (prices.length ? Math.max(...prices) : p.price).toFixed(2),
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/productos/${p.slug}`),
    },
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Migas de pan" className="mb-5 text-xs text-stone">
        <Link href="/" className="hover:text-brand">Inicio</Link> / <Link href={`/categorias/${p.category.slug}`} className="hover:text-brand">{p.category.name}</Link>
        {p.subcategory && <> / <Link href={`/categorias/${p.category.slug}?subcategoria=${p.subcategory.slug}`} className="hover:text-brand">{p.subcategory.name}</Link></>} / <span className="text-ink">{p.name}</span>
      </nav>

      <ProductView product={p} sizeGuide={settings.sizeGuide} shippingPolicy={settings.shippingPolicy} returnPolicy={settings.returnPolicy} />

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="rel">
          <h2 id="rel" className="mb-6 text-2xl font-bold tracking-tight">También te puede gustar</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}

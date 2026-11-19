import type { Metadata } from "next";
import { CatalogView } from "@/components/products/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";

// Depende de la URL (filtros): siempre dinámica; los datos salen de la caché de Redis y el build no consulta la base de datos
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : null;
  return {
    title: q ? `Resultados para “${q}”` : "Catálogo",
    description: "Explora todo nuestro catálogo de moda para mujer, hombre y niños.",
    alternates: { canonical: "/catalogo" },
    robots: q || Object.keys(sp).length > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <CatalogView filters={parseCatalogParams(sp)} searchParams={sp} basePath="/catalogo" heading="Catálogo" intro="Todo nuestro catálogo en un solo lugar." />;
}

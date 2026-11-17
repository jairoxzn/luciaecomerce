import type { Metadata } from "next";
import { CatalogView } from "@/components/products/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "Ofertas", description: "Aprovecha los mejores descuentos en moda para toda la familia.", alternates: { canonical: "/ofertas" } };

export default async function OffersPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <CatalogView filters={parseCatalogParams(sp, { oferta: true })} searchParams={sp} basePath="/ofertas" heading="Ofertas especiales" intro="Descuentos vigentes en prendas seleccionadas." />;
}

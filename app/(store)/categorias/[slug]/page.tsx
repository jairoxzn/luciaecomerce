import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CatalogView } from "@/components/products/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// generateMetadata y la página piden la misma categoría: `cache` evita repetir la consulta en una misma petición
const getCategory = cache((slug: string) => prisma.category.findUnique({ where: { slug }, select: { name: true, description: true, isActive: true } }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c) return {};
  return {
    title: `Moda ${c.name}`,
    description: c.description ?? `Descubre la colección de ${c.name}.`,
    alternates: { canonical: `/categorias/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  // Parámetros de la ruta y de la URL se resuelven a la vez
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category || !category.isActive) notFound();
  return <CatalogView filters={parseCatalogParams(sp, { categoria: slug })} searchParams={sp} basePath={`/categorias/${slug}`} fixedCategory={slug} heading={category.name} />;
}

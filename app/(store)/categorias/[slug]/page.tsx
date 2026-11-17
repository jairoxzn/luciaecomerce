import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CatalogView } from "@/components/products/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await prisma.category.findUnique({ where: { slug }, select: { name: true, description: true } });
  if (!c) return {};
  return {
    title: `Moda ${c.name}`,
    description: c.description ?? `Descubre la colección de ${c.name}.`,
    alternates: { canonical: `/categorias/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await prisma.category.findFirst({ where: { slug, isActive: true }, select: { name: true } });
  if (!category) notFound();
  return <CatalogView filters={parseCatalogParams(sp, { categoria: slug })} searchParams={sp} basePath={`/categorias/${slug}`} fixedCategory={slug} heading={category.name} />;
}

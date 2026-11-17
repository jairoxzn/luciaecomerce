import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/products/product-form";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, subcategories: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } });
  return (
    <>
      <Link href="/admin/productos" className="text-sm text-stone hover:text-brand">← Productos</Link>
      <PageHeader title="Nuevo producto" description="Completa los datos, sube las fotografías y crea el producto; luego define sus variantes de color y talla." />
      <ProductForm categories={categories} />
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/catalog/category-manager";

export const metadata = { title: "Categorías" };

export default async function AdminCategoriesPage() {
  const [cats, sizes, colors] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } }, subcategories: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } } },
    }),
    prisma.size.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Categorías" description="Organiza el catálogo: categorías, subcategorías, tallas y colores disponibles." />
      <CategoryManager
        sizes={sizes.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder }))}
        colors={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
        categories={cats.map((c) => ({
          id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive, showOnHome: c.showOnHome, productCount: c._count.products,
          subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder, isActive: s.isActive, productCount: s._count.products })),
        }))}
      />
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { PromotionManager } from "@/components/admin/marketing/promotion-manager";

export const metadata = { title: "Promociones" };

export default async function PromotionsAdminPage() {
  const [promos, categories] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" }, include: { category: { select: { name: true } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Promociones" description="Descuentos automáticos por categoría o para toda la tienda, con fechas de inicio y fin." />
      <PromotionManager
        categories={categories}
        promotions={promos.map((p) => ({ id: p.id, name: p.name, description: p.description, discountType: p.discountType, value: num(p.value), categoryId: p.categoryId, categoryName: p.category?.name ?? null, startsAt: p.startsAt?.toISOString() ?? null, endsAt: p.endsAt?.toISOString() ?? null, isActive: p.isActive }))}
      />
    </>
  );
}

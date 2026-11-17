import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "@/components/admin/marketing/coupon-manager";

export const metadata = { title: "Cupones" };

export default async function CouponsAdminPage() {
  const [coupons, categories] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { categories: { select: { id: true } } } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Cupones" description="Códigos de descuento que el cliente ingresa en el carrito. Todas las condiciones se validan en el servidor." />
      <CouponManager
        categories={categories}
        coupons={coupons.map((c) => ({ id: c.id, code: c.code, description: c.description, discountType: c.discountType, value: num(c.value), minPurchase: c.minPurchase ? num(c.minPurchase) : null, startsAt: c.startsAt?.toISOString() ?? null, expiresAt: c.expiresAt?.toISOString() ?? null, usageLimit: c.usageLimit, usedCount: c.usedCount, isPublic: c.isPublic, isActive: c.isActive, categoryIds: c.categories.map((x) => x.id) }))}
      />
    </>
  );
}

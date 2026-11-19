import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cached, cacheKey, invalidateInBackground } from "@/lib/cache";
import { num } from "@/lib/utils";
import type { PromoRule } from "@/lib/pricing-core";

export * from "@/lib/pricing-core";

export const PROMOS_TAG = "promotions";

const loadPromotionsCached = unstable_cache(
  () =>
    cached(cacheKey("promotions"), 60, async (): Promise<PromoRule[]> => {
      const now = new Date();
      const rows = await prisma.promotion.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      });
      return rows.map((r) => ({ discountType: r.discountType, value: num(r.value), categoryId: r.categoryId }));
    }),
  ["active-promotions"],
  { tags: [PROMOS_TAG], revalidate: 60 },
);

/** Promociones activas; las llamadas repetidas dentro de una misma petición comparten una sola consulta. */
export const loadActivePromotions = cache(() => loadPromotionsCached());

export function revalidatePromotions() {
  revalidateTag(PROMOS_TAG);
  invalidateInBackground();
}

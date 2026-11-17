import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { BannerManager } from "@/components/admin/marketing/banner-manager";

export const metadata = { title: "Banners" };

export default async function BannersAdminPage() {
  const banners = await prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="Banners" description="Controla el carrusel principal, la franja promocional y las colecciones de la página de inicio." />
      <BannerManager
        banners={banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl, position: b.position, sortOrder: b.sortOrder, isActive: b.isActive, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null }))}
      />
    </>
  );
}

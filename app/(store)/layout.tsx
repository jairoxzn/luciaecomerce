import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getNavCategories } from "@/lib/services/catalog";
import { getSettings, SETTINGS_TAG } from "@/lib/services/settings";
import { formatPEN } from "@/lib/utils";
import { TopBar } from "@/components/layout/top-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartSync } from "@/components/cart/cart-sync";

const getAnnouncement = unstable_cache(async () => {
  const zone = await prisma.shippingZone.findFirst({ where: { isActive: true, freeShippingFrom: { not: null } }, orderBy: { sortOrder: "asc" } });
  if (!zone?.freeShippingFrom) return "Envíos a todo el Perú · Compra segura";
  return `Envío gratis en ${zone.name} desde ${formatPEN(Number(zone.freeShippingFrom))} · Envíos a todo el Perú`;
}, ["store-announcement"], { tags: [SETTINGS_TAG], revalidate: 300 });

/**
 * Este layout NO lee cookies ni datos del usuario: así las páginas públicas (producto, políticas…) pueden
 * generarse una vez y servirse desde caché (ISR). La sesión y los favoritos los carga `CartSync` en el navegador.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, announcement] = await Promise.all([getSettings(), getNavCategories(), getAnnouncement()]);

  return (
    <>
      <TopBar settings={settings} announcement={announcement} />
      <SiteHeader storeName={settings.storeName} logoUrl={settings.logoUrl} categories={categories} />
      <main id="contenido">{children}</main>
      <SiteFooter settings={settings} categories={categories} />
      <WhatsAppFloat phone={settings.whatsapp} storeName={settings.storeName} />
      <CartDrawer />
      <CartSync />
    </>
  );
}

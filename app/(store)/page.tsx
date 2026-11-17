import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getHomeData, getNavCategories } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";
import { normalizePeruPhone } from "@/lib/utils";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { Section } from "@/components/store/section";
import { Benefits } from "@/components/store/benefits";
import { ProductGrid } from "@/components/products/product-card";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";

export const revalidate = 120;

export default async function HomePage() {
  const [data, categories, settings, zones] = await Promise.all([
    getHomeData(),
    getNavCategories(),
    getSettings(),
    prisma.shippingZone.count({ where: { isActive: true } }),
  ]);
  const promo = data.promo[0];
  const social = [
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.whatsapp ? `https://wa.me/${normalizePeruPhone(settings.whatsapp)}` : null, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((s) => s.href);

  return (
    <>
      <HeroCarousel banners={data.hero} description={settings.heroDescription} />
      <Benefits settings={settings} hasShipping={zones > 0} />

      <Section title="Categorías destacadas" kicker="Encuentra tu estilo">
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {categories.filter((c) => c.showOnHome).map((c) => (
            <Link key={c.id} href={`/categorias/${c.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-tint">
              {c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white sm:p-5">
                <span className="text-lg font-bold sm:text-xl">{c.name}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur transition group-hover:bg-brand">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {data.newest.length > 0 && (
        <Section title="Nuevos ingresos" kicker="Recién llegados" href="/catalogo?orden=recientes" className="pt-0">
          <ProductGrid products={data.newest.slice(0, 8)} />
        </Section>
      )}

      {promo && (
        <section className="container-page">
          <Link href={promo.ctaHref ?? "/catalogo"} className="group relative flex items-center overflow-hidden rounded-3xl bg-gradient-to-r from-brand to-brand-dark p-6 text-white shadow-soft sm:p-10">
            <div className="relative z-10 max-w-md">
              <h2 className="text-2xl font-extrabold sm:text-4xl">{promo.title}</h2>
              {promo.subtitle && <p className="mt-2 text-sm text-white/85 sm:text-base">{promo.subtitle}</p>}
              {promo.ctaLabel && <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand transition group-hover:gap-3">{promo.ctaLabel} <ArrowRight className="h-4 w-4" /></span>}
            </div>
            <div className="absolute inset-y-0 right-0 hidden w-1/2 sm:block">
              <Image src={promo.imageUrl} alt="" fill sizes="50vw" className="object-cover opacity-90 [mask-image:linear-gradient(to_left,black_40%,transparent)]" />
            </div>
          </Link>
        </section>
      )}

      {data.featured.length > 0 && (
        <Section title="Productos destacados" kicker="Selección Lucia" href="/catalogo">
          <ProductGrid products={data.featured.slice(0, 8)} />
        </Section>
      )}

      {data.best.length > 0 && (
        <Section title="Más vendidos" kicker="Favoritos de nuestras clientas" href="/catalogo?orden=vendidos" tint>
          <ProductGrid products={data.best.slice(0, 4)} />
        </Section>
      )}

      {data.offers.length > 0 && (
        <Section title="Ofertas especiales" kicker="Aprovecha" href="/ofertas">
          <ProductGrid products={data.offers.slice(0, 4)} />
        </Section>
      )}

      {data.collections.length > 0 && (
        <Section title="Colecciones" kicker="Inspírate" className="pt-0">
          <div className="grid gap-4 md:grid-cols-3">
            {data.collections.map((c) => (
              <Link key={c.id} href={c.ctaHref ?? "/catalogo"} className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand-tint md:aspect-[3/4]">
                <Image src={c.imageUrl} alt={c.title} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="text-xl font-bold">{c.title}</h3>
                  {c.subtitle && <p className="text-sm text-white/80">{c.subtitle}</p>}
                  {c.ctaLabel && <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">{c.ctaLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {social.length > 0 && (
        <section className="container-page pb-4">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-brand-tint px-6 py-10 text-center">
            <p className="font-script text-3xl font-semibold text-brand">Síguenos en nuestras redes</p>
            <p className="max-w-md text-sm text-stone">Entérate primero de lanzamientos, descuentos y looks de temporada.</p>
            <div className="flex gap-3">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white transition hover:scale-110 hover:bg-brand">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

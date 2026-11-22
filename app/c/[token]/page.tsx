import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { getSharedCatalog, type SharedProduct } from "@/lib/services/share-catalog";
import { Logo } from "@/components/ui/logo";
import { Price } from "@/components/ui/price";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { cn, normalizePeruPhone, pluralize } from "@/lib/utils";

// Siempre fresco: precios, stock, vencimiento y estado del enlace se evalúan en cada visita
export const dynamic = "force-dynamic";

const load = cache((token: string) => getSharedCatalog(token));
type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const [catalog, settings] = await Promise.all([load(token), getSettings()]);
  if (!catalog) return { title: "Catálogo no disponible", robots: { index: false, follow: false } };
  const first = catalog.groups[0]?.products.find((p) => p.image)?.image;
  const description = catalog.message || `Mira el catálogo de ${settings.storeName}: ${catalog.total} ${pluralize(catalog.total, "producto", "productos")}.`;
  return {
    title: catalog.title,
    description,
    // Es un enlace privado para clientes: no debe aparecer en buscadores
    robots: { index: false, follow: false },
    openGraph: { title: `${catalog.title} | ${settings.storeName}`, description, ...(first ? { images: [{ url: first }] } : {}) },
    alternates: {}, // anula el canonical "/" del layout raíz
  };
}

function waLink(phone: string | null, text: string) {
  return phone ? `https://wa.me/${normalizePeruPhone(phone)}?text=${encodeURIComponent(text)}` : null;
}

function Item({ p, showPrices, wa, title }: { p: SharedProduct; showPrices: boolean; wa: string | null; title: string }) {
  const ask = waLink(wa, `Hola, me interesa «${p.name}» del catálogo «${title}». ¿Está disponible?`);
  return (
    <article className="group/card flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-brand-soft hover:shadow-card">
      <Link href={`/productos/${p.slug}`} target="_blank" className="relative block aspect-[3/4] overflow-hidden bg-brand-tint/40" aria-label={`${p.name} — ver en la tienda`}>
        {p.image ? (
          <>
            <Image src={p.image} alt={p.name} fill sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw" className={cn("object-cover transition duration-500 group-hover/card:scale-105", p.image2 && "group-hover/card:opacity-0", !p.inStock && "grayscale-[40%]")} />
            {p.image2 && <Image src={p.image2} alt="" fill sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw" className="object-cover opacity-0 transition duration-500 group-hover/card:scale-105 group-hover/card:opacity-100" />}
          </>
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-stone">Sin imagen</span>
        )}
        <span className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {showPrices && p.discountPct > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-soft">-{p.discountPct}%</span>}
          {p.isNew && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">Nuevo</span>}
          {p.lowStock && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Últimas unidades</span>}
        </span>
        {!p.inStock && <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/75 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">Agotado</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
        {p.sizes.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Tallas">
            {p.sizes.map((s) => <li key={s} className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-stone">{s}</li>)}
          </ul>
        )}
        {p.colors.length > 0 && (
          <div className="flex items-center gap-1" aria-label={`Colores: ${p.colors.map((c) => c.name).join(", ")}`}>
            {p.colors.slice(0, 6).map((c) => <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />)}
            {p.colors.length > 6 && <span className="text-[11px] text-stone">+{p.colors.length - 6}</span>}
          </div>
        )}
        {showPrices && <Price price={p.price} compareAt={p.compareAt} />}
        <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
          {ask && (
            <a href={ask} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold text-white transition hover:bg-[#1ebe5b] active:scale-[0.97]">
              <WhatsAppIcon className="h-4 w-4" /> Consultar
            </a>
          )}
          <Link href={`/productos/${p.slug}`} target="_blank" className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-stone transition hover:text-brand">
            Ver en la tienda <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function SharedCatalogPage({ params }: Props) {
  const { token } = await params;
  const [catalog, settings] = await Promise.all([load(token), getSettings()]);
  if (!catalog) notFound();

  // Cuenta la visita sin retrasar la respuesta; las vistas del administrador (vista previa) no cuentan
  const viewer = await getCurrentUser();
  if (viewer?.role !== "ADMIN") {
    after(async () => {
      await prisma.shareCatalog.update({ where: { id: catalog.id }, data: { views: { increment: 1 } } }).catch(() => undefined);
    });
  }

  const general = waLink(settings.whatsapp, `Hola ${settings.storeName}, vi el catálogo «${catalog.title}» y quisiera hacer un pedido.`);
  const collage = catalog.groups.flatMap((g) => g.products).map((p) => p.image).filter((u): u is string => !!u).slice(0, 4);
  const anchor = (name: string) => `cat-${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-neutral-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo logoUrl={settings.logoUrl} name={settings.storeName} className="h-9 sm:h-10" priority />
          {general && (
            <a href={general} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:bg-[#1ebe5b]">
              <WhatsAppIcon className="h-4 w-4" /> <span className="hidden sm:inline">Hacer pedido</span><span className="sm:hidden">Pedir</span>
            </a>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-tint via-white to-brand-soft/40">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-9 sm:px-6 sm:py-14 md:grid-cols-[1.2fr_1fr]">
          <div className="text-center md:text-left">
            <p className="font-script text-3xl font-semibold text-brand sm:text-4xl">Catálogo</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-5xl">{catalog.title}</h1>
            {catalog.message && <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm text-stone sm:text-base md:mx-0">{catalog.message}</p>}
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone shadow-card">
              {catalog.total} {pluralize(catalog.total, "producto", "productos")}
              {catalog.groups.length > 1 && <span className="text-brand">· {catalog.groups.length} categorías</span>}
            </p>
            {general && (
              <div className="mt-5 md:mt-6">
                <a href={general} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-semibold text-white shadow-card transition hover:bg-[#1ebe5b] active:scale-[0.97]">
                  <WhatsAppIcon className="h-4 w-4" /> Hacer mi pedido por WhatsApp
                </a>
              </div>
            )}
          </div>
          {collage.length >= 2 && (
            <div aria-hidden className="hidden grid-cols-2 gap-3 md:grid">
              {collage.map((img, i) => (
                <div key={img} className={cn("relative aspect-[3/4] overflow-hidden rounded-2xl bg-brand-tint shadow-card", i % 2 === 1 && "translate-y-6")}>
                  <Image src={img} alt="" fill sizes="20vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {catalog.groups.length > 1 && (
        <nav aria-label="Categorías" className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 backdrop-blur">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
            {catalog.groups.map((g) => (
              <a key={g.category} href={`#${anchor(g.category)}`} className="shrink-0 rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium transition hover:border-brand hover:text-brand">{g.category} <span className="text-xs text-stone">{g.products.length}</span></a>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {catalog.total === 0 ? (
          <p className="py-16 text-center text-stone">Por ahora no hay productos disponibles en este catálogo. Vuelve a visitarnos pronto.</p>
        ) : (
          catalog.groups.map((g) => (
            <section key={g.category} id={anchor(g.category)} className="scroll-mt-16 pb-12 last:pb-0">
              <h2 className="mb-5 flex items-baseline gap-3 text-xl font-extrabold tracking-tight sm:text-2xl"><span className="h-6 w-1.5 shrink-0 translate-y-1 rounded-full bg-brand" aria-hidden />{g.category} <span className="text-sm font-normal text-stone">{g.products.length} {pluralize(g.products.length, "producto", "productos")}</span></h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
                {g.products.map((p) => <Item key={p.id} p={p} showPrices={catalog.showPrices} wa={settings.whatsapp} title={catalog.title} />)}
              </div>
            </section>
          ))
        )}
      </main>

      {general && (
        <a href={general} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp" className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition hover:scale-105 hover:bg-[#1ebe5b] active:scale-95 sm:hidden">
          <WhatsAppIcon className="h-7 w-7" />
        </a>
      )}

      <footer className="border-t border-neutral-100 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-stone sm:px-6">
          <p className="font-semibold text-ink">{settings.storeName}</p>
          {settings.slogan && <p className="mt-1">{settings.slogan}</p>}
          <p className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {settings.phone && <span>Tel. {settings.phone}</span>}
            {settings.businessHours && <span>{settings.businessHours}</span>}
            {settings.address && <span>{settings.address}</span>}
          </p>
          <Link href="/" className="mt-4 inline-block font-medium text-brand hover:underline">Visitar la tienda online</Link>
        </div>
      </footer>
    </div>
  );
}

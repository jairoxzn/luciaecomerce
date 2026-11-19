import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headset, Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { normalizePeruPhone } from "@/lib/utils";
import type { BannerData } from "@/lib/services/catalog";
import type { Settings } from "@/lib/services/settings";

/**
 * Franja de tarjetas bajo los productos:
 *  1) banner promocional (el de posición «Franja promocional» del panel: foto + título + botón),
 *  2) invitación a recibir novedades por WhatsApp (solo si hay WhatsApp configurado),
 *  3) atención personalizada con el horario y teléfono reales.
 * No se muestran reseñas ni cifras que la tienda no tenga.
 */
export function PromoStrip({ promo, settings }: { promo?: BannerData; settings: Settings }) {
  const wa = settings.whatsapp ? normalizePeruPhone(settings.whatsapp) : null;
  const help = !!(settings.phone || settings.businessHours || wa);
  if (!promo && !wa && !help) return null;

  const cards = [!!promo, !!wa, help].filter(Boolean).length;

  return (
    <section aria-label="Promociones y atención" className="container-page py-6 sm:py-8">
      <div className={`grid gap-4 ${cards >= 3 ? "lg:grid-cols-[1.35fr_1fr_1fr]" : cards === 2 ? "lg:grid-cols-2" : ""}`}>
        {promo && (
          <article className="relative isolate flex min-h-[11.5rem] overflow-hidden rounded-2xl bg-gradient-to-br from-[#172f63] to-[#27498c] text-white">
            <div className="absolute inset-y-0 right-0 -z-10 w-[58%]">
              <Image src={promo.imageUrl} alt="" fill sizes="(min-width:1024px) 28vw, 70vw" className="object-cover [mask-image:linear-gradient(to_right,transparent,#000_38%)]" />
            </div>
            <div className="flex max-w-[62%] flex-col justify-center gap-2 p-5 sm:p-6">
              <h3 className="text-2xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-3xl">{promo.title}</h3>
              {promo.subtitle && <p className="text-sm font-medium text-white/90">{promo.subtitle}</p>}
              {promo.ctaLabel && promo.ctaHref && (
                <Link href={promo.ctaHref} className="group mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-ink shadow-card transition hover:bg-brand hover:text-white">
                  {promo.ctaLabel}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </article>
        )}

        {wa && (
          <article className="relative isolate flex min-h-[11.5rem] flex-col justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-tint to-brand-soft/80 p-5 sm:p-6">
            <Send aria-hidden className="absolute -right-3 top-3 -z-10 h-24 w-24 -rotate-12 text-brand/25" strokeWidth={1.2} />
            <h3 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-tight sm:text-xl">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white"><Send className="h-4 w-4" /></span>
              Únete a {settings.storeName}
            </h3>
            <p className="max-w-[16rem] text-sm text-ink/80">Recibe novedades, promociones y descuentos exclusivos.</p>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${settings.storeName}, quiero recibir novedades y promociones.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-brand-dark"
            >
              <WhatsAppIcon className="h-4 w-4" /> Recibirlas por WhatsApp
            </a>
          </article>
        )}

        {help && (
          <article className="flex min-h-[11.5rem] flex-col justify-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-card sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-tight sm:text-xl">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint text-brand"><Headset className="h-4 w-4" /></span>
              Atención personalizada
            </h3>
            <p className="text-sm text-stone">{settings.businessHours ?? "Estamos para ayudarte con tu compra."}</p>
            {settings.phone && <p className="text-sm font-semibold">{settings.phone}</p>}
            <Link href="/contacto" className="group mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-brand">
              Escríbenos <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </article>
        )}
      </div>
    </section>
  );
}

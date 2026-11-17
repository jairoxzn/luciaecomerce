import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { digitsOnly, normalizePeruPhone } from "@/lib/utils";
import { enabledPaymentMethods, type Settings } from "@/lib/services/settings";
import type { NavCategory } from "@/lib/services/catalog";

export function SiteFooter({ settings, categories }: { settings: Settings; categories: NavCategory[] }) {
  const pay = enabledPaymentMethods(settings);
  const methods = [pay.YAPE && "Yape", pay.PLIN && "Plin", pay.TRANSFER && "Transferencia", pay.COD && "Contra entrega"].filter(Boolean) as string[];
  const social = [
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.whatsapp ? `https://wa.me/${normalizePeruPhone(settings.whatsapp)}` : null, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 bg-ink text-neutral-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo logoUrl={settings.logoUrl} tone="white" name={settings.storeName} className="h-12" />
          <p className="max-w-xs text-sm leading-relaxed text-neutral-400">{settings.slogan}</p>
          {social.length > 0 && (
            <div className="flex gap-2 pt-1">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-brand">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Comprar</h3>
          <ul className="space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.id}><Link href={`/categorias/${c.slug}`} className="transition hover:text-brand-soft">{c.name}</Link></li>
            ))}
            <li><Link href="/ofertas" className="transition hover:text-brand-soft">Ofertas</Link></li>
            <li><Link href="/catalogo?orden=recientes" className="transition hover:text-brand-soft">Nuevos ingresos</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Ayuda</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/pedidos/seguimiento" className="transition hover:text-brand-soft">Seguir mi pedido</Link></li>
            <li><Link href="/politicas/envios" className="transition hover:text-brand-soft">Política de envíos</Link></li>
            <li><Link href="/politicas/cambios-y-devoluciones" className="transition hover:text-brand-soft">Cambios y devoluciones</Link></li>
            <li><Link href="/politicas/privacidad" className="transition hover:text-brand-soft">Política de privacidad</Link></li>
            <li><Link href="/politicas/terminos" className="transition hover:text-brand-soft">Términos y condiciones</Link></li>
            <li><Link href="/nosotros" className="transition hover:text-brand-soft">Nosotros</Link></li>
            <li><Link href="/contacto" className="transition hover:text-brand-soft">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Contáctanos</h3>
          <ul className="space-y-3 text-sm">
            {settings.phone && <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><a href={`tel:+51${digitsOnly(settings.phone)}`} className="hover:text-brand-soft">{settings.phone}</a></li>}
            {settings.email && <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><a href={`mailto:${settings.email}`} className="break-all hover:text-brand-soft">{settings.email}</a></li>}
            {settings.address && <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span>{settings.address}</span></li>}
            {settings.businessHours && <li className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span>{settings.businessHours}</span></li>}
          </ul>
          {methods.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Medios de pago</p>
              <div className="flex flex-wrap gap-1.5">
                {methods.map((m) => (
                  <span key={m} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-neutral-500 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.storeName}. Todos los derechos reservados.</p>
          <p>Moda, estilo y actitud en un solo lugar.</p>
        </div>
      </div>
    </footer>
  );
}

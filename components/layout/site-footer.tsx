import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { FooterWave } from "@/components/store/waves";
import { digitsOnly, normalizePeruPhone } from "@/lib/utils";
import { enabledPaymentMethods, type Settings } from "@/lib/services/settings";
import type { NavCategory } from "@/lib/services/catalog";

const CHIP: Record<string, string> = { Yape: "bg-[#742284] italic", Plin: "bg-[#00b3c7]" };

export function SiteFooter({ settings, categories }: { settings: Settings; categories: NavCategory[] }) {
  const pay = enabledPaymentMethods(settings);
  const methods = [pay.YAPE && "Yape", pay.PLIN && "Plin", pay.TRANSFER && "Transferencia", pay.COD && "Contra entrega"].filter(Boolean) as string[];
  const social = [
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.whatsapp ? `https://wa.me/${normalizePeruPhone(settings.whatsapp)}` : null, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((s) => s.href);

  const link = "transition hover:text-brand-soft";
  const quick = [
    { href: "/", label: "Inicio" },
    ...categories.map((c) => ({ href: `/categorias/${c.slug}`, label: c.name })),
    { href: "/ofertas", label: "Ofertas" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/pedidos/seguimiento", label: "Seguir mi pedido" },
    { href: "/contacto", label: "Contacto" },
  ];

  return (
    <footer className="relative mt-20 bg-ink text-neutral-300">
      <FooterWave />
      <div className="container-page grid gap-10 pb-10 pt-12 md:grid-cols-2 lg:grid-cols-[1.1fr_1.3fr_1.1fr_1fr_0.8fr]">
        <div className="space-y-4">
          <Logo logoUrl={settings.logoUrl} tone="white" name={settings.storeName} className="h-14" />
          <p className="max-w-xs text-sm leading-relaxed text-neutral-300">{settings.slogan}</p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold text-white">Enlaces rápidos</h3>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {quick.map((q) => (
              <li key={q.href}><Link href={q.href} className={link}>{q.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold text-white">Contáctanos</h3>
          <ul className="space-y-3 text-sm">
            {settings.phone && <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-white" /><a href={`tel:+51${digitsOnly(settings.phone)}`} className="hover:text-brand-soft">{settings.phone}</a></li>}
            {settings.email && <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-white" /><a href={`mailto:${settings.email}`} className="break-all hover:text-brand-soft">{settings.email}</a></li>}
            {settings.address && <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white" /><span>{settings.address}</span></li>}
            {settings.businessHours && <li className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-white" /><span>{settings.businessHours}</span></li>}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold text-white">Medios de pago</h3>
          {methods.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <span key={m} className={`rounded-md px-3 py-1.5 text-xs font-bold text-white ${CHIP[m] ?? "bg-white/15"}`}>{m}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Próximamente.</p>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold text-white">Síguenos</h3>
          {social.length > 0 ? (
            <div className="flex gap-3">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="transition hover:text-brand-soft">
                  <Icon className="h-6 w-6" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">—</p>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-neutral-400 md:flex-row">
          <p>© {new Date().getFullYear()} {settings.storeName}. Todos los derechos reservados.</p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/politicas/terminos" className="hover:text-white">Términos y condiciones</Link>
            <Link href="/politicas/privacidad" className="hover:text-white">Políticas de privacidad</Link>
            <Link href="/politicas/cambios-y-devoluciones" className="hover:text-white">Cambios y devoluciones</Link>
            <Link href="/politicas/envios" className="hover:text-white">Envíos</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

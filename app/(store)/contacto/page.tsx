import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/services/settings";
import { digitsOnly, normalizePeruPhone } from "@/lib/utils";
import { ContactForm } from "@/components/store/contact-form";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";

export const metadata: Metadata = { title: "Contacto", description: "Estamos para ayudarte. Escríbenos o visítanos.", alternates: { canonical: "/contacto" } };
export const revalidate = 300;

export default async function ContactPage() {
  const s = await getSettings();
  const social = [
    { href: s.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: s.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: s.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: s.whatsapp ? `https://wa.me/${normalizePeruPhone(s.whatsapp)}` : null, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((x) => x.href);
  const item = "flex items-start gap-4";
  const icon = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand";
  return (
    <div className="container-page py-10 sm:py-16">
      <header className="mb-10"><h1 className="text-4xl font-extrabold tracking-tight">Contáctanos</h1><p className="mt-2 text-stone">Estamos para ayudarte</p></header>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-6 rounded-3xl bg-brand-tint/50 p-6 sm:p-8">
          {s.phone && <div className={item}><span className={icon}><Phone className="h-5 w-5" /></span><div><p className="text-sm text-stone">Teléfono</p><a className="font-semibold hover:text-brand" href={`tel:+51${digitsOnly(s.phone)}`}>{s.phone}</a></div></div>}
          {s.businessHours && <div className={item}><span className={icon}><Clock className="h-5 w-5" /></span><div><p className="text-sm text-stone">Horario de atención</p><p className="font-semibold">{s.businessHours}</p></div></div>}
          {s.email && <div className={item}><span className={icon}><Mail className="h-5 w-5" /></span><div><p className="text-sm text-stone">Correo</p><a className="break-all font-semibold hover:text-brand" href={`mailto:${s.email}`}>{s.email}</a></div></div>}
          {s.address && <div className={item}><span className={icon}><MapPin className="h-5 w-5" /></span><div><p className="text-sm text-stone">Dirección</p><p className="font-semibold">{s.address}</p></div></div>}
          {social.length > 0 && (
            <div className="border-t border-brand-soft/60 pt-6">
              <p className="mb-3 text-sm font-semibold">Síguenos en nuestras redes</p>
              <div className="flex gap-2">{social.map(({ href, label, Icon }) => <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white transition hover:bg-brand"><Icon className="h-5 w-5" /></a>)}</div>
            </div>
          )}
        </section>
        <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-card sm:p-8">
          <h2 className="mb-5 text-xl font-bold">Envíanos un mensaje</h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}

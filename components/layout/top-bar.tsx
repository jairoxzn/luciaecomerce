import { CreditCard, ShieldCheck, Truck } from "lucide-react";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { enabledPaymentMethods, type Settings } from "@/lib/services/settings";
import { normalizePeruPhone } from "@/lib/utils";

const CHIP: Record<string, string> = {
  Yape: "bg-[#742284] italic",
  Plin: "bg-[#00b3c7]",
};

/**
 * Barra superior oscura. Todo sale de la configuración real de la tienda:
 * el envío gratis de las zonas, los medios de pago habilitados y las redes sociales cargadas.
 */
export function TopBar({ settings, announcement }: { settings: Settings; announcement: string | null }) {
  const pay = enabledPaymentMethods(settings);
  const methods = [pay.YAPE && "Yape", pay.PLIN && "Plin", pay.TRANSFER && "Transferencia", pay.COD && "Contra entrega"].filter(Boolean) as string[];
  const social = [
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.whatsapp ? `https://wa.me/${normalizePeruPhone(settings.whatsapp)}` : null, label: "WhatsApp", Icon: WhatsAppIcon },
  ].filter((s) => s.href);

  return (
    <div className="bg-ink text-[11px] text-white sm:text-xs">
      <div className="container-page flex min-h-9 items-center justify-center gap-x-6 py-1.5 lg:justify-between">
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 lg:justify-start">
          {announcement && (
            <li className="flex items-center gap-2 text-center">
              <Truck className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
              <span>{announcement}</span>
            </li>
          )}
          <li className="hidden items-center gap-2 border-l border-white/25 pl-5 lg:flex">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> Compra segura
          </li>
          {methods.length > 0 && (
            <li className="hidden items-center gap-2 border-l border-white/25 pl-5 lg:flex">
              <CreditCard className="h-4 w-4 shrink-0" aria-hidden /> Medios de pago
              <span className="flex items-center gap-1.5">
                {methods.map((m) => (
                  <span key={m} className={`rounded-md px-2 py-0.5 text-[10px] font-bold leading-4 text-white ${CHIP[m] ?? "bg-white/15"}`}>{m}</span>
                ))}
              </span>
            </li>
          )}
        </ul>
        {social.length > 0 && (
          <div className="hidden items-center gap-3 lg:flex">
            <span>Síguenos:</span>
            {social.map(({ href, label, Icon }) => (
              <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} className="transition hover:text-brand-soft">
                <Icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

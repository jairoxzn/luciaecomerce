import { WhatsAppIcon } from "@/components/ui/social-icons";
import { normalizePeruPhone } from "@/lib/utils";

export function WhatsAppFloat({ phone, storeName }: { phone: string | null; storeName: string }) {
  if (!phone) return null;
  const href = `https://wa.me/${normalizePeruPhone(phone)}?text=${encodeURIComponent(`Hola ${storeName}, quisiera más información.`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-110 sm:right-6"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

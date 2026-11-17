import { Headset, ShieldCheck, Truck, Wallet } from "lucide-react";
import { enabledPaymentMethods, type Settings } from "@/lib/services/settings";

/** Beneficios derivados de la configuración real (no se muestran promesas que la tienda no ofrece). */
export function Benefits({ settings, hasShipping }: { settings: Settings; hasShipping: boolean }) {
  const pay = enabledPaymentMethods(settings);
  const methods = [pay.YAPE && "Yape", pay.PLIN && "Plin", pay.TRANSFER && "Transferencia", pay.COD && "Contra entrega"].filter(Boolean) as string[];
  const items = [
    { Icon: ShieldCheck, title: "Compra segura", text: "Validamos cada pago y protegemos tus datos." },
    hasShipping && { Icon: Truck, title: "Envíos a todo el Perú", text: "Recibe tu pedido donde estés." },
    methods.length > 0 && { Icon: Wallet, title: "Múltiples pagos", text: methods.join(", ") + "." },
    (settings.whatsapp || settings.phone) && { Icon: Headset, title: "Soporte personalizado", text: settings.businessHours ?? "Estamos para ayudarte." },
  ].filter(Boolean) as { Icon: typeof Truck; title: string; text: string }[];

  return (
    <section aria-label="Beneficios de compra" className="border-y border-brand-soft/60 bg-white py-8">
      <div className="container-page grid grid-cols-2 gap-6 lg:grid-cols-4">
        {items.map(({ Icon, title, text }) => (
          <div key={title} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-stone">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings";
import { storageStatus } from "@/lib/storage";
import { whatsappEnvConfigured } from "@/lib/whatsapp";
import { mailerConfigured } from "@/lib/mailer";
import { num, formatDate } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { ZoneManager } from "@/components/admin/settings/zone-manager";

export const metadata = { title: "Configuración" };

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-mist p-4">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`} aria-hidden />
      <div><p className="text-sm font-semibold">{label} <span className="font-normal text-stone">· {ok ? "Configurado" : "No configurado"}</span></p><p className="text-xs text-stone">{detail}</p></div>
    </div>
  );
}

export default async function SettingsPage() {
  const [settings, zones, audit] = await Promise.all([
    getSettings(),
    prisma.shippingZone.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } } } }),
  ]);
  const storage = storageStatus();
  return (
    <>
      <PageHeader title="Configuración" description="Todos los datos comerciales de la tienda se administran aquí." />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Status ok={storage.configured} label={`Almacenamiento (${storage.driver})`} detail={storage.detail} />
        <Status ok={whatsappEnvConfigured()} label="WhatsApp Cloud API" detail={whatsappEnvConfigured() ? "Credenciales detectadas" : "Define WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN"} />
        <Status ok={mailerConfigured()} label="Correo saliente (SMTP)" detail={mailerConfigured() ? "Recuperación de contraseña por correo activa" : "Define SMTP_HOST, SMTP_USER y SMTP_PASS"} />
      </div>
      <SettingsForm settings={settings} whatsappEnv={whatsappEnvConfigured()} />
      <div className="mt-6 space-y-6">
        <ZoneManager zones={zones.map((z) => ({ id: z.id, name: z.name, departments: z.departments, price: num(z.price), freeShippingFrom: z.freeShippingFrom ? num(z.freeShippingFrom) : null, estimatedDays: z.estimatedDays, isActive: z.isActive, sortOrder: z.sortOrder }))} />
        <Card title="Registro de operaciones administrativas" padded={false}>
          <ul className="divide-y divide-neutral-100">
            {audit.length === 0 && <li className="p-5 text-sm text-stone">Sin registros.</li>}
            {audit.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span><strong>{a.user?.name ?? "Sistema"}</strong> · {a.action} · {a.entity}{a.entityId ? ` (${a.entityId.slice(0, 8)}…)` : ""}</span><span className="text-xs text-stone">{formatDate(a.createdAt, true)}</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}

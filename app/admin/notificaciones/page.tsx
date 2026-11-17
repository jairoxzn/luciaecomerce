import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { whatsappEnvConfigured } from "@/lib/whatsapp";
import { getSettings } from "@/lib/services/settings";
import { Card, PageHeader, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Notificaciones" };

const STATUS = { SENT: ["Enviado", "bg-green-50 text-green-700 ring-green-200"], FAILED: ["Falló", "bg-red-50 text-red-700 ring-red-200"], NOT_CONFIGURED: ["No enviado", "bg-amber-50 text-amber-700 ring-amber-200"], PENDING: ["Pendiente", "bg-neutral-100 text-neutral-600 ring-neutral-200"] } as const;

export default async function NotificationsPage() {
  const [settings, panel, wa] = await Promise.all([
    getSettings(),
    prisma.notification.findMany({ where: { forAdmin: true }, orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { id: true, code: true } } } }),
    prisma.notification.findMany({ where: { channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { id: true, code: true } } } }),
  ]);
  const active = settings.whatsappNotificationsEnabled && whatsappEnvConfigured();
  return (
    <>
      <PageHeader title="Notificaciones" description="Avisos internos y mensajes a clientes por WhatsApp." />
      <div className={`mb-6 rounded-2xl border px-5 py-4 text-sm ${active ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {active ? "La integración de WhatsApp está activa: los avisos a clientes se envían automáticamente." : <>La integración de WhatsApp <strong>no está activa</strong>: los avisos a clientes no se envían automáticamente. Puedes enviarlos manualmente con el enlace de cada registro. Configúrala en <Link href="/admin/configuracion" className="font-semibold underline">Configuración</Link> (requiere las variables WHATSAPP_* en el servidor).</>}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Avisos del panel" padded={false}>
          <ul className="divide-y divide-neutral-100">
            {panel.length === 0 && <li className="p-6 text-center text-sm text-stone">Sin notificaciones.</li>}
            {panel.map((n) => <li key={n.id} className="px-5 py-3"><p className="text-sm font-semibold">{n.title}</p><p className="text-xs text-stone">{n.body}</p><p className="mt-1 text-[11px] text-neutral-400">{formatDate(n.createdAt, true)}{n.order ? <> · <Link className="text-brand hover:underline" href={`/admin/pedidos/${n.order.id}`}>{n.order.code}</Link></> : null}</p></li>)}
          </ul>
        </Card>
        <Card title="Mensajes a clientes (WhatsApp)" padded={false}>
          <Table>
            <thead><tr><Th>Mensaje</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {wa.length === 0 && <TableEmpty cols={2} />}
              {wa.map((n) => (
                <tr key={n.id}>
                  <Td><p className="font-medium">{n.title}</p><p className="text-xs text-stone">{formatDate(n.createdAt, true)} · {n.order?.code}</p>{n.status !== "SENT" && n.recipientPhone && <a className="text-xs font-semibold text-brand hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${n.recipientPhone}?text=${encodeURIComponent(`${n.title}\n${n.body}`)}`}>Enviar manualmente →</a>}</Td>
                  <Td><Badge className={STATUS[n.status][1]}>{STATUS[n.status][0]}</Badge>{n.error && n.status === "FAILED" && <p className="mt-1 max-w-[14rem] text-xs text-red-600">{n.error}</p>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}

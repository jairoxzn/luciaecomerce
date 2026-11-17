import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { MarkReadButton } from "@/components/admin/customers/mark-read";

export const metadata = { title: "Mensajes" };

export default async function MessagesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Mensajes de contacto" description="Mensajes recibidos desde el formulario de la tienda." />
      <div className="space-y-4">
        {messages.length === 0 && <Card><p className="py-10 text-center text-stone">Todavía no hay mensajes.</p></Card>}
        {messages.map((m) => (
          <Card key={m.id} className={m.readAt ? "" : "border-brand/40 bg-brand-tint/20"}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{m.name} {!m.readAt && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Nuevo</span>}</p><a href={`mailto:${m.email}`} className="text-sm text-brand hover:underline">{m.email}</a></div>
              <p className="text-xs text-stone">{formatDate(m.createdAt, true)}</p>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
            {!m.readAt && <div className="mt-3"><MarkReadButton id={m.id} /></div>}
          </Card>
        ))}
      </div>
    </>
  );
}

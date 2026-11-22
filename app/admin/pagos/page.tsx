import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuery } from "@/lib/catalog-params";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatPEN, num } from "@/lib/utils";
import { Card, FilterTabs, PageHeader, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { Pagination } from "@/components/ui/pagination";
import { PaymentStatusBadge } from "@/components/orders/status-badges";
import { PaymentReviewActions, ProofGallery } from "@/components/admin/orders/payment-review";

export const metadata = { title: "Pagos" };
const PAGE = 15;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Tiempo que lleva esperando revisión: pasado cierto umbral se resalta para que se atienda primero. */
function waiting(since: Date) {
  const min = Math.max(0, Math.floor((Date.now() - since.getTime()) / 60_000));
  const text = min < 1 ? "hace un momento" : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.floor(min / 60)} h` : `hace ${Math.floor(min / 1440)} d`;
  const tone = min >= 120 ? "bg-red-50 text-red-700 ring-red-200" : min >= 30 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return { text, tone };
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const estado = (one(sp.estado) ?? "EN_REVISION") as PaymentStatus | "TODOS";
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const where: Prisma.PaymentWhereInput = { method: { not: "COD" }, ...(estado !== "TODOS" ? { status: estado } : {}) };

  const [total, payments, counts] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: estado === "EN_REVISION" ? { updatedAt: "asc" } : { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { order: { select: { id: true, code: true, firstName: true, lastName: true, status: true } }, proofs: { orderBy: { createdAt: "desc" } } } }),
    prisma.payment.groupBy({ by: ["status"], where: { method: { not: "COD" } }, _count: { _all: true } }),
  ]);
  const cnt = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Pagos" description="Revisa comprobantes de Yape, Plin y transferencias. Nada se aprueba automáticamente. La cola muestra primero a quien lleva más tiempo esperando." />
      <FilterTabs current={estado} hrefFor={(v) => `/admin/pagos${buildQuery(sp, { estado: v, pagina: undefined })}`} tabs={[
        { value: "EN_REVISION", label: PAYMENT_STATUS_LABEL.EN_REVISION, count: cnt("EN_REVISION") },
        { value: "PENDIENTE", label: PAYMENT_STATUS_LABEL.PENDIENTE, count: cnt("PENDIENTE") },
        { value: "APROBADO", label: PAYMENT_STATUS_LABEL.APROBADO, count: cnt("APROBADO") },
        { value: "RECHAZADO", label: PAYMENT_STATUS_LABEL.RECHAZADO, count: cnt("RECHAZADO") },
        { value: "TODOS", label: "Todos" },
      ]} />
      {estado === "EN_REVISION" ? (
        <div className="space-y-5">
          {payments.length === 0 && <Card><p className="py-10 text-center text-stone">No hay pagos pendientes de revisión. 🎉</p></Card>}
          {payments.map((p) => (
            <Card key={p.id} title={`${p.order.code} · ${PAYMENT_METHOD_LABEL[p.method]}`} action={<span className="text-lg font-extrabold text-brand">{formatPEN(num(p.amount))}</span>}>
              <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                <ProofGallery proofs={p.proofs.map((x) => ({ id: x.id, mimeType: x.mimeType, createdAt: x.createdAt.toISOString(), operationNumber: x.operationNumber }))} />
                <div className="space-y-4">
                  <div className="text-sm"><p className="font-semibold">{p.order.firstName} {p.order.lastName}</p><p className="flex flex-wrap items-center gap-2 text-stone">Enviado {formatDate(p.updatedAt, true)} <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${waiting(p.updatedAt).tone}`}>Esperando {waiting(p.updatedAt).text.replace("hace ", "")}</span></p><Link href={`/admin/pedidos/${p.order.id}`} className="font-semibold text-brand hover:underline">Ver pedido →</Link></div>
                  <PaymentReviewActions paymentId={p.id} orderCode={p.order.code} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padded={false}>
          <Table>
            <thead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Método</Th><Th>Monto</Th><Th>Estado</Th><Th>Fecha</Th></tr></thead>
            <tbody>
              {payments.length === 0 && <TableEmpty cols={6} />}
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-brand-tint/20">
                  <Td><Link href={`/admin/pedidos/${p.order.id}`} className="font-bold text-brand hover:underline">{p.order.code}</Link></Td>
                  <Td>{p.order.firstName} {p.order.lastName}</Td>
                  <Td>{PAYMENT_METHOD_LABEL[p.method]}</Td>
                  <Td className="font-semibold">{formatPEN(num(p.amount))}</Td>
                  <Td><PaymentStatusBadge status={p.status} />{p.rejectionReason && <p className="mt-1 max-w-xs text-xs text-red-600">{p.rejectionReason}</p>}</Td>
                  <Td className="whitespace-nowrap text-stone">{formatDate(p.createdAt, true)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE))} hrefFor={(n) => `/admin/pagos${buildQuery(sp, { pagina: n > 1 ? String(n) : undefined })}`} />
    </>
  );
}

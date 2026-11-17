"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { approvePaymentAction, rejectPaymentAction } from "@/app/admin/actions/orders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";

export type ProofItem = { id: string; mimeType: string; createdAt: string; operationNumber: string | null };

export function ProofGallery({ proofs }: { proofs: ProofItem[] }) {
  const [zoom, setZoom] = useState<ProofItem | null>(null);
  if (!proofs.length) return <p className="rounded-xl bg-mist px-4 py-3 text-sm text-stone">El cliente aún no adjuntó comprobante.</p>;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {proofs.map((p, i) => (
          <li key={p.id} className="space-y-1">
            <button type="button" onClick={() => setZoom(p)} className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl border border-neutral-200 bg-mist transition hover:border-brand">
              {p.mimeType.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/proofs/${p.id}`} alt={`Comprobante ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-stone"><FileText className="h-8 w-8" /> PDF</span>
              )}
            </button>
            <p className="text-xs text-stone">{i === 0 ? "Más reciente · " : ""}{formatDate(p.createdAt, true)}{p.operationNumber ? ` · Op. ${p.operationNumber}` : ""}</p>
          </li>
        ))}
      </ul>
      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Comprobante de pago" size="lg">
        {zoom && (zoom.mimeType.startsWith("image/")
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/proofs/${zoom.id}`} alt="Comprobante ampliado" className="mx-auto max-h-[70dvh] rounded-xl" />
          : <iframe src={`/api/proofs/${zoom.id}`} title="Comprobante PDF" className="h-[70dvh] w-full rounded-xl" />)}
      </Modal>
    </>
  );
}

export function PaymentReviewActions({ paymentId, orderCode }: { paymentId: string; orderCode: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function exec(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Error");
    toast.success(r.message ?? "Listo");
    setMode(null);
    setReason("");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Aprobar pago</Button>
        <Button variant="outline" className="border-red-200 text-red-600 hover:border-red-400 hover:text-red-700" onClick={() => setMode("reject")}><X className="h-4 w-4" /> Rechazar</Button>
      </div>
      <ConfirmDialog open={mode === "approve"} onClose={() => setMode(null)} loading={busy} title={`¿Aprobar el pago del pedido ${orderCode}?`} description="Confirma que verificaste el comprobante y el monto recibido. El pedido pasará a «Pago confirmado»." confirmLabel="Sí, aprobar" onConfirm={() => exec(() => approvePaymentAction(paymentId))} />
      <Modal open={mode === "reject"} onClose={() => setMode(null)} title={`Rechazar pago · ${orderCode}`} description="El cliente verá el motivo y podrá enviar otro comprobante." size="sm">
        <div className="space-y-4">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ej. El monto no coincide / la captura no es legible…" aria-label="Motivo del rechazo" data-autofocus />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => exec(() => rejectPaymentAction(paymentId, reason))}>Rechazar pago</Button></div>
        </div>
      </Modal>
    </>
  );
}

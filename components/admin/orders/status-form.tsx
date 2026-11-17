"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveOrderNoteAction, updateOrderStatusAction } from "@/app/admin/actions/orders";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import type { OrderStatus } from "@prisma/client";

export function StatusForm({ orderId, allowed }: { orderId: string; allowed: OrderStatus[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function submit() {
    if (!status) return;
    setBusy(true);
    const r = await updateOrderStatusAction({ orderId, status, note });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.message ?? "Estado actualizado");
    setStatus(""); setNote(""); setConfirmCancel(false);
    router.refresh();
  }

  if (allowed.length === 0) return <p className="rounded-xl bg-mist px-4 py-3 text-sm text-stone">Este pedido está en un estado final o requiere una acción de pago previa.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); status === "CANCELADO" ? setConfirmCancel(true) : submit(); }}>
      <Field label="Nuevo estado">
        <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} required><option value="">Selecciona…</option>{allowed.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}</Select>
      </Field>
      <Field label="Observación (visible para el cliente)"><Textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Enviado con Olva Courier, código 123456" /></Field>
      <Button type="submit" className="w-full" disabled={!status} loading={busy}>Actualizar estado</Button>
      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} loading={busy} danger title="¿Cancelar el pedido?" description="Se devolverá el stock reservado (una sola vez). Si el pago ya fue aprobado, el reembolso debe gestionarse por fuera del sistema." confirmLabel="Cancelar pedido" onConfirm={submit} />
    </form>
  );
}

export function AdminNote({ orderId, initial }: { orderId: string; initial: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <Textarea rows={3} maxLength={500} value={v} onChange={(e) => setV(e.target.value)} placeholder="Notas internas (el cliente no las ve)" aria-label="Notas internas" />
      <Button size="sm" variant="dark" loading={busy} disabled={v === initial} onClick={async () => { setBusy(true); const r = await saveOrderNoteAction(orderId, v); setBusy(false); r.ok ? (toast.success(r.message), router.refresh()) : toast.error(r.error); }}>Guardar nota</Button>
    </div>
  );
}

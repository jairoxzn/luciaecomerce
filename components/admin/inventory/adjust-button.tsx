"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { adjustInventoryAction } from "@/app/admin/actions/inventory";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function AdjustButton({ variantId, label, stock }: { variantId: string; label: string; stock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ENTRADA" | "SALIDA" | "AJUSTE">("ENTRADA");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = qty === "" ? null : mode === "ENTRADA" ? stock + Number(qty) : mode === "SALIDA" ? stock - Number(qty) : Number(qty);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajustar inventario" description={`${label} · stock actual: ${stock}`} size="sm">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await adjustInventoryAction({ variantId, mode, quantity: Number(qty), reason });
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(r.message ?? "Listo");
          setOpen(false); setQty(""); setReason("");
          router.refresh();
        }}>
          <Field label="Tipo de movimiento">
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="ENTRADA">Entrada (suma stock)</option><option value="SALIDA">Salida (resta stock)</option><option value="AJUSTE">Ajuste (fijar stock exacto)</option></Select>
          </Field>
          <Field label={mode === "AJUSTE" ? "Nuevo stock" : "Cantidad"}><Input type="number" min={mode === "AJUSTE" ? 0 : 1} required value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label="Motivo" hint="Queda registrado en el historial."><Input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Reposición de proveedor, merma, conteo físico" /></Field>
          {preview !== null && <p className={`rounded-xl px-3 py-2 text-sm ${preview < 0 ? "bg-red-50 text-red-700" : "bg-brand-tint/60"}`}>Stock resultante: <strong>{preview}</strong></p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={busy} disabled={preview !== null && preview < 0}>Registrar</Button></div>
        </form>
      </Modal>
    </>
  );
}

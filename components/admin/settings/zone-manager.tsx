"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteZoneAction, saveZoneAction } from "@/app/admin/actions/settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card } from "@/components/admin/ui";
import { PERU_DEPARTMENTS } from "@/lib/constants";
import { cn, formatPEN } from "@/lib/utils";

export type ZoneRow = { id: string; name: string; departments: string[]; price: number; freeShippingFrom: number | null; estimatedDays: string | null; isActive: boolean; sortOrder: number };
type F = { id?: string; name: string; departments: string[]; price: string; freeShippingFrom: string; estimatedDays: string; isActive: boolean; sortOrder: number };

export function ZoneManager({ zones }: { zones: ZoneRow[] }) {
  const router = useRouter();
  const [f, setF] = useState<F | null>(null);
  const [del, setDel] = useState<ZoneRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string[]> | null>(null);

  const open = (z?: ZoneRow) => { setErr(null); setF(z ? { id: z.id, name: z.name, departments: z.departments, price: String(z.price), freeShippingFrom: z.freeShippingFrom != null ? String(z.freeShippingFrom) : "", estimatedDays: z.estimatedDays ?? "", isActive: z.isActive, sortOrder: z.sortOrder } : { name: "", departments: [], price: "10", freeShippingFrom: "", estimatedDays: "", isActive: true, sortOrder: zones.length }); };

  return (
    <Card title="Zonas de entrega y costos de envío" action={<Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" /> Nueva zona</Button>}>
      {zones.length === 0 && <p className="text-sm text-stone">Sin zonas: los clientes solo podrán elegir recojo en tienda.</p>}
      <ul className="space-y-3">
        {zones.map((z) => (
          <li key={z.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{z.name} {!z.isActive && <Badge className="ml-1 bg-neutral-100 text-neutral-600 ring-neutral-200">Inactiva</Badge>}</p>
              <p className="text-sm text-stone">{formatPEN(z.price)}{z.freeShippingFrom != null ? ` · gratis desde ${formatPEN(z.freeShippingFrom)}` : ""}{z.estimatedDays ? ` · ${z.estimatedDays}` : ""}</p>
              <p className="mt-1 text-xs text-stone">{z.departments.join(", ")}</p>
            </div>
            <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => open(z)}><Pencil className="h-3.5 w-3.5" /> Editar</Button><Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(z)} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button></div>
          </li>
        ))}
      </ul>

      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? "Editar zona" : "Nueva zona"} size="lg">
        {f && (
          <form noValidate className="space-y-4" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true);
            const r = await saveZoneAction({ id: f.id, name: f.name, departments: f.departments, price: Number(f.price), freeShippingFrom: f.freeShippingFrom === "" ? null : Number(f.freeShippingFrom), estimatedDays: f.estimatedDays, isActive: f.isActive, sortOrder: f.sortOrder });
            setBusy(false);
            if (!r.ok) { setErr(r.fieldErrors ?? null); return toast.error(r.error); }
            toast.success(r.message); setF(null); router.refresh();
          }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" error={err?.name?.[0]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Tiempo estimado"><Input value={f.estimatedDays} placeholder="1 a 2 días hábiles" onChange={(e) => setF({ ...f, estimatedDays: e.target.value })} /></Field>
              <Field label="Costo de envío (S/)" error={err?.price?.[0]}><Input type="number" step="0.01" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
              <Field label="Envío gratis desde (S/, opcional)"><Input type="number" step="0.01" min={0} value={f.freeShippingFrom} onChange={(e) => setF({ ...f, freeShippingFrom: e.target.value })} /></Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Departamentos cubiertos</p>
              {err?.departments?.[0] && <p className="mb-2 text-xs font-medium text-red-600">{err.departments[0]}</p>}
              <div className="flex flex-wrap gap-2">{PERU_DEPARTMENTS.map((d) => { const on = f.departments.includes(d); return <button type="button" key={d} aria-pressed={on} onClick={() => setF({ ...f, departments: on ? f.departments.filter((x) => x !== d) : [...f.departments, d] })} className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-brand bg-brand-tint font-semibold text-brand" : "border-neutral-200 hover:border-brand")}>{d}</button>; })}</div>
            </div>
            <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Zona activa" />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setF(null)}>Cancelar</Button><Button type="submit" loading={busy}>Guardar zona</Button></div>
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={busy} danger title={`¿Eliminar la zona "${del?.name}"?`} description="Los departamentos de esta zona dejarán de tener envío a domicilio." confirmLabel="Eliminar" onConfirm={async () => { if (!del) return; setBusy(true); const r = await deleteZoneAction(del.id); setBusy(false); if (!r.ok) return toast.error(r.error); toast.success(r.message); setDel(null); router.refresh(); }} />
    </Card>
  );
}

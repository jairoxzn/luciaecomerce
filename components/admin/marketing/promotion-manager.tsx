"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePromotionAction, savePromotionAction, togglePromotionAction } from "@/app/admin/actions/marketing";
import { useOptimisticRows } from "@/hooks/use-optimistic-rows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { cn, formatDate, formatPEN, limaDateKey } from "@/lib/utils";

export type PromotionRow = { id: string; name: string; description: string | null; discountType: "PERCENT" | "FIXED"; value: number; categoryId: string | null; categoryName: string | null; startsAt: string | null; endsAt: string | null; isActive: boolean };
type F = { id?: string; name: string; description: string; discountType: "PERCENT" | "FIXED"; value: number; categoryId: string; startsAt: string; endsAt: string; isActive: boolean };
const toDate = (s: string | null) => (s ? limaDateKey(new Date(s)) : "");

function status(p: PromotionRow) {
  const now = Date.now();
  if (!p.isActive) return ["Inactiva", "bg-neutral-100 text-neutral-600 ring-neutral-200"];
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return ["Finalizada", "bg-red-50 text-red-700 ring-red-200"];
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return ["Programada", "bg-sky-50 text-sky-700 ring-sky-200"];
  return ["En curso", "bg-green-50 text-green-700 ring-green-200"];
}

export function PromotionManager({ promotions: serverPromotions, categories }: { promotions: PromotionRow[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { rows: promotions, mutate } = useOptimisticRows(serverPromotions); // los cambios se ven al instante
  const [editing, setEditing] = useState<F | null>(null);
  const [del, setDel] = useState<PromotionRow | null>(null);
  const [err, setErr] = useState<Record<string, string[]> | null>(null);
  const { register, control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<F>();
  const type = watch("discountType");

  const open = (p?: PromotionRow) => {
    const v: F = p ? { id: p.id, name: p.name, description: p.description ?? "", discountType: p.discountType, value: p.value, categoryId: p.categoryId ?? "", startsAt: toDate(p.startsAt), endsAt: toDate(p.endsAt), isActive: p.isActive } : { name: "", description: "", discountType: "PERCENT", value: 15, categoryId: "", startsAt: "", endsAt: "", isActive: true };
    reset(v); setErr(null); setEditing(v);
  };

  return (
    <>
      <Card padded={false} title="Promociones automáticas" action={<Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" /> Nueva promoción</Button>}>
        <div className="border-b border-neutral-100 bg-brand-tint/30 px-5 py-3 text-sm text-stone">Las promociones aplican un descuento <strong>automático</strong> a los precios de la tienda (sin código). Si un producto ya tiene precio de oferta, se usa el menor.</div>
        <Table>
          <thead><tr><Th>Promoción</Th><Th>Descuento</Th><Th>Aplica a</Th><Th>Vigencia</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {promotions.length === 0 && <TableEmpty cols={6} text="Aún no creaste promociones." />}
            {promotions.map((p) => {
              const [label, cls] = status(p);
              return (
                <tr key={p.id} className="hover:bg-brand-tint/20">
                  <Td><p className="font-semibold">{p.name}</p>{p.description && <p className="text-xs text-stone">{p.description}</p>}</Td>
                  <Td className="font-bold text-brand">{p.discountType === "PERCENT" ? `${p.value}%` : formatPEN(p.value)}</Td>
                  <Td>{p.categoryName ?? "Toda la tienda"}</Td>
                  <Td className="whitespace-nowrap text-xs text-stone">{p.startsAt ? formatDate(p.startsAt) : "—"} → {p.endsAt ? formatDate(p.endsAt) : "sin fin"}</Td>
                  <Td><Badge className={cls}>{label}</Badge></Td>
                  <Td className="text-right"><div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(p)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => mutate({ id: p.id, changes: { isActive: !p.isActive } }, () => togglePromotionAction(p.id))} aria-label="Activar o desactivar"><Power className={cn("h-3.5 w-3.5", p.isActive ? "text-green-600" : "text-stone")} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(p)} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar promoción" : "Nueva promoción"}>
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          const r = await savePromotionAction({ ...v, id: editing?.id, value: Number(v.value) });
          if (!r.ok) { setErr(r.fieldErrors ?? null); return toast.error(r.error); }
          toast.success(r.message); setEditing(null); router.refresh();
        })}>
          <Field label="Nombre" error={err?.name?.[0]}><Input placeholder="Semana Jeans, Cyber Lucia…" {...register("name")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><Select {...register("discountType")}><option value="PERCENT">Porcentaje (%)</option><option value="FIXED">Monto fijo (S/)</option></Select></Field>
            <Field label={type === "PERCENT" ? "Porcentaje" : "Monto (S/)"} error={err?.value?.[0]}><Input type="number" step="0.01" {...register("value", { valueAsNumber: true })} /></Field>
            <Field label="Categoría"><Select {...register("categoryId")}><option value="">Toda la tienda</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Descripción (opcional)"><Input {...register("description")} /></Field>
            <Field label="Inicio (opcional)"><Input type="date" {...register("startsAt")} /></Field>
            <Field label="Fin (opcional)" error={err?.endsAt?.[0]}><Input type="date" {...register("endsAt")} /></Field>
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Activa" />} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`¿Eliminar "${del?.name}"?`} confirmLabel="Eliminar" onConfirm={() => { if (!del) return; const d = del; setDel(null); mutate({ id: d.id, remove: true }, () => deletePromotionAction(d.id)); }} />
    </>
  );
}

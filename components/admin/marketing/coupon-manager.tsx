"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCouponAction, saveCouponAction, toggleCouponAction } from "@/app/admin/actions/marketing";
import { useOptimisticRows } from "@/hooks/use-optimistic-rows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { cn, formatDate, formatPEN, limaDateKey } from "@/lib/utils";

export type CouponRow = { id: string; code: string; description: string | null; discountType: "PERCENT" | "FIXED"; value: number; minPurchase: number | null; startsAt: string | null; expiresAt: string | null; usageLimit: number | null; usedCount: number; isPublic: boolean; isActive: boolean; categoryIds: string[] };

type F = { id?: string; code: string; description: string; discountType: "PERCENT" | "FIXED"; value: number; minPurchase: number | null; startsAt: string; expiresAt: string; usageLimit: number | null; categoryIds: string[]; isPublic: boolean; isActive: boolean };
const toDate = (s: string | null) => (s ? limaDateKey(new Date(s)) : "");
const numOrNull = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

function status(c: CouponRow) {
  const now = Date.now();
  if (!c.isActive) return ["Inactivo", "bg-neutral-100 text-neutral-600 ring-neutral-200"];
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return ["Vencido", "bg-red-50 text-red-700 ring-red-200"];
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return ["Programado", "bg-sky-50 text-sky-700 ring-sky-200"];
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return ["Agotado", "bg-amber-50 text-amber-700 ring-amber-200"];
  return ["Vigente", "bg-green-50 text-green-700 ring-green-200"];
}

export function CouponManager({ coupons: serverCoupons, categories }: { coupons: CouponRow[]; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { rows: coupons, mutate } = useOptimisticRows(serverCoupons); // los cambios se ven al instante
  const [editing, setEditing] = useState<F | null>(null);
  const [del, setDel] = useState<CouponRow | null>(null);
  const { register, control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<F>();
  const [error, setError] = useState<Record<string, string[]> | null>(null);
  const type = watch("discountType");

  const open = (c?: CouponRow) => {
    const v: F = c ? { id: c.id, code: c.code, description: c.description ?? "", discountType: c.discountType, value: c.value, minPurchase: c.minPurchase, startsAt: toDate(c.startsAt), expiresAt: toDate(c.expiresAt), usageLimit: c.usageLimit, categoryIds: c.categoryIds, isPublic: c.isPublic, isActive: c.isActive }
      : { code: "", description: "", discountType: "PERCENT", value: 10, minPurchase: null, startsAt: "", expiresAt: "", usageLimit: null, categoryIds: [], isPublic: false, isActive: true };
    reset(v); setError(null); setEditing(v);
  };

  return (
    <>
      <Card padded={false} title="Cupones de descuento" action={<Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" /> Nuevo cupón</Button>}>
        <Table>
          <thead><tr><Th>Código</Th><Th>Descuento</Th><Th>Condiciones</Th><Th>Vigencia</Th><Th>Usos</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {coupons.length === 0 && <TableEmpty cols={7} text="Aún no creaste cupones." />}
            {coupons.map((c) => {
              const [label, cls] = status(c);
              return (
                <tr key={c.id} className="hover:bg-brand-tint/20">
                  <Td><p className="font-mono font-bold">{c.code}</p>{c.isPublic && <p className="text-[11px] text-brand">Visible a clientes</p>}</Td>
                  <Td className="font-bold text-brand">{c.discountType === "PERCENT" ? `${c.value}%` : formatPEN(c.value)}</Td>
                  <Td className="text-xs text-stone">{c.minPurchase ? `Compra mín. ${formatPEN(c.minPurchase)}` : "Sin mínimo"}<br />{c.categoryIds.length ? `${c.categoryIds.length} categoría(s)` : "Todas las categorías"}</Td>
                  <Td className="whitespace-nowrap text-xs text-stone">{c.startsAt ? formatDate(c.startsAt) : "—"} → {c.expiresAt ? formatDate(c.expiresAt) : "sin vencimiento"}</Td>
                  <Td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</Td>
                  <Td><Badge className={cls}>{label}</Badge></Td>
                  <Td className="text-right"><div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => open(c)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => mutate({ id: c.id, changes: { isActive: !c.isActive } }, () => toggleCouponAction(c.id))} aria-label={c.isActive ? "Desactivar" : "Activar"}><Power className={cn("h-3.5 w-3.5", c.isActive ? "text-green-600" : "text-stone")} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(c)} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar cupón" : "Nuevo cupón"} size="lg">
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          const r = await saveCouponAction({ ...v, id: editing?.id, value: Number(v.value), minPurchase: numOrNull(v.minPurchase), usageLimit: numOrNull(v.usageLimit) });
          if (!r.ok) { setError(r.fieldErrors ?? null); return toast.error(r.error); }
          toast.success(r.message); setEditing(null); router.refresh();
        })}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código" error={error?.code?.[0]}><Input className="font-mono uppercase" {...register("code")} /></Field>
            <Field label="Tipo de descuento"><Select {...register("discountType")}><option value="PERCENT">Porcentaje (%)</option><option value="FIXED">Monto fijo (S/)</option></Select></Field>
            <Field label={type === "PERCENT" ? "Porcentaje" : "Monto (S/)"} error={error?.value?.[0]}><Input type="number" step="0.01" {...register("value", { valueAsNumber: true })} /></Field>
            <Field label="Compra mínima (S/, opcional)" error={error?.minPurchase?.[0]}><Input type="number" step="0.01" {...register("minPurchase")} /></Field>
            <Field label="Inicio (opcional)" error={error?.startsAt?.[0]}><Input type="date" {...register("startsAt")} /></Field>
            <Field label="Vencimiento (opcional)" error={error?.expiresAt?.[0]}><Input type="date" {...register("expiresAt")} /></Field>
            <Field label="Límite de usos (opcional)" error={error?.usageLimit?.[0]}><Input type="number" min={1} {...register("usageLimit")} /></Field>
            <Field label="Descripción (opcional)"><Textarea rows={1} maxLength={200} {...register("description")} /></Field>
          </div>
          <Controller control={control} name="categoryIds" render={({ field }) => (
            <div>
              <p className="mb-2 text-sm font-medium">Categorías aplicables <span className="font-normal text-stone">(ninguna = todas)</span></p>
              <div className="flex flex-wrap gap-2">{categories.map((c) => { const on = field.value?.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x) => x !== c.id) : [...(field.value ?? []), c.id])} className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-brand bg-brand-tint font-semibold text-brand" : "border-neutral-200")}>{c.name}</button>; })}</div>
            </div>
          )} />
          <div className="flex flex-wrap gap-6">
            <Controller control={control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Activo" />} />
            <Controller control={control} name="isPublic" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Mostrar en «Mis cupones»" />} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`¿Eliminar el cupón ${del?.code}?`} description="Si ya se usó en pedidos, desactívalo en su lugar." confirmLabel="Eliminar" onConfirm={() => { if (!del) return; const d = del; setDel(null); mutate({ id: d.id, remove: true }, () => deleteCouponAction(d.id)); }} />
    </>
  );
}

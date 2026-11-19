"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAddressAction, saveAddressAction, setDefaultAddressAction } from "@/app/actions/account";
import { useOptimisticRows } from "@/hooks/use-optimistic-rows";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PERU_DEPARTMENTS } from "@/lib/constants";
import { addressSchema, type AddressInput } from "@/lib/validations/auth";
import type { SavedAddress } from "@/components/checkout/types";

const empty: AddressInput = { label: "Casa", recipient: "", phone: "", department: "", province: "", district: "", line: "", reference: "", isDefault: false };

export function AddressManager({ addresses: serverAddresses, defaults }: { addresses: SavedAddress[]; defaults: { recipient: string; phone: string } }) {
  const router = useRouter();
  const { rows: addresses, mutate } = useOptimisticRows(serverAddresses); // los cambios se ven al instante
  const [editing, setEditing] = useState<AddressInput | null>(null);
  const [toDelete, setToDelete] = useState<SavedAddress | null>(null);
  const form = useForm<AddressInput>({ resolver: zodResolver(addressSchema) as never, defaultValues: empty });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  const open = (a?: SavedAddress) => {
    const v: AddressInput = a ? { id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, department: a.department, province: a.province, district: a.district, line: a.line, reference: a.reference ?? "", isDefault: a.isDefault } : { ...empty, recipient: defaults.recipient, phone: defaults.phone };
    reset(v);
    setEditing(v);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mis direcciones</h2>
        <Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" /> Nueva dirección</Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="Sin direcciones guardadas" description="Guarda tus direcciones para comprar más rápido." action={<Button onClick={() => open()}>Agregar dirección</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <article key={a.id} className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{a.label}</p>
                {a.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand"><Star className="h-3 w-3 fill-brand" /> Principal</span>}
              </div>
              <p className="mt-2 text-sm">{a.recipient} · {a.phone}</p>
              <p className="text-sm text-stone">{a.line}, {a.district}, {a.province}, {a.department}</p>
              {a.reference && <p className="text-xs text-stone">Ref.: {a.reference}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => open(a)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                {!a.isDefault && <Button size="sm" variant="soft" onClick={() => mutate({ id: a.id, changes: { isDefault: true }, others: { isDefault: false } }, () => setDefaultAddressAction(a.id), "Dirección principal actualizada")}>Hacer principal</Button>}
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(a)}><Trash2 className="h-3.5 w-3.5" /> Eliminar</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar dirección" : "Nueva dirección"} size="lg">
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async (v) => {
            const r = await saveAddressAction({ ...v, id: editing?.id });
            if (!r.ok) return toast.error(r.error);
            toast.success(r.message ?? "Guardado");
            setEditing(null);
            router.refresh();
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Etiqueta" error={errors.label?.message}><Input placeholder="Casa, Trabajo…" {...register("label")} /></Field>
            <Field label="Destinatario" error={errors.recipient?.message}><Input {...register("recipient")} /></Field>
            <Field label="Teléfono" error={errors.phone?.message}><Input type="tel" {...register("phone")} /></Field>
            <Field label="Departamento" error={errors.department?.message}><Select {...register("department")}><option value="">Selecciona…</option>{PERU_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
            <Field label="Provincia" error={errors.province?.message}><Input {...register("province")} /></Field>
            <Field label="Distrito" error={errors.district?.message}><Input {...register("district")} /></Field>
            <Field label="Dirección" error={errors.line?.message} className="sm:col-span-2"><Input {...register("line")} /></Field>
            <Field label="Referencia (opcional)" error={errors.reference?.message} className="sm:col-span-2"><Input {...register("reference")} /></Field>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#E65385]" {...register("isDefault")} /> Usar como dirección principal</label>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        danger
        title="¿Eliminar esta dirección?"
        description={toDelete ? `${toDelete.label} · ${toDelete.line}` : undefined}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (!toDelete) return;
          const d = toDelete;
          setToDelete(null);
          mutate({ id: d.id, remove: true }, () => deleteAddressAction(d.id), "Dirección eliminada");
        }}
      />
    </div>
  );
}

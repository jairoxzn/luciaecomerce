"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBannerAction, saveBannerAction } from "@/app/admin/actions/marketing";
import { useOptimisticRows } from "@/hooks/use-optimistic-rows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-upload";
import { limaDateKey } from "@/lib/utils";

export type BannerRow = { id: string; title: string; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string; mobileImageUrl: string | null; position: "HERO" | "PROMO" | "COLLECTION"; sortOrder: number; isActive: boolean; startsAt: string | null; endsAt: string | null };
type F = { id?: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string; mobileImageUrl: string | null; position: "HERO" | "PROMO" | "COLLECTION"; sortOrder: number; isActive: boolean; startsAt: string; endsAt: string };
const POS = { HERO: "Principal (carrusel)", PROMO: "Franja promocional", COLLECTION: "Colección" } as const;
const toDate = (s: string | null) => (s ? limaDateKey(new Date(s)) : "");

export function BannerManager({ banners: serverBanners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const { rows: banners, mutate } = useOptimisticRows(serverBanners); // los cambios se ven al instante
  const [editing, setEditing] = useState<F | null>(null);
  const [del, setDel] = useState<BannerRow | null>(null);
  const [err, setErr] = useState<Record<string, string[]> | null>(null);
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<F>();

  const open = (b?: BannerRow) => {
    const v: F = b ? { id: b.id, title: b.title, subtitle: b.subtitle ?? "", ctaLabel: b.ctaLabel ?? "", ctaHref: b.ctaHref ?? "", imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl, position: b.position, sortOrder: b.sortOrder, isActive: b.isActive, startsAt: toDate(b.startsAt), endsAt: toDate(b.endsAt) }
      : { title: "", subtitle: "", ctaLabel: "", ctaHref: "", imageUrl: "", mobileImageUrl: null, position: "HERO", sortOrder: banners.length, isActive: true, startsAt: "", endsAt: "" };
    reset(v); setErr(null); setEditing(v);
  };

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => open()}><Plus className="h-4 w-4" /> Nuevo banner</Button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {banners.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><p className="py-10 text-center text-stone">Aún no hay banners. Crea el primero para el inicio de la tienda.</p></Card>}
        {banners.map((b) => (
          <article key={b.id} className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="relative aspect-[16/9] bg-mist"><Image src={b.imageUrl} alt={b.title} fill sizes="400px" className="object-cover" /><div className="absolute left-3 top-3 flex gap-2"><Badge className="bg-white/90 text-ink ring-white">{POS[b.position]}</Badge>{!b.isActive && <Badge className="bg-neutral-800 text-white ring-neutral-800">Inactivo</Badge>}</div></div>
            <div className="space-y-1 p-4">
              <p className="font-bold">{b.title}</p>
              {b.subtitle && <p className="line-clamp-2 text-sm text-stone">{b.subtitle}</p>}
              <p className="text-xs text-stone">Orden {b.sortOrder}{b.ctaHref ? ` · ${b.ctaHref}` : ""}</p>
              <div className="flex gap-2 pt-2"><Button size="sm" variant="outline" onClick={() => open(b)}><Pencil className="h-3.5 w-3.5" /> Editar</Button><Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(b)}><Trash2 className="h-3.5 w-3.5" /> Eliminar</Button></div>
            </div>
          </article>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar banner" : "Nuevo banner"} size="lg">
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          const r = await saveBannerAction({ ...v, id: editing?.id, sortOrder: Number(v.sortOrder) });
          if (!r.ok) { setErr(r.fieldErrors ?? null); return toast.error(r.error); }
          toast.success(r.message); setEditing(null); router.refresh();
        })}>
          <Controller control={control} name="imageUrl" render={({ field }) => <ImageField label="Imagen del banner" folder="banners" value={field.value} onChange={(u) => field.onChange(u ?? "")} aspect="aspect-[16/10]" hint="Recomendado: 1600×1200 px o mayor (se optimiza automáticamente a WebP/AVIF)." />} />
          {err?.imageUrl?.[0] && <p className="text-xs font-medium text-red-600">{err.imageUrl[0]}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" error={err?.title?.[0]} className="sm:col-span-2"><Input {...register("title")} /></Field>
            <Field label="Subtítulo / descripción" className="sm:col-span-2"><Input {...register("subtitle")} /></Field>
            <Field label="Texto del botón"><Input placeholder="Comprar ahora" {...register("ctaLabel")} /></Field>
            <Field label="Enlace del botón" error={err?.ctaHref?.[0]}><Input placeholder="/catalogo" {...register("ctaHref")} /></Field>
            <Field label="Posición"><Select {...register("position")}>{Object.entries(POS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Orden"><Input type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} /></Field>
            <Field label="Inicio (opcional)"><Input type="date" {...register("startsAt")} /></Field>
            <Field label="Fin (opcional)" error={err?.endsAt?.[0]}><Input type="date" {...register("endsAt")} /></Field>
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Activo (visible en la tienda)" />} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title={`¿Eliminar "${del?.title}"?`} confirmLabel="Eliminar" onConfirm={() => { if (!del) return; const d = del; setDel(null); mutate({ id: d.id, remove: true }, () => deleteBannerAction(d.id)); }} />
    </>
  );
}

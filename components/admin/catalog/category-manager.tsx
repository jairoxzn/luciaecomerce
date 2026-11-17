"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategoryAction, deleteColorAction, deleteSizeAction, deleteSubcategoryAction, saveCategoryAction, saveColorAction, saveSizeAction, saveSubcategoryAction } from "@/app/admin/actions/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card, ColorDot } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-upload";

export type CategoryRow = { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; sortOrder: number; isActive: boolean; showOnHome: boolean; productCount: number; subcategories: { id: string; name: string; sortOrder: number; isActive: boolean; productCount: number }[] };

type CatForm = { id?: string; name: string; description: string; imageUrl: string | null; sortOrder: number; isActive: boolean; showOnHome: boolean };
type SubForm = { id?: string; categoryId: string; name: string; sortOrder: number; isActive: boolean };

export function CategoryManager({ categories, sizes, colors }: { categories: CategoryRow[]; sizes: { id: string; name: string; sortOrder: number }[]; colors: { id: string; name: string; hex: string }[] }) {
  const router = useRouter();
  const [cat, setCat] = useState<CatForm | null>(null);
  const [sub, setSub] = useState<SubForm | null>(null);
  const [del, setDel] = useState<{ kind: "cat" | "sub" | "size" | "color"; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const catForm = useForm<CatForm>();
  const subForm = useForm<SubForm>();
  const [size, setSize] = useState({ name: "", sortOrder: 50 });
  const [color, setColor] = useState({ name: "", hex: "#E65385" });

  const done = (r: { ok: boolean; error?: string; message?: string }, close: () => void) => {
    if (!r.ok) return toast.error(r.error ?? "Error");
    toast.success(r.message ?? "Listo");
    close();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card title="Categorías y subcategorías" action={<Button size="sm" onClick={() => { const v: CatForm = { name: "", description: "", imageUrl: null, sortOrder: categories.length, isActive: true, showOnHome: true }; catForm.reset(v); setCat(v); }}><Plus className="h-4 w-4" /> Nueva categoría</Button>} padded={false}>
        <ul className="divide-y divide-neutral-100">
          {categories.map((c) => (
            <li key={c.id} className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-mist">{c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{c.name} {!c.isActive && <Badge className="ml-1 bg-neutral-100 text-neutral-600 ring-neutral-200">Inactiva</Badge>}</p>
                  <p className="text-xs text-stone">/{c.slug} · {c.productCount} productos · orden {c.sortOrder}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { const v: CatForm = { id: c.id, name: c.name, description: c.description ?? "", imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive, showOnHome: c.showOnHome }; catForm.reset(v); setCat(v); }}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel({ kind: "cat", id: c.id, label: c.name })} aria-label={`Eliminar ${c.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 pl-0 sm:pl-[4.5rem]">
                {c.subcategories.map((s) => (
                  <span key={s.id} className="group inline-flex items-center gap-1 rounded-full bg-brand-tint/70 py-1 pl-3 pr-1 text-sm">
                    <span className={s.isActive ? "" : "line-through opacity-60"}>{s.name}</span><span className="text-xs text-stone">({s.productCount})</span>
                    <button onClick={() => { const v: SubForm = { id: s.id, categoryId: c.id, name: s.name, sortOrder: s.sortOrder, isActive: s.isActive }; subForm.reset(v); setSub(v); }} className="rounded-full p-1 text-stone hover:bg-white hover:text-brand" aria-label={`Editar ${s.name}`}><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => setDel({ kind: "sub", id: s.id, label: s.name })} className="rounded-full p-1 text-stone hover:bg-white hover:text-red-600" aria-label={`Eliminar ${s.name}`}><Trash2 className="h-3 w-3" /></button>
                  </span>
                ))}
                <button onClick={() => { const v: SubForm = { categoryId: c.id, name: "", sortOrder: c.subcategories.length, isActive: true }; subForm.reset(v); setSub(v); }} className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand px-3 py-1 text-sm font-medium text-brand hover:bg-brand-tint"><Plus className="h-3.5 w-3.5" /> Subcategoría</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tallas">
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => <span key={s.id} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 py-1 pl-3 pr-1 text-sm font-medium">{s.name}<button onClick={() => setDel({ kind: "size", id: s.id, label: s.name })} className="rounded p-1 text-stone hover:text-red-600" aria-label={`Eliminar talla ${s.name}`}><Trash2 className="h-3 w-3" /></button></span>)}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await saveSizeAction({ name: size.name, sortOrder: size.sortOrder }); done(r, () => setSize({ name: "", sortOrder: 50 })); }}>
            <Input placeholder="Nueva talla (ej. XXL, 38)" value={size.name} onChange={(e) => setSize({ ...size, name: e.target.value })} className="h-10" aria-label="Nueva talla" />
            <Input type="number" value={size.sortOrder} onChange={(e) => setSize({ ...size, sortOrder: Number(e.target.value) })} className="h-10 w-20" aria-label="Orden" />
            <Button type="submit" size="sm" disabled={!size.name}>Agregar</Button>
          </form>
        </Card>
        <Card title="Colores">
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-3 pr-1 text-sm"><ColorDot hex={c.hex} />{c.name}<button onClick={() => setDel({ kind: "color", id: c.id, label: c.name })} className="rounded-full p-1 text-stone hover:text-red-600" aria-label={`Eliminar color ${c.name}`}><Trash2 className="h-3 w-3" /></button></span>)}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await saveColorAction(color); done(r, () => setColor({ name: "", hex: "#E65385" })); }}>
            <Input placeholder="Nuevo color" value={color.name} onChange={(e) => setColor({ ...color, name: e.target.value })} className="h-10" aria-label="Nuevo color" />
            <input type="color" value={color.hex} onChange={(e) => setColor({ ...color, hex: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-neutral-200" aria-label="Elegir color" />
            <Button type="submit" size="sm" disabled={!color.name}>Agregar</Button>
          </form>
        </Card>
      </div>

      <Modal open={!!cat} onClose={() => setCat(null)} title={cat?.id ? "Editar categoría" : "Nueva categoría"}>
        <form noValidate className="space-y-4" onSubmit={catForm.handleSubmit(async (v) => { const r = await saveCategoryAction({ ...v, id: cat?.id }); done(r, () => setCat(null)); })}>
          <Field label="Nombre"><Input {...catForm.register("name", { required: true })} /></Field>
          <Field label="Descripción (opcional)"><Input {...catForm.register("description")} /></Field>
          <Controller control={catForm.control} name="imageUrl" render={({ field }) => <ImageField label="Imagen de la categoría" folder="categories" value={field.value} onChange={field.onChange} aspect="aspect-[4/5]" hint="Se muestra en el inicio y en el listado de categorías." />} />
          <Field label="Orden"><Input type="number" {...catForm.register("sortOrder", { valueAsNumber: true })} /></Field>
          <Controller control={catForm.control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Activa (visible en la tienda)" />} />
          <Controller control={catForm.control} name="showOnHome" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Mostrar en el inicio" />} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCat(null)}>Cancelar</Button><Button type="submit" loading={catForm.formState.isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>

      <Modal open={!!sub} onClose={() => setSub(null)} title={sub?.id ? "Editar subcategoría" : "Nueva subcategoría"} size="sm">
        <form noValidate className="space-y-4" onSubmit={subForm.handleSubmit(async (v) => { const r = await saveSubcategoryAction({ ...v, id: sub?.id, categoryId: sub!.categoryId }); done(r, () => setSub(null)); })}>
          <Field label="Nombre"><Input {...subForm.register("name", { required: true })} /></Field>
          <Field label="Orden"><Input type="number" {...subForm.register("sortOrder", { valueAsNumber: true })} /></Field>
          <Controller control={subForm.control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Activa" />} />
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSub(null)}>Cancelar</Button><Button type="submit" loading={subForm.formState.isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={busy} danger title={`¿Eliminar "${del?.label}"?`} description="Esta acción no se puede deshacer." confirmLabel="Eliminar" onConfirm={async () => {
        if (!del) return;
        setBusy(true);
        const fn = { cat: deleteCategoryAction, sub: deleteSubcategoryAction, size: deleteSizeAction, color: deleteColorAction }[del.kind];
        const r = await fn(del.id);
        setBusy(false);
        done(r, () => setDel(null));
      }} />
    </div>
  );
}

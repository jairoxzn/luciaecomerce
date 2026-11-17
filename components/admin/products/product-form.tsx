"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { addProductImagesAction, createProductAction, updateProductAction } from "@/app/admin/actions/products";
import { uploadImage } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Card } from "@/components/admin/ui";
import { productSchema, type ProductInput } from "@/lib/validations/admin";

export type CategoryOption = { id: string; name: string; subcategories: { id: string; name: string }[] };

export function ProductForm({ categories, product }: { categories: CategoryOption[]; product?: ProductInput & { id: string } }) {
  const router = useRouter();
  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: product ?? { name: "", sku: "", description: "", material: "", careInstructions: "", categoryId: categories[0]?.id ?? "", subcategoryId: "", price: 0, salePrice: null, status: "DRAFT", isFeatured: false, isBestSeller: false, isNew: true },
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= 10) { toast.error("Máximo 10 fotos por producto."); break; }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast.error(`${f.name}: usa JPG, PNG o WebP.`); continue; }
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name}: supera los 8 MB.`); continue; }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }
  const categoryId = useWatch({ control, name: "categoryId" });
  const subs = useMemo(() => categories.find((c) => c.id === categoryId)?.subcategories ?? [], [categories, categoryId]);

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={handleSubmit(async (v) => {
        if (product) {
          const r = await updateProductAction(product.id, v);
          if (!r.ok) return toast.error(r.error);
          toast.success(r.message ?? "Guardado");
          return router.refresh();
        }
        const r = await createProductAction(v);
        if (!r.ok || !r.data) return toast.error(r.ok ? "No se pudo crear el producto." : r.error);
        const id = r.data.id;
        // Sube las fotos elegidas y las asocia al producto recién creado
        if (files.length) {
          const urls: string[] = [];
          for (const [i, f] of files.entries()) {
            setStage(`Subiendo foto ${i + 1} de ${files.length}…`);
            try { urls.push(await uploadImage(f.file, "products")); }
            catch (e) { toast.error(`${f.file.name}: ${e instanceof Error ? e.message : "error al subir"}`); }
          }
          if (urls.length) {
            const a = await addProductImagesAction(id, urls);
            a.ok ? toast.success(`${urls.length} foto(s) agregada(s)`) : toast.error(a.error);
          }
          setStage(null);
        }
        toast.success("Producto creado. Ahora define sus variantes de color y talla.");
        router.push(`/admin/productos/${id}`);
      })}
    >
      <div className="space-y-6 lg:col-span-2">
        <Card title="Información general">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del producto" error={errors.name?.message} className="sm:col-span-2"><Input aria-invalid={!!errors.name} {...register("name")} /></Field>
            <Field label="SKU" error={errors.sku?.message} hint="Déjalo vacío para generarlo automáticamente."><Input className="uppercase" {...register("sku")} /></Field>
            <Field label="Estado" error={errors.status?.message}>
              <Select {...register("status")}><option value="DRAFT">Borrador (no visible)</option><option value="ACTIVE">Activo (publicado)</option><option value="ARCHIVED">Archivado</option></Select>
            </Field>
            <Field label="Categoría" error={errors.categoryId?.message}>
              <Select {...register("categoryId", { onChange: () => setValue("subcategoryId", "") })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Subcategoría" error={errors.subcategoryId?.message}>
              <Select {...register("subcategoryId")}><option value="">Sin subcategoría</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
            <Field label="Descripción" error={errors.description?.message} className="sm:col-span-2"><Textarea rows={5} {...register("description")} /></Field>
            <Field label="Material (opcional)" error={errors.material?.message}><Input {...register("material")} /></Field>
            <Field label="Cuidados (opcional)" error={errors.careInstructions?.message}><Input {...register("careInstructions")} /></Field>
          </div>
        </Card>

        {!product && (
          <Card title="Fotografías" action={<span className="text-xs text-stone">La primera será la imagen principal</span>}>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickFiles(e.target.files)} aria-label="Elegir fotografías del producto" />
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {files.map((f, i) => (
                <li key={f.preview} className="relative">
                  <div className={`relative aspect-[3/4] overflow-hidden rounded-xl border bg-mist ${i === 0 ? "border-brand ring-2 ring-brand/30" : "border-neutral-200"}`}>
                    <img src={f.preview} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Principal</span>}
                  </div>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-red-600 shadow-card" aria-label={`Quitar foto ${i + 1}`}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-mist px-2 text-center text-sm text-stone transition hover:border-brand hover:text-brand">
                  <ImagePlus className="h-6 w-6" /> Elegir fotos
                  <span className="text-[11px]">JPG, PNG o WebP · máx. 8 MB c/u</span>
                </button>
              </li>
            </ul>
            {files.length === 0 && <p className="mt-3 text-xs text-stone">Opcional: también podrás subir o reordenar fotos después de crear el producto.</p>}
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card title="Precios (S/)">
          <div className="space-y-4">
            <Field label="Precio regular" error={errors.price?.message}><Input type="number" step="0.01" min="0" inputMode="decimal" aria-invalid={!!errors.price} {...register("price", { valueAsNumber: true })} /></Field>
            <Field label="Precio de oferta (opcional)" error={errors.salePrice?.message} hint="Debe ser menor al precio regular. Déjalo vacío si no hay oferta.">
              <Input type="number" step="0.01" min="0" inputMode="decimal" {...register("salePrice", { setValueAs: (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v)) })} />
            </Field>
          </div>
        </Card>
        <Card title="Etiquetas">
          <div className="space-y-4">
            <Controller control={control} name="isFeatured" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Producto destacado" />} />
            <Controller control={control} name="isBestSeller" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Más vendido" />} />
            <Controller control={control} name="isNew" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Nuevo ingreso" />} />
          </div>
        </Card>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{stage ?? (product ? "Guardar cambios" : "Crear producto")}</Button>
      </div>
    </form>
  );
}

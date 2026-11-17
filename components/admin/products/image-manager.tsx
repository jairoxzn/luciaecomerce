"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addProductImagesAction, removeProductImageAction, reorderProductImagesAction, setImageColorAction } from "@/app/admin/actions/products";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/admin/ui";
import { uploadImage } from "@/components/admin/image-upload";
import { cn } from "@/lib/utils";

type Img = { id: string; url: string; colorId: string | null };

export function ImageManager({ productId, images, colors }: { productId: string; images: Img[]; colors: { id: string; name: string }[] }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const urls: string[] = [];
    let i = 0;
    for (const f of Array.from(files).slice(0, 10)) {
      i++;
      setProgress(`Subiendo ${i} de ${Math.min(files.length, 10)}…`);
      try {
        urls.push(await uploadImage(f, "products"));
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    if (urls.length) {
      const r = await addProductImagesAction(productId, urls);
      r.ok ? toast.success(`${urls.length} imagen(es) agregada(s)`) : toast.error(r.error);
      router.refresh();
    }
    setBusy(false);
    setProgress("");
    if (ref.current) ref.current.value = "";
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = images.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const r = await reorderProductImagesAction(productId, ids);
    r.ok ? router.refresh() : toast.error(r.error);
  }

  return (
    <Card title="Fotografías" action={<span className="text-xs text-stone">La primera es la imagen principal</span>}>
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Subir fotografías" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {images.map((im, idx) => (
          <li key={im.id} className="space-y-2">
            <div className={cn("group relative aspect-[3/4] overflow-hidden rounded-xl border bg-mist", idx === 0 ? "border-brand ring-2 ring-brand/30" : "border-neutral-200")}>
              <Image src={im.url} alt={`Foto ${idx + 1}`} fill sizes="200px" className="object-cover" />
              {idx === 0 && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Principal</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} className="rounded-full bg-white p-1.5 disabled:opacity-40" aria-label="Mover a la izquierda"><ArrowLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={idx === images.length - 1} onClick={() => move(idx, 1)} className="rounded-full bg-white p-1.5 disabled:opacity-40" aria-label="Mover a la derecha"><ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
                <button type="button" onClick={async () => { const r = await removeProductImageAction(im.id); r.ok ? (toast.success("Imagen eliminada"), router.refresh()) : toast.error(r.error); }} className="rounded-full bg-white p-1.5 text-red-600" aria-label="Eliminar foto"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <Select aria-label="Color asociado a la foto" className="h-9 text-xs" value={im.colorId ?? ""} onChange={async (e) => { const r = await setImageColorAction(im.id, e.target.value || null); r.ok ? router.refresh() : toast.error(r.error); }}>
              <option value="">Todos los colores</option>
              {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-mist px-2 text-center text-sm text-stone transition hover:border-brand hover:text-brand">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            {busy ? progress : "Subir fotos"}
            <span className="text-[11px]">JPG, PNG o WebP · máx. 8 MB</span>
          </button>
        </li>
      </ul>
    </Card>
  );
}

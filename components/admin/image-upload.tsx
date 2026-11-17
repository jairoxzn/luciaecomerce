"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadFolder = "products" | "banners" | "categories" | "branding";

// Las plataformas serverless (Vercel) rechazan cuerpos de petición > ~4,5 MB:
// las fotos grandes se reducen en el navegador antes de subirlas (máx. 2400 px, WebP).
const SHRINK_ABOVE = 2.5 * 1024 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file; // el navegador no pudo decodificarla: se envía el original
  }
}

export async function uploadImage(original: File, folder: UploadFolder): Promise<string> {
  if (original.type && !/^image\/(jpeg|png|webp|avif|gif)$/.test(original.type)) throw new Error(`Formato no permitido (${original.type}). Usa JPG, PNG, WebP, AVIF o GIF.`);
  if (original.size > 25 * 1024 * 1024) throw new Error("La imagen es demasiado grande (máx. 25 MB).");
  const file = await shrinkImage(original);
  if (file.size > 4 * 1024 * 1024) throw new Error("La imagen sigue siendo muy pesada (máx. 4 MB). Redúcela o usa otra foto.");
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (res.status === 413) throw new Error("La imagen es demasiado pesada para el servidor (máx. ~4 MB).");
  const data = await res.json().catch(() => ({ ok: false, error: `El servidor respondió ${res.status}.` }));
  if (!data.ok) throw new Error(data.error ?? "No se pudo subir la imagen.");
  return data.url as string;
}

/** Campo de una sola imagen (banner, categoría, logo, QR). */
export function ImageField({ value, onChange, folder, label, aspect = "aspect-video", hint }: { value: string | null | undefined; onChange: (url: string | null) => void; folder: UploadFolder; label: string; aspect?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await uploadImage(f, folder));
      toast.success("Imagen subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label={label} />
      {value ? (
        <div className={cn("group relative w-full max-w-xs overflow-hidden rounded-xl border border-neutral-200 bg-mist", aspect)}>
          <Image src={value} alt={label} fill sizes="320px" className="object-contain" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/50 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => ref.current?.click()} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold">Cambiar</button>
            <button type="button" onClick={() => onChange(null)} className="rounded-full bg-white p-1.5 text-red-600" aria-label="Quitar imagen"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={cn("flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-mist text-sm text-stone transition hover:border-brand hover:text-brand", aspect)}>
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          {busy ? "Subiendo…" : "Subir imagen"}
        </button>
      )}
      {hint && <p className="mt-1.5 text-xs text-stone">{hint}</p>}
    </div>
  );
}

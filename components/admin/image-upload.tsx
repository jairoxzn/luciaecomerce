"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadFolder = "products" | "banners" | "categories" | "branding";

export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Formato no permitido. Usa JPG, PNG o WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera los 8 MB.");
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor." }));
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
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label={label} />
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

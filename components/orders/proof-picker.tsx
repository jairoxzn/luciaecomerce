"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { shrinkImage } from "@/components/admin/image-upload";

// 4 MB: las plataformas serverless (Vercel) rechazan cuerpos de petición mayores a ~4,5 MB
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

/** Estado del comprobante elegido (archivo, vista previa y n.° de operación), compartido por el checkout y la página del pedido. */
export function useProofFile() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [op, setOp] = useState("");

  // Libera la vista previa al cambiar o desmontar
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(input: File | null) {
    if (!input) return (setFile(null), setPreview(null));
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(input.type)) return void toast.error("Formato no permitido. Usa JPG, PNG, WebP o PDF.");
    const f = input.type.startsWith("image/") ? await shrinkImage(input) : input; // las fotos grandes se reducen
    if (f.size > PROOF_MAX_BYTES) return void toast.error("El archivo supera los 4 MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  /** Envía el comprobante a un pedido ya creado. Devuelve null si salió bien, o el mensaje de error. */
  async function upload(code: string): Promise<string | null> {
    if (!file) return null;
    const fd = new FormData();
    fd.set("file", file);
    if (op) fd.set("operationNumber", op);
    try {
      const res = await fetch(`/api/orders/${code}/proof`, { method: "POST", body: fd });
      const data = await res.json();
      return data.ok ? null : (data.error ?? "No se pudo enviar el comprobante.");
    } catch {
      return "No se pudo enviar el comprobante. Revisa tu conexión.";
    }
  }

  return { file, preview, op, setOp, pick, upload };
}

export type ProofState = ReturnType<typeof useProofFile>;

/** Selector de archivo + n.° de operación. */
export function ProofFields({ proof, idPrefix = "proof" }: { proof: ProofState; idPrefix?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { file, preview, op, setOp, pick } = proof;
  return (
    <div className="space-y-4">
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="Archivo del comprobante" data-testid="proof-input" />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl bg-brand-tint/50 p-3">
          {preview ? <img src={preview} alt="Vista previa del comprobante" className="h-20 w-16 rounded-lg object-cover" /> : <FileCheck2 className="h-10 w-10 text-brand" />}
          <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-stone">{(file.size / 1024).toFixed(0)} KB</p></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { void pick(null); if (ref.current) ref.current.value = ""; }}>Quitar</Button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-mist px-4 py-8 text-sm text-stone transition hover:border-brand hover:text-brand">
          <ImagePlus className="h-8 w-8" /> Toca para elegir una imagen o PDF (máx. 4 MB)
        </button>
      )}
      <div>
        <Label htmlFor={`${idPrefix}-op`}>N.° de operación (opcional)</Label>
        <Input id={`${idPrefix}-op`} value={op} onChange={(e) => setOp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} maxLength={40} placeholder="Ej. 01234567" />
      </div>
    </div>
  );
}

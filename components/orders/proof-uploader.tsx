"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, ImagePlus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { shrinkImage } from "@/components/admin/image-upload";

// 4 MB: las plataformas serverless (Vercel) rechazan cuerpos de petición mayores a ~4,5 MB
const MAX = 4 * 1024 * 1024;

export function ProofUploader({ code, rejected }: { code: string; rejected?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [op, setOp] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(input: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!input) return (setFile(null), setPreview(null));
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(input.type)) return toast.error("Formato no permitido. Usa JPG, PNG, WebP o PDF.");
    const f = input.type.startsWith("image/") ? await shrinkImage(input) : input; // las fotos grandes se reducen
    if (f.size > MAX) return toast.error("El archivo supera los 4 MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    if (op) fd.set("operationNumber", op);
    try {
      const res = await fetch(`/api/orders/${code}/proof`, { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success("Comprobante enviado. Lo revisaremos en breve.");
      setFile(null);
      setPreview(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el comprobante.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-brand-soft bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold">{rejected ? "Envía un nuevo comprobante" : "Sube tu comprobante de pago"}</p>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="Archivo del comprobante" />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl bg-brand-tint/50 p-3">
          {preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Vista previa del comprobante" className="h-20 w-16 rounded-lg object-cover" /> : <FileCheck2 className="h-10 w-10 text-brand" />}
          <div className="min-w-0 flex-1 text-sm"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-stone">{(file.size / 1024).toFixed(0)} KB</p></div>
          <Button variant="ghost" size="sm" onClick={() => { pick(null); if (ref.current) ref.current.value = ""; }}>Quitar</Button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-mist px-4 py-8 text-sm text-stone transition hover:border-brand hover:text-brand">
          <ImagePlus className="h-8 w-8" /> Toca para elegir una imagen o PDF (máx. 4 MB)
        </button>
      )}
      <div>
        <Label htmlFor="op">N.° de operación (opcional)</Label>
        <Input id="op" value={op} onChange={(e) => setOp(e.target.value)} maxLength={40} placeholder="Ej. 01234567" />
      </div>
      <Button onClick={submit} loading={busy} disabled={!file} className="w-full" size="lg"><UploadCloud className="h-4 w-4" /> Enviar comprobante</Button>
    </div>
  );
}

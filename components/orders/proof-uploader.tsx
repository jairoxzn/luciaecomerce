"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProofFields, useProofFile } from "./proof-picker";

export function ProofUploader({ code, rejected }: { code: string; rejected?: boolean }) {
  const router = useRouter();
  const proof = useProofFile();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!proof.file) return;
    setBusy(true);
    const error = await proof.upload(code);
    setBusy(false);
    if (error) return void toast.error(error);
    toast.success("Comprobante enviado. Lo revisaremos en breve.");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-brand-soft bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold">{rejected ? "Envía un nuevo comprobante" : "Sube tu comprobante de pago"}</p>
      <ProofFields proof={proof} idPrefix="order-proof" />
      <Button onClick={submit} loading={busy} disabled={!proof.file} className="w-full" size="lg"><UploadCloud className="h-4 w-4" /> Enviar comprobante</Button>
    </div>
  );
}

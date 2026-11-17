"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  return (
    <Button size="sm" variant="soft" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Código copiado"), () => toast.error("No se pudo copiar"))}>
      <Copy className="h-3.5 w-3.5" /> Copiar
    </Button>
  );
}

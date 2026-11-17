"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { generateResetLinkAction, toggleCustomerActiveAction } from "@/app/admin/actions/customers";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Modal } from "@/components/ui/modal";

export function CustomerActions({ userId, isActive, isAdmin }: { userId: string; isActive: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (isAdmin) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={async () => { const r = await generateResetLinkAction(userId); r.ok ? setLink(r.data!.link) : toast.error(r.error); }}><KeyRound className="h-4 w-4" /> Enlace de recuperación</Button>
      <Button size="sm" variant={isActive ? "outline" : "primary"} className={isActive ? "text-red-600" : ""} onClick={() => setConfirm(true)}>{isActive ? <><UserX className="h-4 w-4" /> Desactivar</> : <><UserCheck className="h-4 w-4" /> Reactivar</>}</Button>
      <Modal open={!!link} onClose={() => setLink(null)} title="Enlace de recuperación" description="Compártelo solo con el titular de la cuenta. Vence en 1 hora y se usa una sola vez." size="md">
        <div className="space-y-3">
          <input readOnly value={link ?? ""} onFocus={(e) => e.currentTarget.select()} className="h-11 w-full rounded-xl border border-neutral-200 bg-mist px-3 text-xs" aria-label="Enlace" />
          <Button onClick={() => navigator.clipboard.writeText(link ?? "").then(() => toast.success("Enlace copiado"))}><Copy className="h-4 w-4" /> Copiar enlace</Button>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} loading={busy} danger={isActive} title={isActive ? "¿Desactivar esta cuenta?" : "¿Reactivar esta cuenta?"} description={isActive ? "El cliente no podrá iniciar sesión y se cerrarán sus sesiones activas." : undefined} confirmLabel={isActive ? "Desactivar" : "Reactivar"} onConfirm={async () => { setBusy(true); const r = await toggleCustomerActiveAction(userId); setBusy(false); if (!r.ok) return toast.error(r.error); toast.success(r.message); setConfirm(false); router.refresh(); }} />
    </>
  );
}

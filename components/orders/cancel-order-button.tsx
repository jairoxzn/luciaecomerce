"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelMyOrderAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Cancelar pedido</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={busy}
        danger
        title="¿Cancelar este pedido?"
        description="Liberaremos las unidades reservadas. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        onConfirm={async () => {
          setBusy(true);
          const r = await cancelMyOrderAction(orderId);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(r.message ?? "Pedido cancelado");
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

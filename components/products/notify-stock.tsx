"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { subscribeStockAlertAction } from "@/app/actions/stock-alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KEY = "lj-stock-alert-contact";

/**
 * «Avísame cuando haya stock» para una variante agotada. Pide correo o celular (basta uno) y lo recuerda en el
 * navegador para no volver a escribirlo en la siguiente talla.
 */
export function NotifyStock({ variantId, label }: { variantId: string; label: string }) {
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);

  useEffect(() => {
    try {
      setContact(localStorage.getItem(KEY) ?? "");
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = contact.trim();
    if (!value) return toast.error("Escribe tu correo o tu celular.");
    const isEmail = value.includes("@");
    setBusy(true);
    const res = await subscribeStockAlertAction({ variantId, ...(isEmail ? { email: value } : { phone: value }) });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* noop */
    }
    setDoneFor(variantId);
  }

  if (doneFor === variantId) {
    return (
      <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p><strong>¡Listo!</strong> Te avisaremos apenas vuelva a haber stock de {label}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-dashed border-brand-soft bg-brand-tint/40 p-4" aria-label="Avísame cuando haya stock">
      <p className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-brand" /> Esta talla está agotada</p>
      <p className="mt-1 text-xs text-stone">Déjanos tu correo o tu celular y te avisamos cuando vuelva ({label}).</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Correo o celular (987654321)" aria-label="Correo o celular para el aviso" autoComplete="email" maxLength={120} className="sm:flex-1" />
        <Button type="submit" loading={busy}>Avísame</Button>
      </div>
    </form>
  );
}

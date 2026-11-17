"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { lookupOrderAction } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function TrackForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-5 rounded-3xl border border-neutral-100 bg-white p-6 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await lookupOrderAction({ code, email });
        setBusy(false);
        if (!r.ok) {
          setError(r.error);
          return toast.error(r.error);
        }
        router.push(`/pedidos/${r.data!.code}`);
      }}
    >
      <Field label="Código de pedido"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LJ-261113-ABCDE" required autoComplete="off" /></Field>
      <Field label="Correo electrónico" error={error ?? undefined}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>Consultar pedido</Button>
    </form>
  );
}

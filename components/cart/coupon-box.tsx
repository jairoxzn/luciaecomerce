"use client";

import { useState } from "react";
import { Tag, X, CheckCircle2 } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Quote } from "@/lib/services/cart";

export function CouponBox({ quote }: { quote: Quote | null }) {
  const couponCode = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const [value, setValue] = useState("");
  const applied = !!quote?.couponId;

  if (couponCode && applied) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" /> Cupón <strong>{quote?.couponCode}</strong> aplicado
        </span>
        <button onClick={() => setCoupon(null)} className="rounded-full p-1 hover:bg-emerald-100" aria-label="Quitar cupón">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const apply = () => {
    if (value.trim()) setCoupon(value.trim().toUpperCase());
  };

  // No usa <form>: este componente también se muestra dentro del formulario del checkout
  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" aria-hidden />
          <Input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} placeholder="Código de cupón" className="pl-10 uppercase" aria-label="Código de cupón" maxLength={40} />
        </div>
        <Button type="button" onClick={apply} variant="dark" size="md" disabled={!value.trim()}>
          Aplicar
        </Button>
      </div>
      {couponCode && quote?.couponError && (
        <p role="alert" className="mt-2 flex items-start justify-between gap-2 text-xs font-medium text-red-600">
          <span>{quote.couponError}</span>
          <button type="button" onClick={() => setCoupon(null)} className="underline">
            Quitar
          </button>
        </p>
      )}
    </div>
  );
}

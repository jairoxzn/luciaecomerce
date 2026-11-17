"use client";

import Link from "next/link";
import { ShoppingBag, ShieldCheck } from "lucide-react";
import { useCartQuote } from "@/hooks/use-cart-quote";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CartLineItem } from "./cart-line";
import { CartSummary } from "./cart-summary";
import { CouponBox } from "./coupon-box";

export function CartPageView() {
  const { quote, loading, empty, hydrated } = useCartQuote();

  if (!hydrated || (!quote && !empty)) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (empty || !quote) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Tu carrito está vacío"
        description="Agrega tus prendas favoritas y vuelve aquí para finalizar la compra."
        action={<LinkButton href="/catalogo">Descubrir productos</LinkButton>}
      />
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <ul className="space-y-3">
        {quote.lines.map((l) => (
          <CartLineItem key={l.variantId} line={l} />
        ))}
      </ul>
      <aside className="space-y-5 rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Resumen del pedido</h2>
        <CouponBox quote={quote} />
        <div className={loading ? "opacity-60 transition" : "transition"}>
          <CartSummary quote={quote} />
        </div>
        {quote.hasBlockingIssues && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Hay productos agotados o no disponibles. Elimínalos o cambia la variante para continuar.</p>}
        <LinkButton href="/checkout" size="lg" className={`w-full ${quote.hasBlockingIssues ? "pointer-events-none opacity-50" : ""}`} aria-disabled={quote.hasBlockingIssues}>
          Continuar con la compra
        </LinkButton>
        <Link href="/catalogo" className="block text-center text-sm font-medium text-stone underline-offset-4 hover:text-brand hover:underline">Seguir comprando</Link>
        <p className="flex items-center justify-center gap-1.5 text-xs text-stone"><ShieldCheck className="h-4 w-4 text-brand" /> Los importes se validan en el servidor</p>
      </aside>
    </div>
  );
}

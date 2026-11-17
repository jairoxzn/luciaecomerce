"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useCartQuote } from "@/hooks/use-cart-quote";
import { Modal } from "@/components/ui/modal";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CartLineItem } from "./cart-line";
import { CartSummary } from "./cart-summary";
import { CouponBox } from "./coupon-box";

export function CartDrawer() {
  const open = useCart((s) => s.drawerOpen);
  const close = useCart((s) => s.closeDrawer);
  const { quote, loading, empty } = useCartQuote({ enabled: open });

  return (
    <Modal open={open} onClose={close} title="Tu carrito" side="right">
      {empty ? (
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          description="Explora nuestras colecciones y encuentra tu próximo look."
          action={
            <LinkButton href="/catalogo" onClick={close}>
              Ver catálogo
            </LinkButton>
          }
        />
      ) : !quote ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="space-y-3">
            {quote.lines.map((l) => (
              <CartLineItem key={l.variantId} line={l} compact />
            ))}
          </ul>
          <CouponBox quote={quote} />
          <div className={loading ? "opacity-60 transition" : "transition"}>
            <CartSummary quote={quote} />
          </div>
          <div className="grid gap-2">
            <LinkButton href="/checkout" size="lg" onClick={close} className={quote.hasBlockingIssues ? "pointer-events-none opacity-50" : ""} aria-disabled={quote.hasBlockingIssues}>
              Finalizar compra
            </LinkButton>
            <Link href="/carrito" onClick={close} className="text-center text-sm font-medium text-stone underline-offset-4 hover:text-brand hover:underline">
              Ver carrito completo
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

import { formatPEN } from "@/lib/utils";
import type { Quote } from "@/lib/services/cart";

export function CartSummary({ quote, shippingNote }: { quote: Quote; shippingNote?: string }) {
  const row = "flex items-center justify-between text-sm";
  return (
    <dl className="space-y-2.5">
      <div className={row}>
        <dt className="text-stone">Subtotal ({quote.itemCount} {quote.itemCount === 1 ? "producto" : "productos"})</dt>
        <dd className="font-medium">{formatPEN(quote.subtotalCents / 100)}</dd>
      </div>
      {quote.discountCents > 0 && (
        <div className={row}>
          <dt className="text-emerald-700">Descuento {quote.couponCode ? `(${quote.couponCode})` : ""}</dt>
          <dd className="font-medium text-emerald-700">-{formatPEN(quote.discountCents / 100)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-stone">Envío</dt>
        <dd className="font-medium">
          {quote.shippingCents === null ? <span className="text-stone">{shippingNote ?? "Se calcula en el checkout"}</span> : quote.shippingCents === 0 ? <span className="text-emerald-700">Gratis</span> : formatPEN(quote.shippingCents / 100)}
        </dd>
      </div>
      <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="text-xl font-bold text-brand">{formatPEN(quote.totalCents / 100)}</dd>
      </div>
    </dl>
  );
}

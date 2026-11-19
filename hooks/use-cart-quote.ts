"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { quoteCartAction } from "@/app/actions/cart";
import type { Quote } from "@/lib/services/cart";
import { useCart } from "./use-cart";

type Delivery = { method: "DELIVERY" | "PICKUP"; department?: string | null } | null;

/**
 * Cotiza el carrito en el servidor (precios, stock, cupón y envío vigentes).
 * Los importes mostrados SIEMPRE provienen de esta respuesta, nunca del estado local.
 */
export function useCartQuote(opts: { delivery?: Delivery; enabled?: boolean } = {}) {
  const { enabled = true, delivery = null } = opts;
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const hydrated = useCart((s) => s.hydrated);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const key = JSON.stringify({ items, couponCode, delivery });

  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (items.length === 0) {
      setQuote(null);
      setLoading(false);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await quoteCartAction({ items, couponCode: couponCode ?? undefined, delivery });
      if (my !== seq.current) return; // respuesta obsoleta
      if (res.ok && res.data) {
        setQuote(res.data);
        setError(null);
        // Reconcilia el carrito local con la realidad del servidor (variantes eliminadas / stock reducido)
        const lines = res.data.lines;
        const store = useCart.getState();
        let changed = false;
        const next = store.items
          .filter((i) => {
            const keep = lines.some((l) => l.variantId === i.variantId);
            if (!keep) changed = true;
            return keep;
          })
          .map((i) => {
            const l = lines.find((x) => x.variantId === i.variantId);
            if (l && l.issue === "REDUCED") {
              changed = true;
              return { ...i, quantity: l.quantity };
            }
            return i;
          });
        if (changed) store.replaceAll(next);
      } else if (!res.ok) {
        setError(res.error);
      }
      setLoading(false);
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, hydrated]);

  // Líneas "optimistas": al quitar un producto desaparece al instante, sin esperar a la nueva cotización.
  // Si hay una variante nueva aún sin cotizar (cambio de color/talla en curso) se muestran las líneas tal cual llegaron.
  const lines = useMemo(() => {
    if (!quote) return null;
    const local = new Set(items.map((i) => i.variantId));
    const known = new Set(quote.lines.map((l) => l.variantId));
    if (items.some((i) => !known.has(i.variantId))) return quote.lines;
    return quote.lines.filter((l) => local.has(l.variantId));
  }, [quote, items]);

  return { quote, lines, loading, error, empty: hydrated && items.length === 0, hydrated };
}

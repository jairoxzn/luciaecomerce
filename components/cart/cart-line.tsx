"use client";

import { memo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { getVariantOptionsAction, type VariantOption } from "@/app/actions/cart";
import { useCart } from "@/hooks/use-cart";
import { MAX_CART_QTY } from "@/lib/constants";
import { cn, formatPEN } from "@/lib/utils";
import type { CartLine } from "@/lib/services/cart";
import { Select } from "@/components/ui/input";

type Props = { line: CartLine; compact?: boolean; readOnly?: boolean };

// CartLine es plano (solo valores primitivos): si una nueva cotización trae la misma línea sin cambios, no se re-renderiza.
// (Cambiar la cantidad de un producto ya no repinta los demás del carrito.)
const sameProps = (a: Props, b: Props) =>
  a.compact === b.compact && a.readOnly === b.readOnly && (Object.keys(a.line) as (keyof CartLine)[]).every((k) => a.line[k] === b.line[k]);

export const CartLineItem = memo(function CartLineItem({ line, compact = false, readOnly = false }: Props) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const changeVariant = useCart((s) => s.changeVariant);
  const closeDrawer = useCart((s) => s.closeDrawer);
  // Cantidad local: los botones +/− responden al instante; el importe se actualiza cuando llega la cotización del servidor
  const local = useCart((s) => s.items.find((i) => i.variantId === line.variantId)?.quantity);
  const [options, setOptions] = useState<VariantOption[] | null>(null);
  const [pending, start] = useTransition();

  const unavailable = line.issue === "UNAVAILABLE" || line.issue === "OUT_OF_STOCK";
  const max = Math.min(MAX_CART_QTY, line.stock);
  const qty = unavailable ? line.requested : Math.min(local ?? line.quantity, max);
  const amountStale = !unavailable && qty !== line.quantity; // el importe mostrado aún es el de la cantidad anterior

  function openChange() {
    if (options) return setOptions(null);
    start(async () => setOptions(await getVariantOptionsAction(line.productId)));
  }

  return (
    <li className={cn("flex gap-3 rounded-2xl border border-neutral-100 bg-white p-3", unavailable && "bg-neutral-50")}>
      <Link href={`/productos/${line.slug}`} onClick={closeDrawer} className={cn("relative shrink-0 overflow-hidden rounded-xl bg-brand-tint/50", compact ? "h-24 w-20" : "h-28 w-24 sm:h-32 sm:w-28")}>
        {line.image && <Image src={line.image} alt={line.name} fill sizes="120px" className={cn("object-cover", unavailable && "opacity-50 grayscale")} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/productos/${line.slug}`} onClick={closeDrawer} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-brand">
              {line.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone">
              <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: line.colorHex }} aria-hidden />
              {line.colorName} · Talla {line.sizeName}
            </p>
          </div>
          {!readOnly && (
            <button
              onClick={() => {
                remove(line.variantId);
                toast("Producto eliminado del carrito");
              }}
              className="rounded-full p-1.5 text-stone transition hover:bg-red-50 hover:text-red-600"
              aria-label={`Eliminar ${line.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {line.issue === "OUT_OF_STOCK" && <p className="mt-1 text-xs font-semibold text-red-600">Agotado: elimínalo o cambia la variante.</p>}
        {line.issue === "UNAVAILABLE" && <p className="mt-1 text-xs font-semibold text-red-600">Ya no está disponible.</p>}
        {line.issue === "REDUCED" && <p className="mt-1 text-xs font-semibold text-amber-600">Cantidad ajustada al stock disponible.</p>}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {readOnly ? (
            <span className="text-sm text-stone">x{qty}</span>
          ) : (
            <div className="inline-flex items-center rounded-full border border-neutral-200">
              <button
                onClick={() => setQuantity(line.variantId, qty - 1)}
                disabled={unavailable}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-brand-tint disabled:opacity-40"
                aria-label="Disminuir cantidad"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button
                onClick={() => (qty >= max ? toast.warning(`Solo hay ${line.stock} unidades disponibles`) : setQuantity(line.variantId, qty + 1))}
                disabled={unavailable}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-brand-tint disabled:opacity-40"
                aria-label="Aumentar cantidad"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className={cn("text-right transition-opacity", amountStale && "opacity-50")} aria-busy={amountStale}>
            {line.onSale && <p className="text-xs text-stone line-through">{formatPEN((line.regularCents * line.quantity) / 100)}</p>}
            <p className="text-sm font-bold">{unavailable ? "—" : formatPEN(line.lineCents / 100)}</p>
          </div>
        </div>

        {!readOnly && (
          <div className="mt-2">
            <button onClick={openChange} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              <Repeat className="h-3 w-3" /> {pending ? "Cargando…" : "Cambiar color / talla"}
            </button>
            {options && (
              <Select
                aria-label="Cambiar variante"
                className="mt-2 h-9 text-xs"
                value={line.variantId}
                onChange={(e) => {
                  changeVariant(line.variantId, e.target.value);
                  setOptions(null);
                }}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.stock <= 0 && o.id !== line.variantId}>
                    {o.colorName} · Talla {o.sizeName} {o.stock <= 0 ? "(agotado)" : `(${o.stock} disp.)`}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
      </div>
    </li>
  );
}, sameProps);

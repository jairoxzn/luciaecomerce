"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { getVariantOptionsAction, type VariantOption } from "@/app/actions/cart";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { addToCart } from "@/components/cart/add-to-cart";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/services/catalog";

export function QuickBuyModal({ product, open, onClose }: { product: ProductCardData; open: boolean; onClose: () => void }) {
  const [options, setOptions] = useState<VariantOption[] | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!open || options) return;
    getVariantOptionsAction(product.id).then((o) => {
      setOptions(o);
      const firstAvail = o.find((x) => x.stock > 0) ?? o[0];
      if (firstAvail) setColor(firstAvail.colorName);
    });
  }, [open, options, product.id]);

  const colors = useMemo(() => (options ? [...new Map(options.map((o) => [o.colorName, o.colorHex])).entries()] : []), [options]);
  const sizesForColor = useMemo(() => options?.filter((o) => o.colorName === color) ?? [], [options, color]);
  const selected = sizesForColor.find((o) => o.sizeName === size) ?? null;

  useEffect(() => {
    if (size && !sizesForColor.some((o) => o.sizeName === size && o.stock > 0)) setSize(null);
  }, [color, sizesForColor, size]);

  return (
    <Modal open={open} onClose={onClose} title={product.name} size="md">
      <div className="flex gap-4">
        <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-brand-tint/50 sm:w-36">
          {product.image && <Image src={product.image} alt={product.name} fill sizes="150px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <Price price={selected?.priceCents ? selected.priceCents / 100 : product.price} compareAt={product.compareAt} size="lg" />
          {!options ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : options.length === 0 ? (
            <p className="mt-4 text-sm text-stone">Este producto no tiene variantes disponibles.</p>
          ) : (
            <>
              <p className="mt-4 text-sm font-medium">Color: <span className="text-stone">{color}</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map(([name, hex]) => (
                  <button
                    key={name}
                    onClick={() => setColor(name)}
                    aria-label={name}
                    aria-pressed={color === name}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/15 transition", color === name && "ring-2 ring-brand ring-offset-2")}
                    style={{ background: hex }}
                  >
                    {color === name && <Check className={cn("h-4 w-4", hex.toLowerCase() === "#ffffff" ? "text-ink" : "text-white")} />}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm font-medium">Talla</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sizesForColor.map((o) => (
                  <button
                    key={o.id}
                    disabled={o.stock <= 0}
                    onClick={() => setSize(o.sizeName)}
                    aria-pressed={size === o.sizeName}
                    className={cn(
                      "min-w-11 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      size === o.sizeName ? "border-brand bg-brand text-white" : "border-neutral-200 hover:border-brand",
                      o.stock <= 0 && "cursor-not-allowed border-dashed text-neutral-300 line-through hover:border-neutral-200",
                    )}
                  >
                    {o.sizeName}
                  </button>
                ))}
              </div>
              {selected && <p className={cn("mt-3 text-xs font-medium", selected.stock <= 3 ? "text-amber-600" : "text-emerald-700")}>{selected.stock <= 3 ? `¡Últimas ${selected.stock} unidades!` : `${selected.stock} disponibles`}</p>}
            </>
          )}
        </div>
      </div>

      {options && options.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-neutral-200">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-tint" aria-label="Menos"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(selected?.stock ?? 10, 10, q + 1))} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-tint" aria-label="Más"><Plus className="h-4 w-4" /></button>
            </div>
            <Button
              className="flex-1"
              size="lg"
              disabled={!selected}
              onClick={() => {
                if (!selected) return;
                if (addToCart({ variantId: selected.id, quantity: qty, stock: selected.stock, name: product.name })) onClose();
              }}
            >
              {selected ? "Agregar al carrito" : "Elige una talla"}
            </Button>
          </div>
          <Link href={`/productos/${product.slug}`} onClick={onClose} className="block text-center text-sm font-medium text-stone underline-offset-4 hover:text-brand hover:underline">
            Ver detalles del producto
          </Link>
        </div>
      )}
    </Modal>
  );
}

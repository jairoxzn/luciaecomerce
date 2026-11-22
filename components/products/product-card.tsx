"use client";

import { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { Price } from "@/components/ui/price";
import { cn, formatPEN } from "@/lib/utils";
import type { ProductCardData } from "@/lib/services/catalog";
import { FavoriteButton } from "./favorite-button";
import { QuickBuyModal } from "./quick-buy";

type Variant = "default" | "boxed";

// memo: una tarjeta no se vuelve a renderizar si su producto no cambió (p. ej. al abrir el carrito o marcar otro favorito)
export const ProductCard = memo(function ProductCard({ product, priority = false, className, variant = "default" }: { product: ProductCardData; priority?: boolean; className?: string; variant?: Variant }) {
  const [quick, setQuick] = useState(false);
  const p = product;
  const boxed = variant === "boxed";
  const sizes = boxed ? "(min-width:1280px) 20vw, (min-width:768px) 33vw, 50vw" : "(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw";

  return (
    <article className={cn("group/card relative flex flex-col", boxed && "overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 transition hover:border-brand-soft hover:shadow-card", className)}>
      <div className={cn("relative overflow-hidden", boxed ? "aspect-[5/4] rounded-xl bg-[#f3f3f3]" : "aspect-[3/4] rounded-2xl bg-brand-tint/40")}>
        <Link href={`/productos/${p.slug}`} className="absolute inset-0" aria-label={p.name}>
          {p.image ? (
            <>
              <Image
                src={p.image}
                alt={p.name}
                fill
                priority={priority}
                sizes={sizes}
                className={cn("object-cover transition duration-500 group-hover/card:scale-105", p.image2 && "group-hover/card:opacity-0", !p.inStock && "grayscale-[40%]")}
              />
              {p.image2 && <Image src={p.image2} alt="" fill sizes={sizes} className="object-cover opacity-0 transition duration-500 group-hover/card:scale-105 group-hover/card:opacity-100" />}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone">Sin imagen</div>
          )}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {p.discountPct > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-soft">-{p.discountPct}%</span>}
          {p.isNew && <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold text-white", boxed ? "bg-[#1ea7e1]" : "bg-ink")}>{boxed ? "NUEVO" : "Nuevo"}</span>}
          {p.isBestSeller && !p.isNew && !boxed && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand shadow-card">Más vendido</span>}
          {p.lowStock && !boxed && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Últimas unidades</span>}
        </div>
        <FavoriteButton productId={p.id} name={p.name} className="absolute right-2.5 top-2.5" />

        {!p.inStock && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/75 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">Agotado</span>
        )}

        {/* Compra rápida: en escritorio aparece una barra al pasar el cursor; en táctil, un botón redondo siempre visible */}
        {!boxed && p.inStock && (
          <>
            <button
              type="button"
              onClick={() => setQuick(true)}
              aria-label={`Agregar ${p.name} al carrito`}
              className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-card transition hover:bg-brand hover:text-white active:scale-90 lg:hidden"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
            </button>
            <div className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-3 opacity-0 transition duration-300 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 lg:block">
              <button
                type="button"
                onClick={() => setQuick(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/95 text-sm font-semibold text-ink shadow-card backdrop-blur transition hover:bg-brand hover:text-white active:scale-[0.97]"
              >
                <ShoppingBag className="h-4 w-4" /> Compra rápida
              </button>
            </div>
          </>
        )}
      </div>

      {boxed ? (
        <div className="flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-3">
          <Link href={`/productos/${p.slug}`} className="line-clamp-1 text-sm font-medium transition hover:text-brand">
            {p.name}
          </Link>
          <p className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-brand">{formatPEN(p.price)}</span>
            {p.compareAt ? <span className="text-xs text-stone line-through">{formatPEN(p.compareAt)}</span> : null}
          </p>
          <button
            type="button"
            onClick={() => setQuick(true)}
            disabled={!p.inStock}
            className="mt-1.5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink text-xs font-semibold text-white transition hover:bg-brand active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            <ShoppingCart className="h-4 w-4" />
            {p.inStock ? "Agregar al carrito" : "Agotado"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col gap-1.5 px-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone">{p.categoryName}</p>
          <Link href={`/productos/${p.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug transition hover:text-brand">
            {p.name}
          </Link>
          {p.colors.length > 1 && (
            <div className="flex items-center gap-1" aria-label={`Colores: ${p.colors.map((c) => c.name).join(", ")}`}>
              {p.colors.slice(0, 5).map((c) => (
                <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />
              ))}
              {p.colors.length > 5 && <span className="text-[11px] text-stone">+{p.colors.length - 5}</span>}
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <Price price={p.price} compareAt={p.compareAt} />
            {p.discountPct > 0 && p.compareAt ? <span className="text-[11px] font-semibold text-emerald-600">Ahorras {formatPEN(p.compareAt - p.price)}</span> : null}
          </div>
        </div>
      )}

      {quick && <QuickBuyModal product={p} open={quick} onClose={() => setQuick(false)} />}
    </article>
  );
});

export function ProductGrid({ products, className, variant = "default" }: { products: ProductCardData[]; className?: string; variant?: Variant }) {
  return (
    <div className={cn(variant === "boxed" ? "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 [&>*:nth-child(5)]:hidden lg:[&>*:nth-child(5)]:flex" : "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} variant={variant} />
      ))}
    </div>
  );
}

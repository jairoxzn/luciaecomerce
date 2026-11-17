"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Price } from "@/components/ui/price";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/services/catalog";
import { FavoriteButton } from "./favorite-button";
import { QuickBuyModal } from "./quick-buy";

export function ProductCard({ product, priority = false, className }: { product: ProductCardData; priority?: boolean; className?: string }) {
  const [quick, setQuick] = useState(false);
  const p = product;
  return (
    <article className={cn("group/card relative flex flex-col", className)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-brand-tint/40">
        <Link href={`/productos/${p.slug}`} className="absolute inset-0" aria-label={p.name}>
          {p.image ? (
            <>
              <Image
                src={p.image}
                alt={p.name}
                fill
                priority={priority}
                sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"
                className={cn("object-cover transition duration-500 group-hover/card:scale-105", p.image2 && "group-hover/card:opacity-0", !p.inStock && "grayscale-[40%]")}
              />
              {p.image2 && <Image src={p.image2} alt="" fill sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw" className="object-cover opacity-0 transition duration-500 group-hover/card:scale-105 group-hover/card:opacity-100" />}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone">Sin imagen</div>
          )}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {p.discountPct > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-soft">-{p.discountPct}%</span>}
          {p.isNew && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">Nuevo</span>}
          {p.isBestSeller && !p.isNew && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-brand shadow-card">Más vendido</span>}
        </div>
        <FavoriteButton productId={p.id} name={p.name} className="absolute right-2.5 top-2.5" />

        {!p.inStock && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/75 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">Agotado</span>
        )}
      </div>

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
        <Price price={p.price} compareAt={p.compareAt} />
        <button
          type="button"
          onClick={() => setQuick(true)}
          disabled={!p.inStock}
          className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          <ShoppingBag className="h-4 w-4" />
          {p.inStock ? "Agregar" : "Agotado"}
        </button>
      </div>

      {quick && <QuickBuyModal product={p} open={quick} onClose={() => setQuick(false)} />}
    </article>
  );
}

export function ProductGrid({ products, className }: { products: ProductCardData[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}

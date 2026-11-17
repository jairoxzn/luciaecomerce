"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, Plus, ShoppingBag, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { addToCart } from "@/components/cart/add-to-cart";
import { useCart } from "@/hooks/use-cart";
import { MAX_CART_QTY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/lib/services/catalog";
import type { SizeGuideSection } from "@/lib/services/settings";
import { ProductGallery } from "./product-gallery";
import { FavoriteButton } from "./favorite-button";
import { SizeGuideButton } from "./size-guide";

type Props = { product: ProductDetail; sizeGuide: SizeGuideSection[]; shippingPolicy: string | null; returnPolicy: string | null };

function Accordion({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-neutral-200">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold">
        {title}
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="animate-[fade-up_0.25s_ease-out] pb-4 text-sm leading-relaxed text-stone">{children}</div>}
    </div>
  );
}

export function ProductView({ product: p, sizeGuide, shippingPolicy, returnPolicy }: Props) {
  const router = useRouter();
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const inCart = useCart((s) => s.items);

  // Color inicial: el primero con stock
  useEffect(() => {
    const first = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
    setColor(first?.colorName ?? null);
  }, [p.variants]);

  const variantsForColor = useMemo(() => p.variants.filter((v) => v.colorName === color), [p.variants, color]);
  const selected = variantsForColor.find((v) => v.sizeName === size) ?? null;

  // Si solo hay una talla (p. ej. "Única") se preselecciona
  useEffect(() => {
    if (variantsForColor.length === 1 && variantsForColor[0].stock > 0) setSize(variantsForColor[0].sizeName);
    else if (size && !variantsForColor.some((v) => v.sizeName === size && v.stock > 0)) setSize(null);
  }, [variantsForColor, size]);

  // Al cambiar de color, muestra la foto de ese color (si existe)
  useEffect(() => {
    if (!color) return;
    const i = p.images.findIndex((im) => im.colorName === color);
    if (i >= 0) setImgIndex(i);
  }, [color, p.images]);

  const alreadyInCart = selected ? (inCart.find((i) => i.variantId === selected.id)?.quantity ?? 0) : 0;
  const maxQty = selected ? Math.max(0, Math.min(MAX_CART_QTY, selected.stock)) : MAX_CART_QTY;
  useEffect(() => setQty(1), [selected?.id]);

  const price = selected?.price ?? p.price;
  const compareAt = selected ? selected.compareAt : p.compareAt;
  const pct = selected ? selected.discountPct : p.discountPct;
  const colorMeta = p.colors.find((c) => c.name === color);

  function add(redirect: boolean) {
    if (!selected) return;
    const ok = addToCart({ variantId: selected.id, quantity: qty, stock: selected.stock, name: p.name, openDrawer: !redirect });
    if (ok && redirect) router.push("/checkout");
    else if (!ok && redirect && alreadyInCart > 0) router.push("/checkout");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <ProductGallery images={p.images} name={p.name} index={imgIndex} onIndex={setImgIndex} />

      <div className="lg:py-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{p.category.name}{p.subcategory ? ` · ${p.subcategory.name}` : ""}</p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{p.name}</h1>
            <p className="mt-1 text-xs text-stone">SKU: {selected?.sku ?? p.sku}</p>
          </div>
          <FavoriteButton productId={p.id} name={p.name} className="shrink-0 border border-neutral-200 !bg-white" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Price price={price} compareAt={compareAt} size="lg" />
          {pct > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">-{pct}%</span>}
        </div>

        {/* Color */}
        {p.colors.length > 0 && (
          <div className="mt-7">
            <p className="text-sm font-semibold">Color: <span className="font-normal text-stone">{color}</span></p>
            <div className="mt-3 flex flex-wrap gap-3">
              {p.colors.map((c) => (
                <button key={c.name} onClick={() => setColor(c.name)} aria-label={c.name} aria-pressed={color === c.name} title={c.name} className={cn("flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/15 transition hover:scale-105", color === c.name && "ring-2 ring-brand ring-offset-2")} style={{ background: c.hex }}>
                  {color === c.name && <Check className={cn("h-4 w-4", c.hex.toLowerCase() === "#ffffff" ? "text-ink" : "text-white")} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Talla */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Talla{size ? <span className="font-normal text-stone">: {size}</span> : null}</p>
            <SizeGuideButton guide={sizeGuide} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {variantsForColor.map((v) => (
              <button
                key={v.id}
                onClick={() => setSize(v.sizeName)}
                disabled={v.stock <= 0}
                aria-pressed={size === v.sizeName}
                title={v.stock <= 0 ? "Agotado" : undefined}
                className={cn(
                  "min-w-12 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                  size === v.sizeName ? "border-brand bg-brand text-white shadow-soft" : "border-neutral-200 hover:border-brand",
                  v.stock <= 0 && "cursor-not-allowed border-dashed bg-mist text-neutral-300 line-through hover:border-neutral-200",
                )}
              >
                {v.sizeName}
              </button>
            ))}
          </div>
          <p className={cn("mt-3 min-h-5 text-sm font-medium", !selected ? "text-stone" : selected.stock <= 3 ? "text-amber-600" : "text-emerald-700")} aria-live="polite">
            {!selected ? "Selecciona una talla para ver la disponibilidad" : selected.stock <= 0 ? "Agotado" : selected.stock <= 3 ? `¡Últimas ${selected.stock} unidades!` : `Stock disponible: ${selected.stock} unidades`}
            {selected && alreadyInCart > 0 && <span className="font-normal text-stone"> · {alreadyInCart} en tu carrito</span>}
          </p>
        </div>

        {/* Cantidad y acciones */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-neutral-200">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={!selected} className="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-brand-tint disabled:opacity-40" aria-label="Disminuir cantidad"><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={!selected || qty >= maxQty} className="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-brand-tint disabled:opacity-40" aria-label="Aumentar cantidad"><Plus className="h-4 w-4" /></button>
          </div>
          <Button size="lg" className="min-w-0 flex-1" disabled={!selected || selected.stock <= 0} onClick={() => add(false)}>
            <ShoppingBag className="h-5 w-5" /> {selected ? "Agregar al carrito" : "Elige una talla"}
          </Button>
        </div>
        <Button size="lg" variant="dark" className="mt-3 w-full" disabled={!selected || selected.stock <= 0} onClick={() => add(true)}>
          <Zap className="h-5 w-5" /> Comprar ahora
        </Button>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-tint/60 px-4 py-3 text-sm">
          <Truck className="h-5 w-5 shrink-0 text-brand" />
          <span>Envíos a todo el Perú. Calcula el costo exacto en el checkout.</span>
        </div>

        <div className="mt-8 border-t border-neutral-200">
          <Accordion title="Descripción" defaultOpen>
            <p className="whitespace-pre-line">{p.description}</p>
            {colorMeta && <p className="mt-2">Color mostrado: {colorMeta.name}.</p>}
          </Accordion>
          {(p.material || p.careInstructions) && (
            <Accordion title="Material y cuidados">
              {p.material && <p><strong className="text-ink">Material:</strong> {p.material}</p>}
              {p.careInstructions && <p className="mt-1"><strong className="text-ink">Cuidados:</strong> {p.careInstructions}</p>}
            </Accordion>
          )}
          {shippingPolicy && <Accordion title="Envíos"><p className="whitespace-pre-line">{shippingPolicy}</p></Accordion>}
          {returnPolicy && <Accordion title="Cambios y devoluciones"><p className="whitespace-pre-line">{returnPolicy}</p></Accordion>}
        </div>
      </div>
    </div>
  );
}

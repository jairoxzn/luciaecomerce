"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { run, type ActionResult } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth/session";
import { buildQuote, mergeItems, type CartItemInput, type Quote } from "@/lib/services/cart";
import { loadActivePromotions, resolvePrice } from "@/lib/services/pricing";
import { cartItemSchema } from "@/lib/validations/checkout";
import { num } from "@/lib/utils";

const itemsSchema = z.array(cartItemSchema).max(40);

const quoteSchema = z.object({
  items: itemsSchema,
  couponCode: z.string().trim().max(40).optional(),
  delivery: z.object({ method: z.enum(["DELIVERY", "PICKUP"]), department: z.string().max(40).nullish() }).nullish(),
});

/** Cotiza el carrito con precios y stock vigentes del servidor. */
export async function quoteCartAction(raw: z.input<typeof quoteSchema>): Promise<ActionResult<Quote>> {
  return run<Quote>(async () => {
    const input = quoteSchema.parse(raw);
    const quote = await buildQuote(input.items, { couponCode: input.couponCode, delivery: input.delivery ?? null });
    return { ok: true, data: quote };
  });
}

export async function loadServerCartAction(): Promise<CartItemInput[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
  return cart?.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) ?? [];
}

async function persist(userId: string, items: CartItemInput[]) {
  const merged = mergeItems(items);
  const valid = await prisma.productVariant.findMany({ where: { id: { in: merged.map((m) => m.variantId) } }, select: { id: true } });
  const ok = new Set(valid.map((v) => v.id));
  const finalItems = merged.filter((m) => ok.has(m.variantId));
  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (finalItems.length) await tx.cartItem.createMany({ data: finalItems.map((i) => ({ cartId: cart.id, variantId: i.variantId, quantity: i.quantity })) });
  });
  return finalItems;
}

/** Guarda el carrito del cliente autenticado en la base de datos. */
export async function saveServerCartAction(raw: CartItemInput[]): Promise<ActionResult> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: true };
    await persist(user.id, itemsSchema.parse(raw));
    return { ok: true };
  });
}

/** Al iniciar sesión: fusiona el carrito local con el guardado en la cuenta. */
export async function mergeServerCartAction(raw: CartItemInput[]): Promise<ActionResult<CartItemInput[]>> {
  return run<CartItemInput[]>(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: true, data: itemsSchema.parse(raw) };
    const existing = await loadServerCartAction();
    const finalItems = await persist(user.id, [...existing, ...itemsSchema.parse(raw)]);
    return { ok: true, data: finalItems };
  });
}

export type VariantOption = { id: string; sizeName: string; colorName: string; colorHex: string; stock: number; priceCents: number };

/** Variantes disponibles de un producto (para "cambiar variante" en el carrito). */
export async function getVariantOptionsAction(productId: string): Promise<VariantOption[]> {
  const [variants, promos] = await Promise.all([
    prisma.productVariant.findMany({
      where: { productId, isActive: true, product: { status: "ACTIVE" } },
      include: { size: true, color: true, product: true },
      orderBy: [{ color: { sortOrder: "asc" } }, { size: { sortOrder: "asc" } }],
    }),
    loadActivePromotions(),
  ]);
  return variants.map((v) => ({
    id: v.id,
    sizeName: v.size.name,
    colorName: v.color.name,
    colorHex: v.color.hex,
    stock: v.stock,
    priceCents: resolvePrice(
      { price: num(v.product.price), salePrice: v.product.salePrice ? num(v.product.salePrice) : null, variantPrice: v.price ? num(v.price) : null, categoryId: v.product.categoryId },
      promos,
    ).unitCents,
  }));
}

"use client";

import { toast } from "sonner";
import { useCart } from "@/hooks/use-cart";

/** Agrega una variante al carrito con feedback visual y abre el panel del carrito. */
export function addToCart(opts: { variantId: string; quantity?: number; stock: number; name: string; openDrawer?: boolean }) {
  const { variantId, quantity = 1, stock, name, openDrawer = true } = opts;
  if (stock <= 0) {
    toast.error("Esta variante está agotada.");
    return false;
  }
  const store = useCart.getState();
  const inCart = store.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  if (inCart >= stock) {
    toast.warning(`Ya tienes en tu carrito todo el stock disponible (${stock}).`);
    return false;
  }
  store.add(variantId, quantity, stock);
  toast.success(`${name} agregado al carrito`);
  if (openDrawer) store.openDrawer();
  return true;
}

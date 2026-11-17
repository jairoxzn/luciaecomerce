"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_CART_QTY } from "@/lib/constants";

export type LocalCartItem = { variantId: string; quantity: number };

type CartState = {
  items: LocalCartItem[];
  drawerOpen: boolean;
  couponCode: string | null;
  hydrated: boolean;
  add: (variantId: string, quantity?: number, maxStock?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  changeVariant: (oldId: string, newId: string) => void;
  replaceAll: (items: LocalCartItem[]) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      couponCode: null,
      hydrated: false,
      add: (variantId, quantity = 1, maxStock) =>
        set((s) => {
          const cap = Math.min(MAX_CART_QTY, maxStock ?? MAX_CART_QTY);
          const existing = s.items.find((i) => i.variantId === variantId);
          if (existing) {
            return { items: s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(cap, i.quantity + quantity) } : i)) };
          }
          return { items: [...s.items, { variantId, quantity: Math.min(cap, quantity) }] };
        }),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          items: quantity <= 0 ? s.items.filter((i) => i.variantId !== variantId) : s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(MAX_CART_QTY, quantity) } : i)),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      changeVariant: (oldId, newId) =>
        set((s) => {
          if (oldId === newId) return s;
          const old = s.items.find((i) => i.variantId === oldId);
          if (!old) return s;
          const without = s.items.filter((i) => i.variantId !== oldId);
          const target = without.find((i) => i.variantId === newId);
          if (target) return { items: without.map((i) => (i.variantId === newId ? { ...i, quantity: Math.min(MAX_CART_QTY, i.quantity + old.quantity) } : i)) };
          return { items: s.items.map((i) => (i.variantId === oldId ? { ...i, variantId: newId } : i)) };
        }),
      replaceAll: (items) => set({ items }),
      clear: () => set({ items: [], couponCode: null }),
      setCoupon: (couponCode) => set({ couponCode }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "lj-cart",
      version: 1,
      partialize: (s) => ({ items: s.items, couponCode: s.couponCode }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
        useCart.setState({ hydrated: true });
      },
    },
  ),
);

export const cartCount = (items: LocalCartItem[]) => items.reduce((n, i) => n + i.quantity, 0);

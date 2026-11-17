"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/actions/account";

type FavState = {
  ids: Set<string>;
  authenticated: boolean;
  init: (ids: string[], authenticated: boolean) => void;
  toggle: (productId: string, name?: string) => Promise<void>;
};

export const useFavorites = create<FavState>((set, get) => ({
  ids: new Set(),
  authenticated: false,
  init: (ids, authenticated) => set({ ids: new Set(ids), authenticated }),
  toggle: async (productId, name) => {
    if (!get().authenticated) {
      toast.info("Inicia sesión para guardar tus favoritos", {
        action: { label: "Ingresar", onClick: () => (window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`) },
      });
      return;
    }
    const before = get().ids;
    const next = new Set(before);
    const adding = !next.has(productId);
    if (adding) next.add(productId);
    else next.delete(productId);
    set({ ids: next }); // optimista
    const res = await toggleFavoriteAction(productId);
    if (!res.ok) {
      set({ ids: before });
      toast.error(res.error);
      return;
    }
    toast.success(adding ? `${name ?? "Producto"} agregado a favoritos` : "Quitado de favoritos");
  },
}));

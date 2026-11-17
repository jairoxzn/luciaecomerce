"use client";

import { useEffect, useRef } from "react";
import { loadServerCartAction, mergeServerCartAction, saveServerCartAction } from "@/app/actions/cart";
import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";

/**
 * - Inicializa favoritos del cliente autenticado.
 * - Con sesión: fusiona el carrito local con el de la cuenta y lo mantiene guardado en la base de datos.
 * - Sin sesión: el carrito vive en el navegador (localStorage).
 */
export function CartSync({ authenticated, userId, favoriteIds }: { authenticated: boolean; userId: string | null; favoriteIds: string[] }) {
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const syncedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    useFavorites.getState().init(favoriteIds, authenticated);
  }, [authenticated, favoriteIds]);

  // Fusión inicial al detectar sesión
  useEffect(() => {
    if (!hydrated || !authenticated || !userId || syncedFor.current === userId) return;
    syncedFor.current = userId;
    (async () => {
      const local = useCart.getState().items;
      if (local.length) {
        const res = await mergeServerCartAction(local);
        if (res.ok && res.data) useCart.getState().replaceAll(res.data);
      } else {
        const server = await loadServerCartAction();
        if (server.length) useCart.getState().replaceAll(server);
      }
    })();
  }, [hydrated, authenticated, userId]);

  // Persistencia en servidor (debounce)
  useEffect(() => {
    if (!hydrated || !authenticated || syncedFor.current !== userId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveServerCartAction(items), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, hydrated, authenticated, userId]);

  // Al cerrar sesión se limpia el carrito local (equipos compartidos)
  useEffect(() => {
    if (hydrated && !authenticated && syncedFor.current) {
      syncedFor.current = null;
      useCart.getState().clear();
    }
  }, [authenticated, hydrated]);

  return null;
}

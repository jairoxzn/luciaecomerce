"use client";

import { useEffect, useRef } from "react";
import { loadServerCartAction, mergeServerCartAction, saveServerCartAction } from "@/app/actions/cart";
import { useCart } from "@/hooks/use-cart";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { useSession } from "@/hooks/use-session";

/**
 * - Carga la sesión y los favoritos del visitante (el layout ya no lee cookies, para permitir caché de páginas).
 * - Con sesión: fusiona el carrito local con el de la cuenta y lo mantiene guardado en la base de datos.
 * - Sin sesión: el carrito vive en el navegador (localStorage).
 */
export function CartSync() {
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const userId = useSession((s) => s.user?.id ?? null);
  const authenticated = userId !== null;
  const syncedFor = useRef<string | null>(null);

  // Una consulta de sesión al montar la tienda
  useEffect(() => {
    void useSession.getState().refresh();
  }, []);

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

  // Persistencia en servidor (debounce de 800 ms; siempre guarda la última versión del carrito)
  const save = useDebouncedCallback((list: typeof items) => void saveServerCartAction(list), 800);
  useEffect(() => {
    if (!hydrated || !authenticated || syncedFor.current !== userId) return;
    save(items);
  }, [items, hydrated, authenticated, userId, save]);

  // Al cerrar sesión se limpia el carrito local (equipos compartidos)
  useEffect(() => {
    if (hydrated && !authenticated && syncedFor.current) {
      syncedFor.current = null;
      save.cancel();
      useCart.getState().clear();
    }
  }, [authenticated, hydrated, save]);

  return null;
}

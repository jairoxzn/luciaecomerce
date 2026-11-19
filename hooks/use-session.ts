"use client";

import { create } from "zustand";
import { useFavorites } from "./use-favorites";

export type SessionUser = { id: string; name: string; role: "ADMIN" | "CUSTOMER" };

type SessionState = {
  /** true cuando ya se consultó al servidor al menos una vez */
  ready: boolean;
  user: SessionUser | null;
  /** Consulta /api/session (una sola petición aunque varios componentes la pidan a la vez) */
  refresh: () => Promise<void>;
  /** Cierra la sesión en el cliente (tras `logoutAction`) sin esperar otra petición */
  clear: () => void;
};

let inflight: Promise<void> | null = null;

/**
 * Sesión del visitante en el navegador.
 * El layout de la tienda NO lee cookies (así las páginas pueden servirse desde caché/ISR); el usuario y sus favoritos
 * se cargan aquí, tras la hidratación, desde `/api/session`.
 */
export const useSession = create<SessionState>((set) => ({
  ready: false,
  user: null,
  refresh: () => {
    inflight ??= (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { user: SessionUser | null; favoriteIds: string[] };
        set({ ready: true, user: data.user });
        useFavorites.getState().init(data.favoriteIds ?? [], !!data.user);
      } catch {
        set({ ready: true }); // sin red: se conserva el último estado conocido
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
  clear: () => {
    set({ ready: true, user: null });
    useFavorites.getState().init([], false);
  },
}));

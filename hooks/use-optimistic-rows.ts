"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/** `changes` se aplica a la fila `id`; `others` (opcional) al resto (p. ej. quitar «principal» a las demás); `remove` la elimina. */
export type RowPatch<T> = { id: string; remove?: boolean; changes?: Partial<T>; others?: Partial<T> };

/**
 * Lista de filas con actualización OPTIMISTA: el cambio se ve al instante y la acción del servidor corre en segundo plano.
 * - Si la acción termina bien, la acción ya hizo `revalidatePath` y llegan las filas reales (sin parpadeo).
 * - Si falla, React descarta el cambio optimista y la fila vuelve sola a su estado real; además se muestra el error.
 * `mutate` tiene identidad estable (se puede pasar a hijos memoizados).
 */
export function useOptimisticRows<T extends { id: string }>(rows: T[]) {
  const [optimistic, apply] = useOptimistic(rows, (state: T[], p: RowPatch<T>) =>
    p.remove ? state.filter((r) => r.id !== p.id) : state.map((r) => (r.id === p.id ? { ...r, ...p.changes } : p.others ? { ...r, ...p.others } : r)),
  );
  const [pending, start] = useTransition();

  const mutate = useCallback(
    (patch: RowPatch<T>, action: () => Promise<ActionResult<unknown>>, successMessage?: string) =>
      start(async () => {
        apply(patch);
        const r = await action();
        if (!r.ok) toast.error(r.error);
        else if (successMessage ?? r.message) toast.success((successMessage ?? r.message)!);
      }),
    [apply, start],
  );

  return { rows: optimistic, mutate, pending };
}

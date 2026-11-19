"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Devuelve `value` solo cuando deja de cambiar durante `delay` ms (para búsquedas y filtros mientras se escribe). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export type Debounced<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void; flush: () => void };

/**
 * Función con debounce de identidad estable entre renders (se puede pasar a hijos memoizados sin romper React.memo).
 * Siempre invoca la ÚLTIMA versión de `fn`; se cancela al desmontar. `flush()` ejecuta la llamada pendiente de inmediato.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 300): Debounced<A> {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  });

  const debounced = useMemo(() => {
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
    };
    const flush = () => {
      if (!pending.current) return;
      const args = pending.current;
      cancel();
      fnRef.current(...args);
    };
    const call = (...args: A) => {
      pending.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    };
    return Object.assign(call, { cancel, flush });
  }, [delay]);

  useEffect(() => () => debounced.cancel(), [debounced]);
  return debounced;
}

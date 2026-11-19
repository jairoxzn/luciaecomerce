"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { formatPEN } from "@/lib/utils";

type Suggestion = { slug: string; name: string; image: string | null; price: number; compareAt: number | null; category: string };

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

const SuggestionRow = memo(function SuggestionRow({ item, onPick }: { item: Suggestion; onPick: () => void }) {
  return (
    <li>
      <Link href={`/productos/${item.slug}`} onClick={onPick} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-brand-tint/60">
        <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">{item.image && <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          <span className="text-xs text-stone">{item.category}</span>
        </span>
        <span className="text-sm font-bold text-brand">{formatPEN(item.price)}</span>
      </Link>
    </li>
  );
});

export function SearchBox({ onNavigate, autoFocus, className }: { onNavigate?: () => void; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  // Resultados ya pedidos en esta sesión: repetir o borrar y volver a escribir un término no genera otra petición
  const seen = useRef(new Map<string, Suggestion[]>());

  // La petición solo sale cuando la persona hace una pausa al escribir
  const term = useDebouncedValue(normalize(q), DEBOUNCE_MS);
  const typing = normalize(q) !== term; // hay texto nuevo esperando la pausa

  useEffect(() => {
    if (term.length < MIN_CHARS) {
      setItems([]);
      setFetching(false);
      return;
    }
    const key = term.toLowerCase();
    const hit = seen.current.get(key);
    if (hit) {
      setItems(hit);
      setFetching(false);
      return;
    }
    const ctrl = new AbortController();
    setFetching(true);
    fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { items?: Suggestion[] }) => {
        const list = data.items ?? [];
        if (seen.current.size > 50) seen.current.clear();
        seen.current.set(key, list);
        setItems(list);
        setFetching(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return; // cancelado por una escritura posterior
        setItems([]);
        setFetching(false);
      });
    return () => ctrl.abort();
  }, [term]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = normalize(q);
    if (!text) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/catalogo?q=${encodeURIComponent(text)}`);
  }

  const loading = normalize(q).length >= MIN_CHARS && (typing || fetching);
  // Identidad estable: así las filas memoizadas no se re-renderizan en cada pulsación
  const close = useCallback(() => {
    setOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  return (
    <div ref={wrap} className={`relative ${className ?? ""}`}>
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          type="search"
          placeholder="Buscar productos…"
          aria-label="Buscar productos"
          className="h-11 w-full rounded-full border border-neutral-200 bg-mist pl-11 pr-10 text-sm transition focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
        {loading ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone" />
        ) : q ? (
          <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone hover:text-ink" aria-label="Limpiar búsqueda">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {open && normalize(q).length >= MIN_CHARS && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xl">
          {items.length === 0 && !loading ? (
            <p className="px-4 py-5 text-center text-sm text-stone">Sin resultados para “{q}”</p>
          ) : (
            <ul className={`max-h-96 overflow-y-auto py-1 transition-opacity ${typing ? "opacity-60" : ""}`}>
              {items.map((i) => (
                <SuggestionRow key={i.slug} item={i} onPick={close} />
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <button onClick={submit} className="w-full border-t border-neutral-100 px-4 py-3 text-center text-sm font-semibold text-brand hover:bg-brand-tint/60">
              Ver todos los resultados
            </button>
          )}
        </div>
      )}
    </div>
  );
}

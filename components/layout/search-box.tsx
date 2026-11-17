"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { formatPEN } from "@/lib/utils";

type Suggestion = { slug: string; name: string; image: string | null; price: number; compareAt: number | null; category: string };

export function SearchBox({ onNavigate, autoFocus, className }: { onNavigate?: () => void; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setItems(data.items ?? []);
      } catch {
        /* cancelado */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/catalogo?q=${encodeURIComponent(q.trim())}`);
  }

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

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xl">
          {items.length === 0 && !loading ? (
            <p className="px-4 py-5 text-center text-sm text-stone">Sin resultados para “{q}”</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {items.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/productos/${i.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-brand-tint/60"
                  >
                    <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">{i.image && <Image src={i.image} alt="" fill sizes="48px" className="object-cover" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      <span className="text-xs text-stone">{i.category}</span>
                    </span>
                    <span className="text-sm font-bold text-brand">{formatPEN(i.price)}</span>
                  </Link>
                </li>
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

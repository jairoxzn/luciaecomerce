"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { pluralize } from "@/lib/utils";

export type PickerProduct = { id: string; name: string; sku: string; category: string };

// Cada fila solo se vuelve a renderizar si cambia SU casilla (con ~1000 productos, marcar uno no repinta el resto)
const Row = memo(function Row({ product, checked, onToggle }: { product: PickerProduct; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-brand-tint/30">
        <input type="checkbox" checked={checked} onChange={() => onToggle(product.id)} className="h-4 w-4 accent-[#E65385]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{product.name}</span>
          <span className="block truncate text-xs text-stone">{product.category} · {product.sku}</span>
        </span>
      </label>
    </li>
  );
});

/** Lista de productos con búsqueda (con debounce) y selección múltiple. */
export function ProductPicker({ products, value, onChange, error }: { products: PickerProduct[]; value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim().toLowerCase(), 200); // el filtro corre tras una pausa al escribir
  const selected = useMemo(() => new Set(value), [value]);

  // Lo último que se eligió, sin recrear `toggle` en cada cambio (así las filas memoizadas no se re-renderizan)
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const toggle = useCallback((id: string) => {
    const { value: cur, onChange: set } = latest.current;
    set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);

  const visible = useMemo(
    () => (term ? products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)) : products),
    [products, term],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, SKU o categoría…" className="h-10 pl-10" aria-label="Buscar productos" />
        </div>
        <Button size="sm" variant="outline" onClick={() => onChange([...new Set([...value, ...visible.map((p) => p.id)])])}>Marcar visibles</Button>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>Limpiar</Button>
      </div>
      <p className="mb-2 text-xs text-stone">{selected.size} {pluralize(selected.size, "producto elegido", "productos elegidos")} (máx. 300)</p>
      <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
        {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone">No hay productos que coincidan.</li>}
        {visible.map((p) => (
          <Row key={p.id} product={p} checked={selected.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

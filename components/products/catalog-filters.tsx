"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { NavCategory } from "@/lib/services/catalog";

type Props = {
  categories: NavCategory[];
  fixedCategory?: string; // slug cuando la página ya está acotada a una categoría
  facets: { sizes: string[]; colors: { name: string; hex: string }[] };
  priceRange: { min: number; max: number };
  total: number;
  showCategories?: boolean;
};

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const update = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    params.delete("pagina");
    const qs = params.toString();
    start(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };
  return { sp, update, pending, pathname, router };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-neutral-100 py-5 first:pt-0 last:border-0">
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterPanel({ categories, fixedCategory, facets, priceRange, showCategories }: Omit<Props, "total">) {
  const { sp, update } = useQueryUpdater();
  const categoria = fixedCategory ?? sp.get("categoria") ?? "";
  const subcategoria = sp.get("subcategoria") ?? "";
  const tallas = (sp.get("talla") ?? "").split(",").filter(Boolean);
  const colores = (sp.get("color") ?? "").split(",").filter(Boolean);
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const current = categories.find((c) => c.slug === categoria);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]).join(",") || undefined;

  return (
    <div>
      {showCategories && (
        <Group title="Categoría">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => update({ categoria: undefined, subcategoria: undefined })} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", !categoria ? "border-brand bg-brand text-white" : "border-neutral-200 hover:border-brand")}>
              Todas
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => update({ categoria: c.slug, subcategoria: undefined })} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", categoria === c.slug ? "border-brand bg-brand text-white" : "border-neutral-200 hover:border-brand")}>
                {c.name}
              </button>
            ))}
          </div>
        </Group>
      )}

      {current && current.subcategories.length > 0 && (
        <Group title="Subcategoría">
          <div className="flex flex-wrap gap-2">
            {current.subcategories.map((s) => (
              <button key={s.id} onClick={() => update({ subcategoria: subcategoria === s.slug ? undefined : s.slug })} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", subcategoria === s.slug ? "border-brand bg-brand-tint font-semibold text-brand" : "border-neutral-200 hover:border-brand")}>
                {s.name}
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group title="Precio (S/)">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ min: min || undefined, max: max || undefined });
          }}
        >
          <Input type="number" inputMode="numeric" min={0} placeholder={`${priceRange.min}`} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Precio mínimo" className="h-10" />
          <span className="text-stone">–</span>
          <Input type="number" inputMode="numeric" min={0} placeholder={`${priceRange.max}`} value={max} onChange={(e) => setMax(e.target.value)} aria-label="Precio máximo" className="h-10" />
          <Button type="submit" variant="dark" size="sm">OK</Button>
        </form>
      </Group>

      {facets.sizes.length > 0 && (
        <Group title="Talla">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} onClick={() => update({ talla: toggle(tallas, s) })} aria-pressed={tallas.includes(s)} className={cn("min-w-11 rounded-lg border px-3 py-2 text-sm font-medium transition", tallas.includes(s) ? "border-brand bg-brand text-white" : "border-neutral-200 hover:border-brand")}>
                {s}
              </button>
            ))}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Color">
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => (
              <button key={c.name} onClick={() => update({ color: toggle(colores, c.name) })} title={c.name} aria-label={c.name} aria-pressed={colores.includes(c.name)} className={cn("flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/15 transition", colores.includes(c.name) && "ring-2 ring-brand ring-offset-2")} style={{ background: c.hex }}>
                {colores.includes(c.name) && <Check className={cn("h-4 w-4", c.hex.toLowerCase() === "#ffffff" ? "text-ink" : "text-white")} />}
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group title="Disponibilidad">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={sp.get("disponible") === "1"} onChange={(e) => update({ disponible: e.target.checked ? "1" : undefined })} className="h-4 w-4 accent-[#E65385]" />
          Solo productos disponibles
        </label>
      </Group>
    </div>
  );
}

export function CatalogFilters(props: Props) {
  const { sp, update, pending, router, pathname } = useQueryUpdater();
  const [open, setOpen] = useState(false);
  const active = ["subcategoria", "min", "max", "talla", "color", "disponible", "q", ...(props.fixedCategory ? [] : ["categoria"])].filter((k) => sp.get(k)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-sm text-stone transition", pending && "opacity-50")}>
          <strong className="text-ink">{props.total}</strong> {props.total === 1 ? "producto" : "productos"}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros {active > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] text-white">{active}</span>}
          </Button>
          {active > 0 && (
            <button onClick={() => router.push(props.fixedCategory ? pathname : pathname)} className="hidden items-center gap-1 text-sm text-stone hover:text-brand sm:inline-flex">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          )}
          <Select aria-label="Ordenar por" value={sp.get("orden") ?? "recientes"} onChange={(e) => update({ orden: e.target.value === "recientes" ? undefined : e.target.value })} className="h-10 w-52 rounded-full text-sm">
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="vendidos">Más vendidos</option>
          </Select>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Filtros" side="right">
        <FilterPanel {...props} />
        <Button className="mt-4 w-full" size="lg" onClick={() => setOpen(false)}>Ver {props.total} productos</Button>
      </Modal>
    </>
  );
}

export function CatalogSidebar(props: Omit<Props, "total">) {
  return (
    <aside className="sticky top-28 hidden max-h-[calc(100dvh-8rem)] w-64 shrink-0 self-start overflow-y-auto pr-2 lg:block" aria-label="Filtros">
      <FilterPanel {...props} />
    </aside>
  );
}

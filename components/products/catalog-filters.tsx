"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, Rows3, SlidersHorizontal, X } from "lucide-react";
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

/** Grupo plegable: el título es un botón nativo (<summary>), accesible por teclado y sin JavaScript extra. */
function Group({ title, children, defaultOpen = true, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: number }) {
  return (
    <details open={defaultOpen} className="group/filter border-b border-neutral-100 py-4 first:pt-0 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {!!badge && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-stone transition group-open/filter:rotate-180" aria-hidden />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
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
  // Si el rango cambia desde fuera (chip de filtro quitado, «Limpiar todo»), los campos se sincronizan
  const urlMin = sp.get("min") ?? "";
  const urlMax = sp.get("max") ?? "";
  useEffect(() => {
    setMin(urlMin);
    setMax(urlMax);
  }, [urlMin, urlMax]);
  const current = categories.find((c) => c.slug === categoria);

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]).join(",") || undefined;

  // Atajos de precio: tres tramos iguales entre el mínimo y el máximo reales del catálogo
  const span = priceRange.max - priceRange.min;
  const presets =
    span >= 30
      ? [0, 1, 2].map((i) => {
          const lo = i === 0 ? priceRange.min : Math.round((priceRange.min + (span * i) / 3) / 10) * 10;
          const hi = i === 2 ? priceRange.max : Math.round((priceRange.min + (span * (i + 1)) / 3) / 10) * 10;
          return { lo, hi, label: i === 0 ? `Hasta S/ ${hi}` : i === 2 ? `Desde S/ ${lo}` : `S/ ${lo} – ${hi}` };
        })
      : [];

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

      <Group title="Precio (S/)" badge={sp.get("min") || sp.get("max") ? 1 : undefined}>
        {presets.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {presets.map((p) => {
              const on = (sp.get("min") ?? "") === (p.lo === priceRange.min ? "" : String(p.lo)) && (sp.get("max") ?? "") === (p.hi === priceRange.max ? "" : String(p.hi)) && (sp.get("min") || sp.get("max"));
              return (
                <button
                  key={p.label}
                  aria-pressed={!!on}
                  onClick={() => {
                    const lo = p.lo === priceRange.min ? "" : String(p.lo);
                    const hi = p.hi === priceRange.max ? "" : String(p.hi);
                    setMin(on ? "" : lo);
                    setMax(on ? "" : hi);
                    update({ min: on ? undefined : lo || undefined, max: on ? undefined : hi || undefined });
                  }}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", on ? "border-brand bg-brand-tint text-brand" : "border-neutral-200 hover:border-brand")}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            update({ min: min || undefined, max: max || undefined });
          }}
        >
          <div className="flex items-center gap-2">
            {([["Precio mínimo", min, setMin, priceRange.min], ["Precio máximo", max, setMax, priceRange.max]] as const).map(([label, value, set, ph], i) => (
              <div key={label} className="contents">
                {i === 1 && <span className="text-stone" aria-hidden>–</span>}
                <div className="relative min-w-0 flex-1">
                  <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone">S/</span>
                  {/* Sin flechas del navegador (tapaban el número en cajas angostas); el teclado numérico sigue disponible en móvil */}
                  <Input type="number" inputMode="numeric" min={0} placeholder={`${ph}`} value={value} onChange={(e) => set(e.target.value)} aria-label={label} className="h-10 pl-8 pr-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </div>
              </div>
            ))}
          </div>
          <Button type="submit" variant="dark" size="sm" className="w-full">Aplicar precio</Button>
        </form>
      </Group>

      {facets.sizes.length > 0 && (
        <Group title="Talla" badge={tallas.length || undefined}>
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
        <Group title="Color" badge={colores.length || undefined}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {facets.colors.map((c) => {
              const on = colores.includes(c.name);
              return (
                <button key={c.name} onClick={() => update({ color: toggle(colores, c.name) })} aria-pressed={on} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition", on ? "bg-brand-tint font-semibold text-brand" : "hover:bg-mist")}>
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-black/15", on && "ring-2 ring-brand ring-offset-1")} style={{ background: c.hex }}>
                    {on && <Check className={cn("h-3 w-3", c.hex.toLowerCase() === "#ffffff" ? "text-ink" : "text-white")} />}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
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

/** Chips con los filtros activos; cada uno se quita con un toque. */
function ActiveFilters({ categories, fixedCategory }: { categories: NavCategory[]; fixedCategory?: string }) {
  const { sp, update, router, pathname } = useQueryUpdater();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const csv = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);

  const cat = fixedCategory ? undefined : categories.find((c) => c.slug === sp.get("categoria"));
  if (cat) chips.push({ key: "cat", label: cat.name, remove: () => update({ categoria: undefined, subcategoria: undefined }) });
  const sub = (fixedCategory ? categories.find((c) => c.slug === fixedCategory) : cat)?.subcategories.find((s) => s.slug === sp.get("subcategoria"));
  if (sub) chips.push({ key: "sub", label: sub.name, remove: () => update({ subcategoria: undefined }) });
  if (sp.get("min") || sp.get("max")) chips.push({ key: "price", label: `S/ ${sp.get("min") || "0"} – ${sp.get("max") || "∞"}`, remove: () => update({ min: undefined, max: undefined }) });
  for (const t of csv("talla")) chips.push({ key: `t-${t}`, label: `Talla ${t}`, remove: () => update({ talla: csv("talla").filter((x) => x !== t).join(",") || undefined }) });
  for (const c of csv("color")) chips.push({ key: `c-${c}`, label: c, remove: () => update({ color: csv("color").filter((x) => x !== c).join(",") || undefined }) });
  if (sp.get("disponible") === "1") chips.push({ key: "disp", label: "Disponibles", remove: () => update({ disponible: undefined }) });
  if (sp.get("q")) chips.push({ key: "q", label: `“${sp.get("q")}”`, remove: () => update({ q: undefined }) });

  if (chips.length === 0) return null;
  return (
    <ul className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      {chips.map((c) => (
        <li key={c.key}>
          <button onClick={c.remove} className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint py-1 pl-3 pr-2 text-xs font-semibold text-brand transition hover:bg-brand-soft/60" aria-label={`Quitar filtro ${c.label}`}>
            {c.label} <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
      <li>
        <button onClick={() => router.push(pathname)} className="px-2 py-1 text-xs font-medium text-stone underline-offset-2 transition hover:text-brand hover:underline">
          Limpiar todo
        </button>
      </li>
    </ul>
  );
}

type Density = "compact" | "wide";

/**
 * Barra de herramientas + densidad de la cuadrícula. La cuadrícula (renderizada en el servidor) llega como `children`
 * y cambia de columnas con un atributo `data-density`, sin volver a pedir datos.
 */
export function CatalogShell({ children, ...props }: Props & { children: React.ReactNode }) {
  const { sp, update, pending } = useQueryUpdater();
  const [open, setOpen] = useState(false);
  const [density, setDensity] = useState<Density>("compact");
  const active = ["subcategoria", "min", "max", "talla", "color", "disponible", "q", ...(props.fixedCategory ? [] : ["categoria"])].filter((k) => sp.get(k)).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-mist/60 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filtros {active > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] text-white">{active}</span>}
          </Button>
          <p className={cn("text-sm text-stone transition", pending && "opacity-50")} aria-live="polite">
            <strong className="text-ink">{props.total}</strong> {props.total === 1 ? "producto" : "productos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5" role="group" aria-label="Tamaño de la cuadrícula">
            {([["compact", LayoutGrid, "Vista compacta"], ["wide", Rows3, "Vista amplia"]] as const).map(([d, Icon, label]) => (
              <button key={d} type="button" onClick={() => setDensity(d)} aria-pressed={density === d} aria-label={label} title={label} className={cn("flex h-8 w-8 items-center justify-center rounded-full transition", density === d ? "bg-ink text-white" : "text-stone hover:text-brand")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Select aria-label="Ordenar por" value={sp.get("orden") ?? "recientes"} onChange={(e) => update({ orden: e.target.value === "recientes" ? undefined : e.target.value })} className="h-10 w-48 rounded-full text-sm sm:w-52">
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="vendidos">Más vendidos</option>
          </Select>
        </div>
      </div>

      <ActiveFilters categories={props.categories} fixedCategory={props.fixedCategory} />

      <div data-density={density} className={cn("group/density transition-opacity", pending && "opacity-60")}>
        {children}
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
    <aside className="sticky top-28 hidden max-h-[calc(100dvh-8rem)] w-64 shrink-0 self-start overflow-y-auto rounded-2xl border border-neutral-100 bg-white p-5 lg:block" aria-label="Filtros">
      <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <SlidersHorizontal className="h-4 w-4 text-brand" /> Filtrar
      </p>
      <FilterPanel {...props} />
    </aside>
  );
}

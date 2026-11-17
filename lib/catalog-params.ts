import type { CatalogFilters } from "@/lib/services/catalog";

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : (v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
const numOrUndef = (v: string | undefined) => {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseCatalogParams(sp: SP, fixed?: Partial<CatalogFilters>): CatalogFilters {
  const orden = first(sp.orden);
  return {
    categoria: fixed?.categoria ?? first(sp.categoria)?.slice(0, 60),
    subcategoria: first(sp.subcategoria)?.slice(0, 60),
    min: numOrUndef(first(sp.min)),
    max: numOrUndef(first(sp.max)),
    tallas: list(sp.talla),
    colores: list(sp.color),
    disponible: first(sp.disponible) === "1",
    oferta: fixed?.oferta ?? first(sp.oferta) === "1",
    q: first(sp.q)?.slice(0, 80),
    orden: (["recientes", "precio-asc", "precio-desc", "vendidos"] as const).find((o) => o === orden) ?? "recientes",
    pagina: Math.max(1, Math.floor(Number(first(sp.pagina)) || 1)),
  };
}

export function buildQuery(sp: SP, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v);
    if (val) params.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") params.delete(k);
    else params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

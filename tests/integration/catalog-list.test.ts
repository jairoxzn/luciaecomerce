import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { getProductBySlug, listProducts, PAGE_SIZE } from "@/lib/services/catalog";
import { prisma, resetDb } from "../helpers";

// Catálogo de referencia (todas las combinaciones de filtros se comprueban contra estos datos conocidos)
const names: Record<string, string> = {};

async function make(key: string, o: { categoryId: string; subcategoryId?: string; price: number; sale?: number; status?: "ACTIVE" | "DRAFT"; variants: { size: string; color: string; stock: number }[]; createdAt: Date }) {
  const p = await prisma.product.create({
    data: {
      name: `Prod ${key}`, slug: `prod-${key}`, sku: `SKU-${key}`, description: `desc ${key}`, categoryId: o.categoryId, subcategoryId: o.subcategoryId ?? null,
      price: new Prisma.Decimal(o.price), salePrice: o.sale ? new Prisma.Decimal(o.sale) : null, status: o.status ?? "ACTIVE", createdAt: o.createdAt,
      images: { create: [{ url: `/img/${key}-1.webp`, sortOrder: 0 }, { url: `/img/${key}-2.webp`, sortOrder: 1 }, { url: `/img/${key}-3.webp`, sortOrder: 2 }] },
      variants: { create: o.variants.map((v, i) => ({ sku: `V-${key}-${i}`, sizeId: v.size, colorId: v.color, stock: v.stock, minStock: 1 })) },
    },
  });
  names[key] = p.name;
  return p;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n)); // n mayor = más reciente
const ids = (r: { items: { name: string }[] }) => r.items.map((i) => i.name);

let catA: { id: string }, catInactive: { id: string };

beforeAll(async () => {
  await resetDb();
  catA = await prisma.category.create({ data: { name: "Mujer", slug: "mujer", sortOrder: 1 } });
  catInactive = await prisma.category.create({ data: { name: "Oculta", slug: "oculta", isActive: false, sortOrder: 2 } });
  const sub = await prisma.subcategory.create({ data: { name: "Jeans", slug: "jeans", categoryId: catA.id, sortOrder: 1 } });
  const [s, m] = await Promise.all([prisma.size.create({ data: { name: "S", sortOrder: 1 } }), prisma.size.create({ data: { name: "M", sortOrder: 2 } })]);
  const [azul, rojo] = await Promise.all([prisma.color.create({ data: { name: "Azul", hex: "#0000ff", sortOrder: 1 } }), prisma.color.create({ data: { name: "Rojo", hex: "#ff0000", sortOrder: 2 } })]);

  await make("P1", { categoryId: catA.id, subcategoryId: sub.id, price: 100, createdAt: day(3), variants: [{ size: m.id, color: azul.id, stock: 5 }] });
  await make("P2", { categoryId: catA.id, price: 50, sale: 40, createdAt: day(2), variants: [{ size: s.id, color: rojo.id, stock: 0 }] });
  await make("P3", { categoryId: catA.id, price: 200, createdAt: day(1), variants: [{ size: m.id, color: rojo.id, stock: 3 }, { size: s.id, color: azul.id, stock: 3 }] });
  await make("BORRADOR", { categoryId: catA.id, price: 10, status: "DRAFT", createdAt: day(4), variants: [{ size: m.id, color: azul.id, stock: 9 }] });
  await make("OCULTA", { categoryId: catInactive.id, price: 70, createdAt: day(5), variants: [{ size: m.id, color: azul.id, stock: 9 }] });
});

describe("listado del catálogo (consulta optimizada)", () => {
  it("solo muestra productos activos, del más reciente al más antiguo", async () => {
    const r = await listProducts({});
    expect(ids(r)).not.toContain("Prod BORRADOR");
    expect(ids(r).filter((n) => /^Prod P\d$/.test(n))).toEqual(["Prod P1", "Prod P2", "Prod P3"]);
  });

  it("categoría: filtra y devuelve nombre y descripción; una categoría inactiva o inexistente no lista nada", async () => {
    const r = await listProducts({ categoria: "mujer" });
    expect(ids(r)).toEqual(["Prod P1", "Prod P2", "Prod P3"]);
    expect(r.category).toMatchObject({ name: "Mujer", slug: "mujer" });
    expect((await listProducts({ categoria: "oculta" })).total).toBe(0);
    expect((await listProducts({ categoria: "no-existe" })).total).toBe(0);
  });

  it("subcategoría: filtra y la devuelve; una desconocida se ignora", async () => {
    const r = await listProducts({ categoria: "mujer", subcategoria: "jeans" });
    expect(ids(r)).toEqual(["Prod P1"]);
    expect(r.subcategory).toEqual({ name: "Jeans", slug: "jeans" });
    const unknown = await listProducts({ categoria: "mujer", subcategoria: "otra" });
    expect(unknown.total).toBe(3);
    expect(unknown.subcategory).toBeNull();
  });

  it("talla, color y disponibilidad (se combinan sobre la misma variante)", async () => {
    expect(ids(await listProducts({ categoria: "mujer", tallas: ["M"] }))).toEqual(["Prod P1", "Prod P3"]);
    expect(ids(await listProducts({ categoria: "mujer", colores: ["Rojo"] }))).toEqual(["Prod P2", "Prod P3"]);
    expect(ids(await listProducts({ categoria: "mujer", disponible: true }))).toEqual(["Prod P1", "Prod P3"]);
    expect(ids(await listProducts({ categoria: "mujer", tallas: ["M"], colores: ["Rojo"], disponible: true }))).toEqual(["Prod P3"]);
    expect(ids(await listProducts({ categoria: "mujer", tallas: ["S"], colores: ["Rojo"], disponible: true }))).toEqual([]); // la S roja está agotada
  });

  it("precio: usa el precio efectivo (oferta) y el rango de la categoría no depende del filtro de precio", async () => {
    const r = await listProducts({ categoria: "mujer", min: 60 });
    expect(ids(r)).toEqual(["Prod P1", "Prod P3"]); // P2 cuesta 40 con oferta
    expect(r.priceRange).toEqual({ min: 40, max: 200 });
    expect(ids(await listProducts({ categoria: "mujer", max: 100 }))).toEqual(["Prod P1", "Prod P2"]);
  });

  it("orden por precio y por recientes", async () => {
    expect(ids(await listProducts({ categoria: "mujer", orden: "precio-asc" }))).toEqual(["Prod P2", "Prod P1", "Prod P3"]);
    expect(ids(await listProducts({ categoria: "mujer", orden: "precio-desc" }))).toEqual(["Prod P3", "Prod P1", "Prod P2"]);
  });

  it("facetas: tallas y colores de la categoría, en el orden de la tienda", async () => {
    const r = await listProducts({ categoria: "mujer" });
    expect(r.facets.sizes).toEqual(["S", "M"]);
    expect(r.facets.colors.map((c) => c.name)).toEqual(["Azul", "Rojo"]);
  });

  it("tarjetas: dos fotos como máximo, precio tachado, colores y existencias", async () => {
    const r = await listProducts({ categoria: "mujer" });
    const p2 = r.items.find((i) => i.name === "Prod P2")!;
    expect(p2).toMatchObject({ image: "/img/P2-1.webp", image2: "/img/P2-2.webp", price: 40, compareAt: 50, inStock: false, lowStock: false, categoryName: "Mujer" });
    const p3 = r.items.find((i) => i.name === "Prod P3")!;
    expect(p3).toMatchObject({ inStock: true, lowStock: false }); // 6 unidades en total
    expect(p3.colors.map((c) => c.name)).toEqual(["Azul", "Rojo"]);
  });

  it("búsqueda por texto (nombre, SKU, descripción)", async () => {
    expect(ids(await listProducts({ q: "p3" }))).toEqual(["Prod P3"]);
    expect(ids(await listProducts({ q: "desc P1" }))).toEqual(["Prod P1"]);
    expect((await listProducts({ q: "zzzz" })).total).toBe(0);
  });

  it("paginación: PAGE_SIZE por página y la página se ajusta al rango", async () => {
    const cat = await prisma.category.create({ data: { name: "Masiva", slug: "masiva", sortOrder: 9 } });
    const size = await prisma.size.findFirstOrThrow({ where: { name: "M" } });
    const color = await prisma.color.findFirstOrThrow({ where: { name: "Azul" } });
    for (let i = 0; i < PAGE_SIZE + 3; i++) await make(`M${String(i).padStart(2, "0")}`, { categoryId: cat.id, price: 10 + i, createdAt: day(10 + i), variants: [{ size: size.id, color: color.id, stock: 2 }] });
    const p1 = await listProducts({ categoria: "masiva", pagina: 1 });
    expect(p1).toMatchObject({ total: PAGE_SIZE + 3, pageCount: 2, page: 1 });
    expect(p1.items).toHaveLength(PAGE_SIZE);
    const p2 = await listProducts({ categoria: "masiva", pagina: 2 });
    expect(p2.items).toHaveLength(3);
    expect((await listProducts({ categoria: "masiva", pagina: 99 })).page).toBe(2);
    // sin repetidos entre páginas
    expect(new Set([...ids(p1), ...ids(p2)]).size).toBe(PAGE_SIZE + 3);
  });

  it("ficha de producto: fotos y variantes ordenadas (una sola consulta con JOIN)", async () => {
    const p = await getProductBySlug("prod-P3");
    expect(p).toMatchObject({ name: "Prod P3", category: { slug: "mujer" } });
    expect(p!.images.map((i) => i.url)).toEqual(["/img/P3-1.webp", "/img/P3-2.webp", "/img/P3-3.webp"]);
    expect(p!.variants.map((v) => `${v.colorName}/${v.sizeName}`)).toEqual(["Azul/S", "Rojo/M"]);
    expect(await getProductBySlug("prod-BORRADOR")).toBeNull(); // borrador: no se muestra
  });
});

import { describe, expect, it } from "vitest";
import { isShareLive, shareCatalogWhere, shareStatus, shareWhatsAppText } from "@/lib/share-catalog-core";
import { shareCatalogSchema } from "@/lib/validations/admin";

const base = { title: "Colección Verano", showPrices: true, onlyInStock: false, isActive: true };

describe("shareCatalogWhere", () => {
  it("sin selección incluye todo el catálogo activo", () => {
    expect(shareCatalogWhere({ categoryIds: [], productIds: [], onlyInStock: false })).toEqual({ status: "ACTIVE" });
  });
  it("filtra por categorías", () => {
    expect(shareCatalogWhere({ categoryIds: ["c1", "c2"], productIds: [], onlyInStock: false })).toEqual({ status: "ACTIVE", categoryId: { in: ["c1", "c2"] } });
  });
  it("los productos elegidos tienen prioridad sobre las categorías", () => {
    const w = shareCatalogWhere({ categoryIds: ["c1"], productIds: ["p1"], onlyInStock: false });
    expect(w).toEqual({ status: "ACTIVE", id: { in: ["p1"] } });
  });
  it("solo con stock exige una variante activa con stock", () => {
    const w = shareCatalogWhere({ categoryIds: [], productIds: [], onlyInStock: true });
    expect(w.variants).toEqual({ some: { isActive: true, stock: { gt: 0 } } });
  });
  it("nunca expone borradores ni archivados", () => {
    for (const s of [{ categoryIds: [], productIds: ["x"], onlyInStock: true }, { categoryIds: ["c"], productIds: [], onlyInStock: false }]) {
      expect(shareCatalogWhere(s).status).toBe("ACTIVE");
    }
  });
});

describe("vigencia del enlace", () => {
  const now = new Date("2026-11-19T12:00:00Z");
  it("activo sin vencimiento", () => expect(isShareLive({ isActive: true, expiresAt: null }, now)).toBe(true));
  it("desactivado no es visible", () => expect(isShareLive({ isActive: false, expiresAt: null }, now)).toBe(false));
  it("vencido no es visible", () => {
    expect(isShareLive({ isActive: true, expiresAt: new Date("2026-11-19T11:59:59Z") }, now)).toBe(false);
    expect(shareStatus({ isActive: true, expiresAt: "2026-11-01T00:00:00Z" }, now)).toBe("expired");
  });
  it("vigente hasta el vencimiento", () => {
    expect(isShareLive({ isActive: true, expiresAt: new Date("2026-11-20T04:59:59Z") }, now)).toBe(true);
    expect(shareStatus({ isActive: false, expiresAt: "2026-11-01T00:00:00Z" }, now)).toBe("inactive");
  });
});

describe("shareWhatsAppText", () => {
  it("incluye título, tienda y enlace", () => {
    const t = shareWhatsAppText("Verano", "https://x.pe/c/abc", "LUCIA JEANS");
    expect(t).toContain("«Verano»");
    expect(t).toContain("LUCIA JEANS");
    expect(t).toContain("https://x.pe/c/abc");
  });
});

describe("shareCatalogSchema", () => {
  it("acepta un catálogo mínimo y normaliza vacíos", () => {
    const r = shareCatalogSchema.parse({ ...base, message: "  ", expiresAt: "" });
    expect(r.message).toBeUndefined();
    expect(r.expiresAt).toBeNull();
    expect(r.categoryIds).toEqual([]);
    expect(r.productIds).toEqual([]);
  });
  it("rechaza título corto", () => {
    expect(shareCatalogSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
  it("rechaza vencimiento pasado y acepta futuro (fin del día en Lima)", () => {
    expect(shareCatalogSchema.safeParse({ ...base, expiresAt: "2020-01-01" }).success).toBe(false);
    const future = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
    const r = shareCatalogSchema.parse({ ...base, expiresAt: future });
    expect(r.expiresAt).toEqual(new Date(`${future}T23:59:59.999-05:00`));
    expect(r.expiresAt!.getUTCHours()).toBe(4); // 23:59 Lima = 04:59 UTC del día siguiente
  });
  it("limita a 300 productos", () => {
    const ids = Array.from({ length: 301 }, (_, i) => `p${i}`);
    expect(shareCatalogSchema.safeParse({ ...base, productIds: ids }).success).toBe(false);
  });
});

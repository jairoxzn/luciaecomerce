import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setCacheClientForTests, cached, cacheKey, invalidateCache, rateLimitRedis, type CacheClient } from "@/lib/cache";

/** Redis mínimo en memoria (sin TTL real) para probar la lógica de la capa. */
function fakeRedis() {
  const store = new Map<string, string>();
  const counters = new Map<string, number>();
  const client: CacheClient & { store: Map<string, string>; calls: string[] } = {
    store,
    calls: [],
    async get(k) { client.calls.push(`get ${k}`); return store.get(k) ?? null; },
    async set(k, v) { client.calls.push(`set ${k}`); store.set(k, v); return "OK"; },
    async scan(_c, _m, pattern) {
      const prefix = pattern.replace(/\*$/, "");
      return ["0", [...store.keys()].filter((k) => k.startsWith(prefix))];
    },
    async unlink(...keys) { keys.forEach((k) => store.delete(k)); return keys.length; },
    async eval(_s, _n, key) { const n = (counters.get(String(key)) ?? 0) + 1; counters.set(String(key), n); return n; },
  };
  return client;
}

beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));
afterEach(() => { __setCacheClientForTests(undefined); vi.restoreAllMocks(); });

describe("cacheKey", () => {
  it("no depende del orden de las propiedades", () => {
    expect(cacheKey("list", { a: 1, b: { y: 2, x: 1 } })).toBe(cacheKey("list", { b: { x: 1, y: 2 }, a: 1 }));
  });
  it("distingue parámetros distintos y nombres distintos", () => {
    expect(cacheKey("list", { a: 1 })).not.toBe(cacheKey("list", { a: 2 }));
    expect(cacheKey("a", { a: 1 })).not.toBe(cacheKey("b", { a: 1 }));
  });
  it("sin parámetros devuelve el nombre tal cual", () => expect(cacheKey("settings")).toBe("settings"));
});

describe("cached con Redis", () => {
  it("la segunda lectura sale de la caché sin volver a cargar", async () => {
    __setCacheClientForTests(fakeRedis());
    const load = vi.fn().mockResolvedValue({ n: 1 });
    expect(await cached("k1", 60, load)).toEqual({ n: 1 });
    expect(await cached("k1", 60, load)).toEqual({ n: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("también guarda null y listas vacías (no recarga en cada petición)", async () => {
    __setCacheClientForTests(fakeRedis());
    const nul = vi.fn().mockResolvedValue(null);
    await cached("nul", 60, nul); await cached("nul", 60, nul);
    expect(nul).toHaveBeenCalledTimes(1);
    const empty = vi.fn().mockResolvedValue([]);
    await cached("empty", 60, empty); expect(await cached("empty", 60, empty)).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(1);
  });
  it("las cargas simultáneas con la misma clave se comparten", async () => {
    __setCacheClientForTests(fakeRedis());
    let release!: (v: number) => void;
    const load = vi.fn(() => new Promise<number>((r) => { release = r; }));
    const a = cached("slow", 60, load); const b = cached("slow", 60, load);
    await vi.waitFor(() => expect(load).toHaveBeenCalled()); // la carga arranca tras la lectura en Redis
    release(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("un error al cargar no se guarda en caché y se propaga", async () => {
    const r = fakeRedis(); __setCacheClientForTests(r);
    await expect(cached("boom", 60, async () => { throw new Error("db caída"); })).rejects.toThrow("db caída");
    expect(r.store.size).toBe(0);
    expect(await cached("boom", 60, async () => 5)).toBe(5);
  });
  it("invalidateCache borra por prefijo y deja el resto", async () => {
    const r = fakeRedis(); __setCacheClientForTests(r);
    await cached("product:a", 60, async () => 1);
    await cached("product:b", 60, async () => 2);
    await cached("home", 60, async () => 3);
    await invalidateCache("product:");
    expect([...r.store.keys()]).toEqual(["lj:c:home"]);
    await invalidateCache();
    expect(r.store.size).toBe(0);
  });
});

describe("shouldCache", () => {
  it("no guarda los resultados que el llamador excluye (p. ej. «no encontrado»)", async () => {
    const r = fakeRedis(); __setCacheClientForTests(r);
    const load = vi.fn().mockResolvedValue(null);
    await cached("p:x", 60, load, (v) => v !== null);
    await cached("p:x", 60, load, (v) => v !== null);
    expect(load).toHaveBeenCalledTimes(2);
    expect(r.store.size).toBe(0);
  });
});

describe("isCacheableListing", () => {
  it("cachea listados comunes y rechaza combinaciones arbitrarias", async () => {
    const { isCacheableListing } = await import("@/lib/services/catalog");
    expect(isCacheableListing({})).toBe(true);
    expect(isCacheableListing({ categoria: "mujer", orden: "precio-asc", pagina: 2, tallas: ["M"] })).toBe(true);
    expect(isCacheableListing({ q: "jean" })).toBe(false);
    expect(isCacheableListing({ min: 10 })).toBe(false);
    expect(isCacheableListing({ max: 99 })).toBe(false);
    expect(isCacheableListing({ pagina: 99 })).toBe(false);
    expect(isCacheableListing({ tallas: ["S", "M", "L", "XL"] })).toBe(false);
    expect(isCacheableListing({ colores: ["x".repeat(21)] })).toBe(false);
  });
});

describe("degradación sin Redis o con Redis caído", () => {
  it("sin Redis ejecuta la carga siempre (sin cachear datos obsoletos)", async () => {
    __setCacheClientForTests(null);
    let n = 0;
    expect(await cached("x", 60, async () => ++n)).toBe(1);
    expect(await cached("x", 60, async () => ++n)).toBe(2);
  });
  it("si Redis falla, responde con la base de datos y no lanza", async () => {
    const r = fakeRedis();
    r.get = async () => { throw new Error("ECONNREFUSED"); };
    __setCacheClientForTests(r);
    expect(await cached("k", 60, async () => "db")).toBe("db");
  });
  it("tras un fallo el circuito se abre y no se vuelve a llamar a Redis", async () => {
    const r = fakeRedis();
    const get = vi.fn(async () => { throw new Error("timeout"); });
    r.get = get;
    __setCacheClientForTests(r);
    await cached("a", 60, async () => 1);
    await cached("b", 60, async () => 2);
    await cached("c", 60, async () => 3);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("invalidateCache no lanza aunque Redis falle", async () => {
    const r = fakeRedis(); r.scan = async () => { throw new Error("down"); };
    __setCacheClientForTests(r);
    await expect(invalidateCache()).resolves.toBeUndefined();
  });
});

describe("rateLimitRedis", () => {
  it("permite hasta el límite y bloquea después", async () => {
    __setCacheClientForTests(fakeRedis());
    const res = [];
    for (let i = 0; i < 4; i++) res.push(await rateLimitRedis("search:1.1.1.1", 3, 60));
    expect(res).toEqual([true, true, true, false]);
  });
  it("devuelve null (usar respaldo) sin Redis o con Redis caído", async () => {
    __setCacheClientForTests(null);
    expect(await rateLimitRedis("k", 5, 60)).toBeNull();
    const r = fakeRedis(); r.eval = async () => { throw new Error("down"); };
    __setCacheClientForTests(r);
    expect(await rateLimitRedis("k", 5, 60)).toBeNull();
  });
});

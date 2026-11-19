import "server-only";
import { createHash } from "crypto";
import Redis from "ioredis";
import { after } from "next/server";

/**
 * Caché compartida en Redis para los datos más consultados (catálogo, ajustes, promociones, búsquedas).
 *
 * - OPCIONAL: sin `REDIS_URL` todo funciona igual que antes (solo se evitan cargas duplicadas dentro del proceso).
 * - Si Redis falla o tarda, se ignora ("fail-open"): la petición se resuelve contra la base de datos y un
 *   interruptor de circuito evita seguir esperando a un Redis caído durante unos segundos.
 * - Solo admite valores JSON (sin Date/Decimal/Map).
 * - Las claves de datos viven bajo `lj:c:`; `invalidateCache()` las borra al cambiar el catálogo o la configuración.
 */

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  scan(cursor: string, match: "MATCH", pattern: string, count: "COUNT", n: number): Promise<[string, string[]]>;
  unlink(...keys: string[]): Promise<number>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

const DATA = "lj:c:";
const RATE = "lj:rl:";
const BREAKER_MS = 10_000;

const g = globalThis as unknown as { __ljRedis?: CacheClient | null };
let override: CacheClient | null | undefined; // solo para pruebas
let downUntil = 0;
let lastLog = 0;
const inflight = new Map<string, Promise<unknown>>();

function trip(e: unknown) {
  downUntil = Date.now() + BREAKER_MS;
  if (Date.now() - lastLog > 30_000) {
    lastLog = Date.now();
    console.warn("[cache] Redis no disponible, se usa la base de datos:", e instanceof Error ? e.message : e);
  }
}

function client(): CacheClient | null {
  if (override !== undefined) return override;
  if (g.__ljRedis !== undefined) return g.__ljRedis;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return (g.__ljRedis = null);
  const r = new Redis(url, {
    connectTimeout: 2000,
    commandTimeout: 600,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    retryStrategy: (n) => Math.min(n * 500, 5000),
  });
  r.on("error", trip);
  return (g.__ljRedis = r as unknown as CacheClient);
}

/** Cliente utilizable ahora mismo (null si no hay Redis configurado o el circuito está abierto). */
function live(): CacheClient | null {
  if (Date.now() < downUntil) return null;
  return client();
}

export const cacheEnabled = () => !!client();

/** Clave estable a partir de un nombre y parámetros opcionales (los parámetros se normalizan y se resumen con SHA-1). */
export function cacheKey(name: string, params?: unknown): string {
  if (params === undefined) return name;
  const stable = JSON.stringify(params, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
  return `${name}:${createHash("sha1").update(stable).digest("hex").slice(0, 16)}`;
}

async function read<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  const c = live();
  if (!c) return { hit: false };
  try {
    const raw = await c.get(DATA + key);
    if (raw === null) return { hit: false };
    return { hit: true, value: (JSON.parse(raw) as { v: T }).v };
  } catch (e) {
    trip(e);
    return { hit: false };
  }
}

async function write(key: string, value: unknown, ttlSeconds: number) {
  const c = live();
  if (!c) return;
  try {
    await c.set(DATA + key, JSON.stringify({ v: value ?? null }), "EX", Math.max(1, Math.floor(ttlSeconds)));
  } catch (e) {
    trip(e);
  }
}

/**
 * Devuelve el valor en caché o lo calcula con `load()` y lo guarda `ttlSeconds`.
 * Las llamadas simultáneas con la misma clave comparten una sola carga (evita avalanchas a la base de datos).
 *
 * `shouldCache` permite NO guardar ciertos resultados (p. ej. «no encontrado»): las claves que dependen de datos
 * escritos por el usuario (slugs, términos de búsqueda) no deben poder llenar Redis con entradas basura.
 */
export function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>, shouldCache: (value: T) => boolean = () => true): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = (async () => {
    const hit = await read<T>(key);
    if (hit.hit) return hit.value;
    const value = await load();
    if (shouldCache(value)) await write(key, value, ttlSeconds);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Borra las entradas de datos cuyo nombre empieza por `prefix` (todas si se omite). */
export async function invalidateCache(prefix = ""): Promise<void> {
  inflight.clear();
  const c = live();
  if (!c) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await c.scan(cursor, "MATCH", `${DATA}${prefix}*`, "COUNT", 200);
      cursor = next;
      if (keys.length) await c.unlink(...keys);
    } while (cursor !== "0");
  } catch (e) {
    trip(e);
  }
}

/**
 * Invalida sin bloquear la respuesta: dentro de una petición se difiere con `after` (sigue ejecutándose
 * en entornos serverless tras responder); fuera de una petición (scripts, pruebas) se lanza directamente.
 */
export function invalidateInBackground(prefix = ""): void {
  const run = () => invalidateCache(prefix);
  try {
    after(run);
  } catch {
    void run();
  }
}

const RATE_SCRIPT = "local c = redis.call('INCR', KEYS[1]) if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return c";

/**
 * Contador de ventana fija en Redis (atómico). Devuelve true/false si se permite la operación,
 * o null si Redis no está disponible (el llamador debe usar su respaldo).
 */
export async function rateLimitRedis(key: string, limit: number, windowSec: number): Promise<boolean | null> {
  const c = live();
  if (!c) return null;
  try {
    const n = Number(await c.eval(RATE_SCRIPT, 1, RATE + key, windowSec));
    return n <= limit;
  } catch (e) {
    trip(e);
    return null;
  }
}

/** Solo para pruebas: inyecta un cliente falso y reinicia el estado interno. */
export function __setCacheClientForTests(c: CacheClient | null | undefined) {
  override = c;
  downUntil = 0;
  inflight.clear();
}

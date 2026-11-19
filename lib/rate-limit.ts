import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimitRedis } from "@/lib/cache";

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Rate limiting persistente en PostgreSQL (funciona con varias instancias).
 * Devuelve true si la operación está permitida.
 *
 * Con `fast: true` (rutas de muy alta frecuencia, como el autocompletado) se cuenta primero en Redis para no
 * escribir en la base de datos en cada pulsación; si Redis no está configurado o falla se usa PostgreSQL.
 * Los límites de seguridad (login, registro, recuperación…) NO usan `fast`: siguen siendo durables en PostgreSQL.
 */
export async function rateLimit(key: string, limit: number, windowSec: number, opts: { fast?: boolean } = {}): Promise<boolean> {
  if (opts.fast) {
    const r = await rateLimitRedis(key, limit, windowSec);
    if (r !== null) return r;
  }
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, now() + (${windowSec}::int * interval '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < now() THEN EXCLUDED."expiresAt" ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= limit;
}

export async function resetRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

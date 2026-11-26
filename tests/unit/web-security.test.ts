import { readdirSync, readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { secureCookies } from "@/lib/auth/cookies";
import { isCrossSite, isSameOrigin } from "@/lib/csrf";

afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string>) => new Request("http://interno:3000/api/x", { method: "POST", headers });

describe("secureCookies", () => {
  it("en producción las cookies son Secure aunque NEXT_PUBLIC_SITE_URL falte o sea http", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://mal-configurada.test");
    expect(secureCookies()).toBe(true);
  });
  it("en desarrollo no; COOKIE_SECURE manda en ambos casos", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COOKIE_SECURE", "");
    expect(secureCookies()).toBe(false);
    vi.stubEnv("COOKIE_SECURE", "true");
    expect(secureCookies()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "false");
    expect(secureCookies()).toBe(false);
  });
});

describe("isSameOrigin (CSRF de route handlers)", () => {
  it("acepta el Origin que coincide con Host o con el dominio de la tienda", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.test/");
    expect(isSameOrigin(req({ origin: "https://preview.test", host: "preview.test" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://tienda.test", host: "app:3000" }))).toBe(true); // proxy que reescribe Host
  });
  it("rechaza otro origen, la falta de Origin y valores inválidos", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.test");
    expect(isSameOrigin(req({ origin: "https://evil.test", host: "tienda.test" }))).toBe(false);
    expect(isSameOrigin(req({ host: "tienda.test" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "tienda.test" }))).toBe(false);
  });
  it("no se fía de X-Forwarded-Host (lo puede escribir el cliente)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.test");
    expect(isSameOrigin(req({ origin: "https://evil.test", host: "tienda.test", "x-forwarded-host": "evil.test" }))).toBe(false);
  });
});

describe("isCrossSite", () => {
  it("solo rechaza lo que el navegador declara de otro sitio", () => {
    expect(isCrossSite(req({ "sec-fetch-site": "cross-site" }))).toBe(true);
    for (const v of ["same-origin", "same-site", "none"]) expect(isCrossSite(req({ "sec-fetch-site": v }))).toBe(false);
    expect(isCrossSite(req({}))).toBe(false);
  });
});

/**
 * Todo lo exportado desde un archivo "use server" es un endpoint público. Cada función debe comprobar quién llama
 * (o limitar la frecuencia); las que son públicas a propósito se listan aquí, para que añadir una sea una decisión.
 */
describe("Server Actions", () => {
  const PUBLIC_ON_PURPOSE = ["logoutAction", "quoteCartAction", "getVariantOptionsAction"];
  const GUARD = /\b(assertAdmin|assertUser|getCurrentUser|rateLimit)\s*\(/;

  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
  const root = path.resolve(__dirname, "../..");
  const files = ["app", "lib", "components"].flatMap((d) => walk(path.join(root, d))).filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

  it("encuentra los archivos de acciones", () => expect(files.length).toBeGreaterThan(5));

  it("ninguna función exportada queda sin comprobación", () => {
    const unguarded = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split(/^(?=export )/m)
        .map((block) => ({ name: block.match(/^export (?:async )?(?:function|const) (\w+)/)?.[1], block }))
        .filter(({ name, block }) => name && !PUBLIC_ON_PURPOSE.includes(name) && !GUARD.test(block))
        .map(({ name }) => `${path.relative(root, f)}: ${name}`),
    );
    expect(unguarded).toEqual([]);
  });
});

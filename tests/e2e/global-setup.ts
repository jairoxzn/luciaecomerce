import { chromium } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, rm } from "fs/promises";
import path from "path";
import { ADMIN, ADMIN_STATE, PRODUCTS } from "./data";

const BASE = "http://localhost:3100";

/** Seguridad: nunca se toca una base que no termine en «_test» (se vacía por completo antes de sembrar). */
function assertTestDb() {
  const url = process.env.DATABASE_URL ?? "";
  const dbName = url.match(/\/([^/?]+)(\?|$)/)?.[1] ?? "";
  if (!dbName.endsWith("_test")) throw new Error(`ABORTADO: las pruebas E2E requieren una base *_test (actual: "${dbName}")`);
}

async function seed() {
  assertTestDb();
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

    await prisma.storeSettings.create({
      data: {
        id: "main", storeName: "LUCIA JEANS", whatsapp: "999888777", email: "tienda@lucia.test",
        yapeEnabled: true, yapeNumber: "999111222", yapeHolder: "Lucía Jeans", codEnabled: true, pickupEnabled: true, pickupAddress: "Av. Larco 123, Miraflores",
      },
    });
    await prisma.shippingZone.create({ data: { name: "Lima", departments: ["Lima", "Callao"], price: new Prisma.Decimal(10), freeShippingFrom: new Prisma.Decimal(300) } });
    await prisma.user.create({ data: { email: ADMIN.email, name: ADMIN.name, role: "ADMIN", passwordHash: await bcrypt.hash(ADMIN.password, 10) } });

    const [mujer, hombre] = await Promise.all([
      prisma.category.create({ data: { name: "Mujer", slug: "mujer", sortOrder: 1, showOnHome: true, subcategories: { create: [{ name: "Jeans", slug: "jeans", sortOrder: 1 }] } } }),
      prisma.category.create({ data: { name: "Hombre", slug: "hombre", sortOrder: 2, showOnHome: true } }),
    ]);
    const [s, m, l] = await Promise.all(["S", "M", "L"].map((name, i) => prisma.size.create({ data: { name, sortOrder: i + 1 } })));
    const [azul, negro] = await Promise.all([
      prisma.color.create({ data: { name: "Azul", hex: "#1f4e9c", sortOrder: 1 } }),
      prisma.color.create({ data: { name: "Negro", hex: "#111111", sortOrder: 2 } }),
    ]);

    const make = (p: { name: string; slug: string; price: number; sale?: number }, categoryId: string, variants: { size: string; color: string; stock: number }[]) =>
      prisma.product.create({
        data: {
          name: p.name, slug: p.slug, sku: p.slug.toUpperCase(), description: "Producto de prueba E2E.", categoryId, status: "ACTIVE",
          price: new Prisma.Decimal(p.price), salePrice: p.sale ? new Prisma.Decimal(p.sale) : null, isNew: true,
          variants: { create: variants.map((v, i) => ({ sku: `${p.slug}-${i}`.toUpperCase(), sizeId: v.size, colorId: v.color, stock: v.stock, minStock: 1 })) },
        },
      });

    await make(PRODUCTS.jean, mujer.id, [{ size: m.id, color: azul.id, stock: 20 }, { size: l.id, color: azul.id, stock: 20 }]);
    await make(PRODUCTS.skinny, mujer.id, [{ size: s.id, color: negro.id, stock: 10 }, { size: m.id, color: negro.id, stock: 10 }]);
    await make(PRODUCTS.hombre, hombre.id, [{ size: l.id, color: azul.id, stock: 10 }]);
    // Totalmente agotado: sirve para «Avísame cuando haya stock»
    await make(PRODUCTS.agotado, mujer.id, [{ size: m.id, color: negro.id, stock: 0 }, { size: l.id, color: negro.id, stock: 0 }]);
  } finally {
    await prisma.$disconnect();
  }
}

/** `next dev` compila cada ruta en su primera visita: se «calientan» antes de medir para no agotar los tiempos de los casos. */
async function warmUp() {
  const paths = ["/", "/catalogo", "/catalogo?categoria=hombre&talla=S&orden=precio-asc", ...Object.values(PRODUCTS).map((p) => `/productos/${p.slug}`), "/carrito", "/checkout", "/login", "/pedidos/LJ-000000-AAAAA", "/api/session", "/api/search?q=jean"];
  for (const p of paths) {
    try {
      await fetch(BASE + p, { signal: AbortSignal.timeout(120_000), redirect: "manual" });
    } catch {
      /* si una ruta tarda más, el caso concreto esperará su propia compilación */
    }
  }
}

/**
 * Inicia sesión como administrador una sola vez y guarda la sesión (los casos la reutilizan). De paso compila las rutas
 * del panel que usan las pruebas, para que ningún caso pague ese tiempo.
 */
async function adminLogin() {
  const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || "msedge" });
  try {
    const ctx = await browser.newContext({ baseURL: BASE, locale: "es-PE" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(180_000);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(ADMIN.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 180_000 });
    for (const p of ["/admin/pagos", "/admin/inventario", "/admin/inventario?filtro=agotado", "/api/admin/alerts"]) await page.goto(p, { timeout: 180_000 });
    await mkdir(path.dirname(ADMIN_STATE), { recursive: true });
    await ctx.storageState({ path: ADMIN_STATE });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  await rm(path.resolve(__dirname, "../../.test-storage-e2e"), { recursive: true, force: true });
  await seed();
  await warmUp();
  await adminLogin();
}

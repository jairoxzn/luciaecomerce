import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Seguridad: las pruebas de integración solo corren contra una base cuyo nombre termina en "_test". */
export function assertTestDb() {
  const url = process.env.DATABASE_URL ?? "";
  const dbName = url.match(/\/([^/?]+)(\?|$)/)?.[1] ?? "";
  if (!dbName.endsWith("_test")) throw new Error(`ABORTADO: las pruebas de integración requieren una base de datos *_test (actual: "${dbName}")`);
}

export async function resetDb() {
  assertTestDb();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function seedBasics() {
  const category = await prisma.category.create({ data: { name: "Mujer", slug: `mujer-${uid()}` } });
  const size = await prisma.size.create({ data: { name: `M-${uid()}`, sortOrder: 1 } });
  const color = await prisma.color.create({ data: { name: `Azul-${uid()}`, hex: "#0000ff" } });
  await prisma.storeSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", codEnabled: true, yapeEnabled: true, yapeNumber: "999111222", pickupEnabled: true, pickupPrice: new Prisma.Decimal(0) },
  });
  await prisma.shippingZone.create({ data: { name: "Lima", departments: ["Lima", "Callao"], price: new Prisma.Decimal(10), freeShippingFrom: new Prisma.Decimal(200) } });
  return { category, size, color };
}

export async function makeProduct(opts: { categoryId: string; sizeId: string; colorId: string; price?: number; salePrice?: number | null; stock?: number; status?: "ACTIVE" | "DRAFT" }) {
  const id = uid();
  const product = await prisma.product.create({
    data: {
      name: `Prod ${id}`, slug: `prod-${id}`, sku: `SKU-${id}`, description: "x", categoryId: opts.categoryId,
      price: new Prisma.Decimal(opts.price ?? 100), salePrice: opts.salePrice != null ? new Prisma.Decimal(opts.salePrice) : null, status: opts.status ?? "ACTIVE",
      variants: { create: [{ sku: `V-${id}`, sizeId: opts.sizeId, colorId: opts.colorId, stock: opts.stock ?? 5, minStock: 1 }] },
    },
    include: { variants: true },
  });
  return { product, variant: product.variants[0] };
}

export const customer = (over: Partial<{ email: string; phone: string }> = {}) => ({
  firstName: "Ana", lastName: "Pérez", phone: over.phone ?? "987654321", email: over.email ?? "ana@example.com", dni: undefined as string | undefined,
});

export function orderInput(variantId: string, quantity: number, extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: `${uid()}-${Math.random().toString(36).slice(2)}-xxxxxxxxxxxx`,
    items: [{ variantId, quantity }],
    customer: customer(),
    delivery: { method: "DELIVERY" as const, department: "Lima", province: "Lima", district: "Miraflores", addressLine: "Av. Larco 123", reference: undefined },
    paymentMethod: "YAPE" as const,
    customerNote: undefined,
    couponCode: undefined as string | undefined,
    ...extra,
  };
}
